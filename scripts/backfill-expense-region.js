// One-off migration: backfill the region/currency snapshot on existing expense
// requests so the new region-scoped reads and the IT-linked badge have data to
// work with. Idempotent — safe to run more than once. Run with:
//   node scripts/backfill-expense-region.js
//
// Existing rows keep their current behaviour (finance-routed); this only fills
// in the display snapshot and leaves `procurement` null.

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

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const companies = await db
    .collection("companies")
    .find({}, { projection: { addresses: 1, address: 1 } })
    .toArray();

  const regionByCompany = new Map();
  for (const company of companies) {
    const addresses = Array.isArray(company.addresses) ? company.addresses : [];
    const main = addresses.find((a) => a && a.isMain) ?? addresses[0];
    const label = String(main?.label ?? "").trim();
    if (label) {
      regionByCompany.set(String(company._id), label);
      continue;
    }
    const fallback = String(company.address ?? "").trim();
    regionByCompany.set(String(company._id), fallback ? "Main Office" : "");
  }

  const expenses = await db
    .collection("expenserequests")
    .find(
      { regionLabel: { $in: ["", null], $exists: false } },
      { projection: { company: 1, requester: 1 } },
    )
    .toArray();

  let updated = 0;
  for (const expense of expenses) {
    const companyId = String(expense.company);
    const region = regionByCompany.get(companyId) ?? "";
    await db.collection("expenserequests").updateOne(
      { _id: expense._id },
      {
        $set: {
          regionLabel: region,
          currency: "INR",
          procurement: null,
        },
      },
    );
    updated += 1;
  }

  console.log(`Backfilled ${updated} expense request(s) across ${companies.length} company(ies).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
