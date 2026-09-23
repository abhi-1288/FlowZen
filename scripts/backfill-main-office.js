// One-off migration: mark the first address as the main office for companies
// whose addresses[] have no explicit isMain entry. Run once with:
//   node scripts/backfill-main-office.js

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

  const docs = await companies
    .find({}, { projection: { name: 1, addresses: 1 } })
    .toArray();

  let updated = 0;
  let skipped = 0;

  for (const company of docs) {
    const addresses = Array.isArray(company.addresses) ? company.addresses : [];
    if (addresses.length === 0) {
      skipped += 1;
      continue;
    }
    const hasExplicitMain = addresses.some((a) => Boolean(a && a.isMain));
    if (hasExplicitMain) {
      skipped += 1;
      continue;
    }
    const first = addresses[0];
    first.isMain = true;
    await companies.updateOne(
      { _id: company._id },
      { $set: { "addresses.0.isMain": true } }
    );
    updated += 1;
    console.log("marked main office:", company.name, "->", first.label ?? "(no label)");
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});