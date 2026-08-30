/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("crypto");
const mongoose = require("mongoose");

const PASS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createGuestPassCode(length = 6) {
  let code = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += PASS_ALPHABET[bytes[i] % PASS_ALPHABET.length];
  }
  return `FLOWZ-${code}`;
}

async function createUniquePassCode(collection, companyId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = createGuestPassCode();
    const existing = await collection.findOne({ company: companyId, passCode: code });
    if (!existing) return code;
  }
  return createGuestPassCode();
}

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/flowzen";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const interviews = db.collection("atsinterviews");
  const pending = await interviews
    .find({
      status: "scheduled",
      $or: [{ passCode: { $exists: false } }, { passCode: "" }],
      $and: [
        { meetingLink: { $in: [null, ""] } },
        { location: { $ne: "" } },
      ],
    })
    .toArray();

  let updated = 0;
  for (const interview of pending) {
    const companyId = interview.company;
    if (!companyId) continue;
    const code = await createUniquePassCode(interviews, companyId);
    await interviews.updateOne({ _id: interview._id }, { $set: { passCode: code } });
    updated++;
    console.log(`Backfilled pass code ${code} for interview ${interview._id}`);
  }

  if (updated === 0) {
    console.log("No in-person scheduled interviews are missing a guest pass code.");
  } else {
    console.log(`Backfilled ${updated} interview(s).`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });