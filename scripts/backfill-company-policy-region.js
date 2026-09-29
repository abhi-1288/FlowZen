// One-off migration: make CompanyPolicy per-(company, region).
//
// CompanyPolicy gains a `region` field ("" = global fallback, non-empty = that
// region) and a unique { company, region } index. Existing docs have no `region`
// field, so they must be backfilled to "" before the unique index can be built
// — and a company with duplicate policy docs would violate the constraint.
//
// This script, for each company:
//   1. keeps the most-recently-updated policy doc as the global one,
//   2. sets its region to "",
//   3. deletes any duplicate policy docs for that company.
//
// Idempotent: re-running is a no-op once every company has exactly one
// global policy. Run once with:
//   node scripts/backfill-company-policy-region.js

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
  const policies = db.collection("companypolicies");

  const docs = await policies.find({}).toArray();
  const byCompany = new Map();
  for (const doc of docs) {
    const key = String(doc.company);
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(doc);
  }

  let companies = 0;
  let kept = 0;
  let removed = 0;
  let alreadyGlobal = 0;

  for (const [companyId, companyDocs] of byCompany) {
    companies += 1;
    // Most recently updated wins as the global policy.
    companyDocs.sort(
      (a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0),
    );
    const [keep, ...duplicates] = companyDocs;

    if (keep.region === "" && duplicates.length === 0) {
      alreadyGlobal += 1;
      continue;
    }

    await policies.updateOne(
      { _id: keep._id },
      { $set: { region: "" } },
    );
    kept += 1;

    if (duplicates.length > 0) {
      const dupIds = duplicates.map((d) => d._id);
      await policies.deleteMany({ _id: { $in: dupIds } });
      removed += duplicates.length;
      console.log(
        `company ${companyId}: kept ${keep._id} as global, removed ${duplicates.length} duplicate(s)`,
      );
    }
  }

  console.log(
    `\nDone. Companies: ${companies}, backfilled: ${kept}, already global: ${alreadyGlobal}, duplicates removed: ${removed}.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
