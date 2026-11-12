// One-off backfill: ensure every board has the eight standard columns
// (Todo, Taken, In Progress, Blocked, Decision & Dependency, Risks, Done,
// Expired-due). Boards created before the column-set change only have the
// original four (Todo, In Progress, Done, Expired-due), so the new workflow
// tabs are missing for them. This inserts the missing ones in the canonical
// order and re-numbers the rest, while preserving any custom columns the
// owner added (they move to the end, keeping their relative order).
//
// Idempotent — safe to run more than once. Run with:
//   node scripts/backfill-board-columns.js
//
// Requires MONGODB_URI in the environment (loaded from .env.local if present).

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

const DESIRED = [
  "Todo",
  "Taken",
  "In Progress",
  "Blocked",
  "Decision & Dependency",
  "Risks",
  "Done",
  "Expired-due",
];
const DESIRED_NORM = new Set(DESIRED.map(nm));

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const boards = await db.collection("boards").find({}).toArray();
  console.log(`Scanning ${boards.length} boards...`);

  let boardsTouched = 0;
  let columnsInserted = 0;

  for (const board of boards) {
    const cols = await db
      .collection("columns")
      .find({ board: board._id })
      .sort({ order: 1, _id: 1 })
      .toArray();

    const byTitle = new Map();
    for (const c of cols) byTitle.set(nm(c.title), c);

    const missing = DESIRED.filter((t) => !byTitle.has(nm(t)));
    if (missing.length === 0 && cols.length === DESIRED.length) {
      // Already canonical-ish; still re-number to be safe only if order differs.
      const alreadyOrdered = cols.every((c, i) => nm(c.title) === nm(DESIRED[i] ?? c.title));
      if (alreadyOrdered) continue;
    }

    // Insert missing desired columns (temporary order; renumbered below).
    for (const title of missing) {
      const idx = DESIRED.indexOf(title);
      await db.collection("columns").insertOne({
        board: board._id,
        title,
        order: idx,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      columnsInserted += 1;
    }

    // Re-read after inserts.
    const allCols = await db
      .collection("columns")
      .find({ board: board._id })
      .sort({ order: 1, _id: 1 })
      .toArray();

    const byTitle2 = new Map();
    for (const c of allCols) byTitle2.set(nm(c.title), c);

    // Build canonical order: desired first (in order), then custom columns.
    const ordered = [];
    for (const t of DESIRED) {
      const c = byTitle2.get(nm(t));
      if (c) ordered.push(c);
    }
    for (const c of allCols) {
      if (!DESIRED_NORM.has(nm(c.title))) ordered.push(c);
    }

    // Renumber.
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].order !== i) {
        await db.collection("columns").updateOne({ _id: ordered[i]._id }, { $set: { order: i } });
      }
    }

    boardsTouched += 1;
    console.log(
      `  board "${board.title}" (${board._id}): inserted [${missing.join(", ")}], now ${ordered.length} columns`,
    );
  }

  console.log(`\nDone. Boards touched: ${boardsTouched}. Columns inserted: ${columnsInserted}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
