// Backfill sweep: delete signalling data for interviews that are already over.
//
// The per-interview purge added to the feedback and interview PATCH endpoints only
// helps going forward. This clears the rooms that accumulated before it existed —
// on Firebase every offer, answer, ICE candidate and `bye` is `push()`ed into
// `flowzen-signals/<roomId>` and nothing else ever deleted them, so a completed
// interview leaves that data behind indefinitely.
//
// It intersects the room keys that actually exist in the Realtime Database with
// the interviews that are terminal, rather than issuing a DELETE per historical
// interview, so the run stays bounded and never touches a live room.
//
// Dry run by default. Read the output, then re-run with --apply.
//
// Usage:
//   node scripts/purge-signaling-rooms.js --list     # what exists, what would go
//   node scripts/purge-signaling-rooms.js           # dry run, per-room detail
//   node scripts/purge-signaling-rooms.js --apply   # delete the matched rooms
//
// Keys with data but no terminal interview are reported as orphans and never
// deleted automatically — decide on those separately.

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

// Kept in step with lib/signaling/types.ts. Mirrored as a literal because this is
// a plain CommonJS script and cannot import the TypeScript module.
const PROVIDER = (process.env.NEXT_PUBLIC_SIGNALING_PROVIDER || "supabase").trim().toLowerCase();
const SIGNAL_ROOT = "flowzen-signals";
const TERMINAL_STATUSES = ["completed", "cancelled"];
const REQUEST_TIMEOUT_MS = 5000;

function databaseUrl() {
  return (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "").trim().replace(/\/+$/, "");
}

function fmtDate(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "invalid";
  return date.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

async function listRoomIds() {
  const base = databaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_FIREBASE_DATABASE_URL is not configured.");
  const response = await fetch(`${base}/${SIGNAL_ROOT}.json?shallow=true`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Realtime Database responded ${response.status} ${response.statusText}`);
  }
  const body = await response.json();
  return body ? Object.keys(body) : [];
}

async function deleteRoom(roomId) {
  const base = databaseUrl();
  const response = await fetch(`${base}/${SIGNAL_ROOT}/${roomId}.json`, {
    method: "DELETE",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
}

async function main() {
  if (PROVIDER !== "firebase") {
    console.log(`Signalling provider is "${PROVIDER}".`);
    console.log("Realtime Broadcast is not persisted, so there is nothing to purge —");
    console.log("presence is released by the client when it disconnects. Nothing to do.");
    return;
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const interviews = mongoose.connection.db.collection("atsinterviews");

  const roomIds = await listRoomIds();
  const terminal = await interviews
    .find(
      { status: { $in: TERMINAL_STATUSES }, videoRoomTokenHash: { $nin: ["", null] } },
      { projection: { videoRoomTokenHash: 1, roundType: 1, status: 1, scheduledAt: 1, updatedAt: 1, candidate: 1 } }
    )
    .toArray();

  const byRoom = new Map();
  for (const doc of terminal) {
    if (doc.videoRoomTokenHash) byRoom.set(String(doc.videoRoomTokenHash), doc);
  }

  const matched = [];
  const orphaned = [];
  for (const roomId of roomIds) {
    const doc = byRoom.get(roomId);
    if (doc) matched.push({ roomId, doc });
    else orphaned.push(roomId);
  }

  console.log(`Provider:             firebase`);
  console.log(`Rooms in RTDB:        ${roomIds.length}`);
  console.log(`Terminal interviews:  ${terminal.length} (${TERMINAL_STATUSES.join(", ")})`);
  console.log(`Would delete:         ${matched.length}`);
  console.log(`Orphans (left alone): ${orphaned.length}`);
  console.log("");

  if (!matched.length && !orphaned.length) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  if (LIST) {
    for (const { roomId, doc } of matched) {
      console.log(`  [delete] ${roomId}  ${doc.roundType} · ${doc.status} · updated ${fmtDate(doc.updatedAt)}`);
    }
    for (const roomId of orphaned) {
      console.log(`  [orphan] ${roomId}  no terminal interview matches this room`);
    }
    await mongoose.disconnect();
    return;
  }

  console.log("Candidates for deletion:");
  for (const { roomId, doc } of matched) {
    console.log(`  ${doc.roundType} · ${doc.status} · scheduled ${fmtDate(doc.scheduledAt)} · updated ${fmtDate(doc.updatedAt)}`);
    console.log(`    room ${roomId}`);
  }
  console.log("");

  if (orphaned.length) {
    console.log("Orphans — signalling data with no terminal interview. NOT deleted:");
    for (const roomId of orphaned) console.log(`  ${roomId}`);
    console.log("");
  }

  if (!APPLY) {
    console.log(`Dry run. ${matched.length} room(s) would be deleted. Re-run with --apply to write.`);
    await mongoose.disconnect();
    return;
  }

  let deleted = 0;
  const failed = [];
  for (const { roomId } of matched) {
    try {
      await deleteRoom(roomId);
      deleted += 1;
      console.log(`  deleted ${roomId}`);
    } catch (error) {
      failed.push({ roomId, message: error instanceof Error ? error.message : String(error) });
      console.log(`  FAILED  ${roomId}: ${failed[failed.length - 1].message}`);
    }
  }

  console.log("");
  console.log(`Deleted ${deleted}, failed ${failed.length}.`);
  if (failed.length) {
    console.log("A failure is usually Realtime Database security rules rejecting the DELETE.");
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
