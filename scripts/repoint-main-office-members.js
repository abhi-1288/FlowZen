// One-off repair: re-point members to the main office after its label was
// renamed/updated.
//
// `scripts/backfill-stale-region-labels.js` clears `regionLabel`s that match no
// current office to "" (the read-side main-office fallback). When the stale
// label belonged to the office that is now the main office — e.g. an admin
// renamed it before propagation existed — the cleared member should land on the
// NEW main-office label, not stay empty. This finds exactly those members (empty
// `regionLabel` + a `region-corrected` history entry that cleared them) and
// re-points them to the current main-office label from `addresses[]`.
//
// Members that were never assigned a region (no `region-corrected` entry) are
// left as "" on purpose. Idempotent — safe to run more than once. Run with:
//   node scripts/repoint-main-office-members.js

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = t.slice(i + 1).trim();
  }
}

loadEnvLocal();

const REASON =
  "Main office's label was renamed/updated; re-pointed from an empty label to the current main office.";

function mainOfficeLabelOf(company) {
  const addresses = Array.isArray(company.addresses) ? company.addresses : [];
  const main = addresses.find((a) => Boolean(a && a.isMain));
  const label = String((main ?? addresses[0])?.label ?? "").trim();
  if (label) return label;
  return String(company.address ?? "").trim() ? "Main Office" : "";
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const companies = await db.collection("companies").find({}).toArray();
  let fixed = 0;

  for (const company of companies) {
    const mainLabel = mainOfficeLabelOf(company);
    if (!mainLabel) continue;

    const users = await db
      .collection("users")
      .find({
        company: company._id,
        regionLabel: "",
        membershipHistory: {
          $elemMatch: { action: "region-corrected", toRegionLabel: "" },
        },
      })
      .project({ name: 1 })
      .toArray();

    for (const user of users) {
      await db.collection("users").updateOne(
        { _id: user._id },
        {
          $set: { regionLabel: mainLabel },
          $push: {
            membershipHistory: {
              company: company._id,
              action: "region-corrected",
              at: new Date(),
              fromRegionLabel: "",
              toRegionLabel: mainLabel,
              reason: REASON,
            },
          },
        },
      );
      console.log(`  user     ${String(user.name ?? "").slice(0, 40)}: "" -> "${mainLabel}"`);
      fixed += 1;
    }
  }

  console.log(`\nRe-pointed ${fixed} member(s) to their main office. Companies scanned: ${companies.length}.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});