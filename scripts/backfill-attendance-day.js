// One-off migration: normalize `Attendance.date` to the timezone-stable calendar
// day marker the app now writes (UTC midnight of the *company-local* day). Older
// rows stored server-local midnight, which drifted from the company timezone on
// non-UTC servers (e.g. Vercel) and made EOD recovery miss real checkouts.
//
// Idempotent — safe to run more than once. Run with:
//   node scripts/backfill-attendance-day.js

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const uri =
  process.env.NODE_ENV === "production"
    ? process.env.ATLAS_URI
    : process.env.MONGODB_URI;

if (!uri) {
  console.error("No MONGODB_URI / ATLAS_URI found in the environment.");
  process.exit(1);
}

const DEFAULT_TIME_ZONE = "Asia/Kolkata";

function resolveTimeZone(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function zonedDay(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return { year: parts.year, month: parts.month, day: parts.day };
}

function dayMarker(value, timeZone) {
  const parts = zonedDay(value, timeZone);
  if (!parts) return null;
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return new Date(`${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T00:00:00.000Z`);
}

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const companies = await db
    .collection("companies")
    .find({}, { projection: { timeZone: 1 } })
    .toArray();
  const timeZoneByCompany = new Map();
  for (const company of companies) {
    timeZoneByCompany.set(String(company._id), resolveTimeZone(company.timeZone));
  }

  const users = await db
    .collection("users")
    .find({}, { projection: { company: 1 } })
    .toArray();
  const companyByUser = new Map();
  for (const user of users) {
    companyByUser.set(String(user._id), user.company ? String(user.company) : "");
  }

  const records = await db
    .collection("attendances")
    .find({}, { projection: { user: 1, date: 1, checkIn: 1 } })
    .toArray();

  let updated = 0;
  let unchanged = 0;
  let conflicts = 0;
  let skipped = 0;

  for (const record of records) {
    const companyId = companyByUser.get(String(record.user)) ?? "";
    const timeZone = timeZoneByCompany.get(companyId) ?? DEFAULT_TIME_ZONE;

    // The event time is the source of truth; `date` is only a fallback.
    const eventTime = record.checkIn || record.date;
    const target = dayMarker(eventTime, timeZone);
    if (!target) {
      skipped += 1;
      continue;
    }

    const stored = record.date instanceof Date ? record.date : new Date(record.date);
    if (stored.getTime() === target.getTime()) {
      unchanged += 1;
      continue;
    }

    // `{ user, date }` is unique. If moving this row would collide with an
    // existing row for the same user/day, leave it for a human instead of
    // throwing or silently dropping data.
    const clash = await db
      .collection("attendances")
      .findOne({ user: record.user, date: target, _id: { $ne: record._id } });
    if (clash) {
      conflicts += 1;
      console.warn(
        `  conflict: attendance ${record._id} (user ${record.user}) would collide with ${clash._id} on ${target.toISOString()}`,
      );
      continue;
    }

    try {
      await db
        .collection("attendances")
        .updateOne({ _id: record._id }, { $set: { date: target } });
      updated += 1;
    } catch (error) {
      if (error && error.code === 11000) {
        conflicts += 1;
        console.warn(`  conflict: attendance ${record._id} hit the unique { user, date } index`);
        continue;
      }
      throw error;
    }
  }

  console.log(
    `Attendance day backfill: ${updated} updated, ${unchanged} already correct, ` +
      `${conflicts} conflict(s) left untouched, ${skipped} skipped.`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
