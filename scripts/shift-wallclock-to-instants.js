// One-off migration: convert wall-clock-shaped dates to true instants.
//
// The old contract stored the HR user's typed wall clock pinned to a fake `Z`
// ("2026-10-07T22:31:00Z" meaning 10:31 pm IST), so labels round-tripped the
// digits but every countdown and phase gate compared the value against real
// elapsed time — a 5h30m disagreement for anyone in IST. The new contract
// (lib/date-utils) interprets the entered wall clock as Asia/Kolkata and stores
// the real instant, so this script shifts every stored value BACK by 5h30m to
// preserve the wall clock HR typed: 10:31 pm stored as 22:31Z becomes 17:31Z,
// which reads back as 10:31 pm IST and ticks down correctly.
//
// Affected values (all written by the old form writers; the seed scripts do not
// touch these fields, so no cutoff is needed):
//   - atsjobs.autoCloseDate
//   - atsjobs.assessmentDate
//   - atsjobs.editApplicationsCloseAt
//   - atsassessments.mockTest.opensAt
//   - atsassessments.mockTest.closesAt
//
// Event history (started/submitted/invited stamps) is genuine elapsed time and
// is deliberately not touched.
//
// Candidates who already picked a uniform-mode slot did so against the old
// UTC-day windows; --slots shifts `assessmentSlotStart` the same way, but only
// for candidates who have not started the assessment (a started attempt's clock
// is anchored to real events and must not move).
//
// Usage:
//   node scripts/shift-wallclock-to-instants.js          # dry run, prints the plan
//   node scripts/shift-wallclock-to-instants.js --list   # counts only
//   node scripts/shift-wallclock-to-instants.js --apply  # write
//   node scripts/shift-wallclock-to-instants.js --apply --slots
//   node scripts/shift-wallclock-to-instants.js --apply --id=<jobId> [--id=<jobId> ...]
//
// Run it once, after deploying the code change and before HR relies on any
// schedule again. Re-running shifts the values a second time, so --apply on an
// already-migrated database is wrong.

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
const WITH_SLOTS = args.includes("--slots");
const ONLY_IDS = args.filter((a) => a.startsWith("--id=")).map((a) => a.slice("--id=".length));

// The stored digits were IST, so the real instant is 5h30m earlier. IST has no
// DST, so this is a constant.
const SHIFT_MS = -5.5 * 60 * 60 * 1000;

const JOB_FIELDS = ["autoCloseDate", "assessmentDate", "editApplicationsCloseAt"];
const MOCK_FIELDS = ["opensAt", "closesAt"];

function fmt(value) {
  if (!value && value !== 0) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "invalid";
  return d.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

function shift(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + SHIFT_MS);
}

function projection(fields) {
  return Object.fromEntries([...fields, "updatedAt"].map((f) => [f, 1]));
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const jobs = db.collection("atsjobs");
  const assessments = db.collection("atsassessments");
  const candidates = db.collection("atscandidates");

  const jobQuery = { $or: JOB_FIELDS.map((f) => ({ [f]: { $ne: null } })) };
  if (ONLY_IDS.length) jobQuery._id = { $in: ONLY_IDS.map((id) => new mongoose.Types.ObjectId(id)) };
  const mockQuery = { "mockTest.opensAt": { $ne: null } };
  const slotQuery = { assessmentSlotStart: { $ne: null }, assessmentStartedAt: null };

  if (LIST) {
    console.log("Jobs with wall-clock dates:      ", await jobs.countDocuments(jobQuery));
    console.log("Assessments with mock windows:   ", await assessments.countDocuments(mockQuery));
    console.log("Candidates with unstarted slots: ", WITH_SLOTS ? await candidates.countDocuments(slotQuery) : "(skipped, pass --slots)");
    await mongoose.disconnect();
    return;
  }

  console.log(`Shift: ${SHIFT_MS / 3600000} h on every listed value`);
  console.log("");

  const jobDocs = await jobs.find(jobQuery, { projection: projection(JOB_FIELDS) }).toArray();
  const jobOps = [];
  for (const doc of jobDocs) {
    const set = {};
    for (const field of JOB_FIELDS) {
      const next = shift(doc[field]);
      if (next && (!doc[field] || next.getTime() !== new Date(doc[field]).getTime())) {
        set[field] = next;
        console.log(`jobs/${doc._id}  ${field}  ${fmt(doc[field])} -> ${fmt(next)}`);
      }
    }
    if (Object.keys(set).length) jobOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
  }

  const mockDocs = await assessments
    .find(mockQuery, { projection: { "mockTest.opensAt": 1, "mockTest.closesAt": 1 } })
    .toArray();
  const mockOps = [];
  for (const doc of mockDocs) {
    const set = {};
    for (const field of MOCK_FIELDS) {
      const current = doc.mockTest?.[field];
      const next = shift(current);
      if (next && (!current || next.getTime() !== new Date(current).getTime())) {
        set[`mockTest.${field}`] = next;
        console.log(`assessments/${doc._id}  mockTest.${field}  ${fmt(current)} -> ${fmt(next)}`);
      }
    }
    if (Object.keys(set).length) mockOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
  }

  const slotOps = [];
  if (WITH_SLOTS) {
    const slotDocs = await candidates.find(slotQuery, { projection: { assessmentSlotStart: 1 } }).toArray();
    for (const doc of slotDocs) {
      const next = shift(doc.assessmentSlotStart);
      if (next && next.getTime() !== new Date(doc.assessmentSlotStart).getTime()) {
        console.log(`candidates/${doc._id}  assessmentSlotStart  ${fmt(doc.assessmentSlotStart)} -> ${fmt(next)}`);
        slotOps.push({
          updateOne: { filter: { _id: doc._id }, update: { $set: { assessmentSlotStart: next } } },
        });
      }
    }
  }

  const total = jobOps.length + mockOps.length + slotOps.length;
  console.log("");
  if (!APPLY) {
    console.log(`Dry run. ${jobOps.length} job(s), ${mockOps.length} assessment(s)` +
      (WITH_SLOTS ? `, ${slotOps.length} candidate(s)` : " (slots not included, pass --slots)") +
      ` would be updated. Re-run with --apply to write.`);
    await mongoose.disconnect();
    return;
  }

  if (total === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const results = [];
  if (jobOps.length) results.push(await jobs.bulkWrite(jobOps, { ordered: false }));
  if (mockOps.length) results.push(await assessments.bulkWrite(mockOps, { ordered: false }));
  if (slotOps.length) results.push(await candidates.bulkWrite(slotOps, { ordered: false }));
  console.log(
    "Applied. " +
      results
        .map((r) => `matched=${r.matchedCount} modified=${r.modifiedCount}`)
        .join("  ")
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
