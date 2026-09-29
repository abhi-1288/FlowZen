// One-off migration: repoint members whose `regionLabel` is the legacy
// "Main Office" placeholder at the office that is actually the main office.
//
// `mainOfficeLabelOf` (lib/company-regions.ts) returns the literal "Main Office"
// for a company that predates `addresses[]` and only carries the legacy
// `address` string. Members assigned a region back then got that string stored,
// and when the real office was later created and named, their label was left
// pointing at nothing. A label that matches no office makes the profile org
// chart drop the region's HR/admin head and stops region-scoped finance and
// approval queries from matching the member.
//
// Idempotent — safe to run more than once. Run with:
//   node scripts/backfill-legacy-region-labels.js

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

const LEGACY = "main office";

/** Mirrors mainOfficeLabelOf + regionEntryOf, kept local so the script has no app imports. */
function resolveTargetLabel(company) {
  const addresses = Array.isArray(company.addresses) ? company.addresses : [];
  const main = addresses.find((a) => a && a.isMain) ?? addresses[0];
  const label = String((main && main.label) ?? "").trim();
  if (label) return label;
  return String(company.address ?? "").trim() ? "Main Office" : "";
}

function isPlaceholder(company, label) {
  if (String(label).trim().toLowerCase() !== LEGACY) return false;
  const actual = resolveTargetLabel(company);
  return Boolean(actual) && actual.toLowerCase() !== LEGACY;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const companies = await db.collection("companies").find({}).toArray();
  const byId = new Map(companies.map((c) => [String(c._id), c]));

  let userFixed = 0;
  let snapshotFixed = 0;

  for (const company of companies) {
    const target = resolveTargetLabel(company);
    if (!target) continue;

    // Members still carrying the placeholder.
    const users = await db
      .collection("users")
      .find({ company: company._id, regionLabel: { $in: ["Main Office", "main office"] } })
      .project({ name: 1, regionLabel: 1 })
      .toArray();

    for (const user of users) {
      if (!isPlaceholder(company, user.regionLabel)) continue;
      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: { regionLabel: target } },
      );
      console.log(`  user    ${user.name}: "${user.regionLabel}" -> "${target}"`);
      userFixed += 1;
    }

    // The display snapshots written by the expense/procurement region scoping.
    for (const collection of ["expenserequests", "procurementrequests"]) {
      const exists = await db.listCollections({ name: collection }).hasNext();
      if (!exists) continue;
      const docs = await db
        .collection(collection)
        .find({ company: company._id, regionLabel: { $in: ["Main Office", "main office"] } })
        .project({ regionLabel: 1 })
        .toArray();
      for (const doc of docs) {
        if (!isPlaceholder(company, doc.regionLabel)) continue;
        await db
          .collection(collection)
          .updateOne({ _id: doc._id }, { $set: { regionLabel: target } });
        snapshotFixed += 1;
      }
    }
  }

  console.log(
    `\nRepointed ${userFixed} member(s) and ${snapshotFixed} record snapshot(s). Companies scanned: ${companies.length}.`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
