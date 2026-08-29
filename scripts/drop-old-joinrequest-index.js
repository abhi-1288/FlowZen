// One-off migration: drop the old unique index that prevented multiple pending
// document-letter requests per user (of any type). Run once with:
//   node scripts/drop-old-joinrequest-index.js
// After this, the new index (which includes metadata.letterType) is created
// automatically by Mongoose on next app start.

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

const OLD_INDEX_NAME = "requester_1_company_1_kind_1_status_1";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const collection = db.collection("joinrequests");

  const indexes = await collection.indexes();
  const exists = indexes.some((idx) => idx.name === OLD_INDEX_NAME);

  if (!exists) {
    console.log(`Index "${OLD_INDEX_NAME}" not found — nothing to drop.`);
  } else {
    await collection.dropIndex(OLD_INDEX_NAME);
    console.log(`Dropped index "${OLD_INDEX_NAME}".`);
  }

  // Ensure the new per-letterType unique index exists (Mongoose also creates it
  // on app start, but this makes the migration order-independent).
  const NEW_INDEX_NAME = "requester_1_company_1_kind_1_metadata.letterType_1_status_1";
  const newExists = indexes.some((idx) => idx.name === NEW_INDEX_NAME);
  if (!newExists) {
    await collection.createIndex(
      { requester: 1, company: 1, kind: 1, "metadata.letterType": 1, status: 1 },
      { unique: true, partialFilterExpression: { status: "pending" }, name: NEW_INDEX_NAME },
    );
    console.log(`Created index "${NEW_INDEX_NAME}".`);
  } else {
    console.log(`Index "${NEW_INDEX_NAME}" already exists.`);
  }
}

main()
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
