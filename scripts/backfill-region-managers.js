// One-off migration: assign HR/Admin staff + heads to existing regions so every
// company region has an HR Head and Admin Head. Fill only when missing.
// Run once with:
//   node scripts/backfill-region-managers.js

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
  console.error("Missing MONGODB_URI / ATLAS_URI environment variable.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const companies = db.collection("companies");
  const users = db.collection("users");

  const docs = await companies
    .find({}, { projection: { name: 1, addresses: 1, addressManagers: 1 } })
    .toArray();

  let updated = 0;
  let skipped = 0;

  for (const company of docs) {
    const addresses = Array.isArray(company.addresses) ? company.addresses : [];
    if (addresses.length === 0) {
      skipped += 1;
      continue;
    }

    const memberUsers = await users
      .find({ company: company._id, companyStatus: "approved" }, { projection: { role: 1, name: 1 } })
      .toArray();

    const approvedAdmins = memberUsers
      .filter((u) => String(u.role) === "admin")
      .map((u) => String(u._id));
    const approvedHrs = memberUsers
      .filter((u) => String(u.role) === "human-resource")
      .map((u) => String(u._id));

    const managerIds = Array.isArray(company.addressManagers)
      ? company.addressManagers.map((id) => String(id))
      : [];

    let companyChanged = false;

    addresses.forEach((address, index) => {
      if (!address || typeof address !== "object") return;

      const currentHrHead = address.hrHead ? String(address.hrHead) : "";
      const currentAdminHead = address.adminHead ? String(address.adminHead) : "";

      let hrHead = currentHrHead;
      let adminHead = currentAdminHead;

      if (!hrHead) {
        hrHead =
          managerIds.find((id) => approvedHrs.includes(id)) ??
          approvedHrs[0] ??
          "";
      }
      if (!adminHead) {
        adminHead = approvedAdmins[0] ?? "";
      }

      if (!hrHead && !adminHead) return;

      const hrs = Array.isArray(address.hrs) && address.hrs.length > 0
        ? address.hrs.map(String)
        : hrHead
          ? [hrHead]
          : [];
      const admins = Array.isArray(address.admins) && address.admins.length > 0
        ? address.admins.map(String)
        : adminHead
          ? [adminHead]
          : [];
      const createdBy = address.createdBy
        ? String(address.createdBy)
        : hrHead || null;

      const prefix = `addresses.${index}.`;
      const setters = {};
      if (hrHead) setters[`${prefix}hrHead`] = hrHead;
      if (adminHead) setters[`${prefix}adminHead`] = adminHead;
      if (hrs.length > 0) setters[`${prefix}hrs`] = hrs;
      if (admins.length > 0) setters[`${prefix}admins`] = admins;
      if (createdBy) setters[`${prefix}createdBy`] = createdBy;

      updates.push({ id: company._id, setters });
      companyChanged = true;
    });

    if (companyChanged) {
      updated += 1;
      console.log("staffed regions:", company.name, `(${addresses.length} address(es))`);
    } else {
      skipped += 1;
    }
  }

  for (const u of updates) {
    await companies.updateOne({ _id: u.id }, { $set: u.setters });
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}.`);
  await mongoose.disconnect();
}

const updates = [];

main().catch((err) => {
  console.error(err);
  process.exit(1);
});