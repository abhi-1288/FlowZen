// One-off backfill: clear `regionLabel`s left over from offices that were
// renamed or deleted before propagation existed.
//
// Whenever an office's label changes, `PATCH /api/company/address` now rewrites
// every copy of the name (`User.regionLabel`, policies, identity-code ranges,
// etc. — see lib/region-rename.ts). Companies that renamed before that fix have
// members, ATS records and expense/procurement snapshots still pointing at a
// label that matches no office, which makes the org chart drop the region's
// heads and stops region-scoped queries from matching those members.
//
// An old->new mapping is unknowable after the fact, so this cannot guess where
// a renamed region's people now belong. It only clears labels that match no
// current office back to "" (the read-side main-office fallback), and logs a
// `region-corrected` history entry per member so the change is reviewable.
// Admin config (holidays, salary policies, identity-code ranges) is left
// untouched rather than guessed at.
//
// Idempotent — safe to run more than once. Run with:
//   node scripts/backfill-stale-region-labels.js

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

const nm = (v) => String(v ?? "").trim().toLowerCase();
const REASON =
  "Region/office no longer exists; stale label cleared so the member falls back to the main office.";

async function clearStale(collectionName, company, validNorms, field) {
  const exists = await mongoose.connection.db.listCollections({ name: collectionName }).hasNext();
  if (!exists) return 0;
  const docs = await mongoose.connection.db
    .collection(collectionName)
    .find({ company: company._id, [field]: { $ne: "" } })
    .project({ [field]: 1 })
    .toArray();

  let fixed = 0;
  for (const doc of docs) {
    if (validNorms.has(nm(doc[field]))) continue;
    await mongoose.connection.db
      .collection(collectionName)
      .updateOne({ _id: doc._id }, { $set: { [field]: "" } });
    fixed += 1;
  }
  return fixed;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const companies = await db.collection("companies").find({}).toArray();

  let usersFixed = 0;
  let snapshotsFixed = 0;

  for (const company of companies) {
    const addresses = Array.isArray(company.addresses) ? company.addresses : [];
    const validNorms = new Set(addresses.map((a) => nm(a && a.label)).filter(Boolean));

    // Members holding a label that matches no current office.
    const users = await db
      .collection("users")
      .find({ company: company._id, regionLabel: { $ne: "" } })
      .project({ name: 1, regionLabel: 1 })
      .toArray();

    for (const user of users) {
      if (validNorms.has(nm(user.regionLabel))) continue;
      await db.collection("users").updateOne(
        { _id: user._id },
        {
          $set: { regionLabel: "" },
          $push: {
            membershipHistory: {
              company: company._id,
              action: "region-corrected",
              at: new Date(),
              fromRegionLabel: String(user.regionLabel ?? ""),
              toRegionLabel: "",
              reason: REASON,
            },
          },
        },
      );
      console.log(`  user     ${String(user.name ?? "").slice(0, 40)}: "${user.regionLabel}" -> ""`);
      usersFixed += 1;
    }

    // Operational / display snapshots that snapshot the office label.
    for (const [collection, field] of [
      ["expenserequests", "regionLabel"],
      ["procurementrequests", "regionLabel"],
      ["atsjobs", "regionLabel"],
      ["atsoffers", "regionLabel"],
      ["atsinterviews", "region"],
      ["visitorpasses", "region"],
      ["atscandidates", "joiningRegionLabel"],
    ]) {
      snapshotsFixed += await clearStale(collection, company, validNorms, field);
    }
  }

  console.log(
    `\nCleared ${usersFixed} member regionLabel(s) and ${snapshotsFixed} stale snapshot field(s). Companies scanned: ${companies.length}.`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});