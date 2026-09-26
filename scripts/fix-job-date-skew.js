// One-off migration: undo the timezone skew on job wall clocks.
//
// The bug: three of the four form writers sent an offset-less ISO string
// ("2026-09-30T12:00:00"), which the API's `new Date(...)` parsed in the *server's*
// timezone. On an IST host that stored the instant 5h30m behind the wall clock the
// user actually typed, and every reader (which reads UTC) then showed 12:00 as
// 06:30. See lib/date-utils.ts for the contract that replaces it.
//
// Affected rows:
//   - every ATSJob.autoCloseDate written before the fix. Both the create/edit
//     modal and the old standalone edit page sent it without the `Z` suffix, so
//     this one is unconditionally skewed and is corrected by default.
//   - ATSJob.assessmentDate is *not* uniformly skewed: the modal already pinned
//     that field, only the standalone edit page did not, and there is no way to
//     tell from the stored value which path last wrote it. So it is opt-in via
//     --assessment, and you should only pass that for jobs you know were last
//     saved through the standalone page.
//
// Rows written *after* the fix are already correct and must not be touched, so
// this only shifts documents older than the cutoff below. Check the cutoff with
// --list before applying.
//
// Usage:
//   node scripts/fix-job-date-skew.js                    # dry run, prints the plan
//   node scripts/fix-job-date-skew.js --list             # count matching rows only
//   node scripts/fix-job-date-skew.js --apply            # write autoCloseDate only
//   node scripts/fix-job-date-skew.js --apply --assessment
//   node scripts/fix-job-date-skew.js --apply --id=<jobId> [--id=<jobId> ...]
//   node scripts/fix-job-date-skew.js --apply --cutoff=2026-09-21T17:41:25.000Z
//
// Rows whose autoCloseDate sits exactly on 00:00Z were not written by the form
// (the time input is never empty, and the no-time fallback is 23:59:59), so they
// are usually seed or import data and shifting them is wrong. Use --id to correct
// only the rows a form actually wrote.

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

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIST = args.includes("--list");
const WITH_ASSESSMENT = args.includes("--assessment");
const ONLY_IDS = args.filter((a) => a.startsWith("--id=")).map((a) => a.slice("--id=".length));

// Commit dd580c8 ("timezone fix") is when every reader became UTC. Anything
// written before it is suspect; anything after it went through the fixed code.
const DEFAULT_CUTOFF = "2026-09-21T17:41:25.000Z";
const cutoffArg = args.find((a) => a.startsWith("--cutoff="));
const CUTOFF = new Date(cutoffArg ? cutoffArg.split("=")[1] : DEFAULT_CUTOFF);
if (isNaN(CUTOFF.getTime())) {
  console.error(`Invalid --cutoff value.`);
  process.exit(1);
}

// The skew is exactly the host's UTC offset at the time of the bad write. On an
// IST host the user's 12:00 was stored as 06:30Z, so correcting means adding
// 5h30m back. `getTimezoneOffset()` returns the *negated* UTC offset (IST => -330),
// hence the extra negation.
const SKEW_MS = -new Date().getTimezoneOffset() * 60 * 1000;

function fmt(value) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "invalid";
  return d.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

function shift(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + SKEW_MS);
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const jobs = mongoose.connection.db.collection("atsjobs");

  const query = { updatedAt: { $lt: CUTOFF }, autoCloseDate: { $ne: null } };
  if (ONLY_IDS.length) query._id = { $in: ONLY_IDS.map((id) => new mongoose.Types.ObjectId(id)) };
  if (WITH_ASSESSMENT) {
    query.$or = [{ autoCloseDate: { $ne: null } }, { assessmentDate: { $ne: null } }];
  }

  if (LIST) {
    const total = await jobs.countDocuments(query);
    console.log(`Cutoff:            ${CUTOFF.toISOString()}`);
    console.log(`Offset correction: ${SKEW_MS} ms (${SKEW_MS / 3600000} h)`);
    console.log(`Jobs to inspect:   ${total}`);
    await mongoose.disconnect();
    return;
  }

  const docs = await jobs
    .find(query, { projection: { title: 1, autoCloseDate: 1, assessmentDate: 1, updatedAt: 1 } })
    .toArray();

  console.log(`Cutoff:            ${CUTOFF.toISOString()}`);
  console.log(`Offset correction: +${SKEW_MS} ms (+${(SKEW_MS / 3600000).toFixed(2)} h)`);
  console.log(`Jobs to inspect:   ${docs.length}`);
  console.log("");

  const ops = [];
  for (const doc of docs) {
    const nextAuto = shift(doc.autoCloseDate);
    const nextAssessment = WITH_ASSESSMENT ? shift(doc.assessmentDate) : null;
    if (!nextAuto && !nextAssessment) continue;

    const set = {};
    if (nextAuto) set.autoCloseDate = nextAuto;
    if (nextAssessment) set.assessmentDate = nextAssessment;
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });

    console.log(`  ${doc.title}`);
    console.log(`    id              ${doc._id}`);
    console.log(`    autoCloseDate   ${fmt(doc.autoCloseDate)}  ->  ${fmt(nextAuto)}`);
    console.log(
      `    assessmentDate  ${fmt(doc.assessmentDate)}  ->  ${
        WITH_ASSESSMENT ? fmt(nextAssessment) : "unchanged (pass --assessment to shift)"
      }`
    );
    console.log(`    last updated    ${fmt(doc.updatedAt)}`);
  }

  console.log("");
  if (!APPLY) {
    console.log(`Dry run. ${ops.length} job(s) would be updated. Re-run with --apply to write.`);
    await mongoose.disconnect();
    return;
  }

  if (ops.length === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const result = await jobs.bulkWrite(ops, { ordered: false });
  console.log(
    `Applied. matched=${result.matchedCount} modified=${result.modifiedCount}`
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
