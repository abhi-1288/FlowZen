/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only diagnostic for "HR sees Admin = 0 but the admin sees themselves".
// Prints the fields that decide region scope and the audit actions that could
// have removed the member. Nothing is written. Run with:
//   node scripts/diagnose-member-region.js admin@flowzen.com

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!(key in process.env)) {
      process.env[key] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();

async function main() {
  const email = String(process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("Pass the member email, e.g. node scripts/diagnose-member-region.js admin@flowzen.com");
  const uri = process.env.NODE_ENV === "production" ? process.env.ATLAS_URI : process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI (or ATLAS_URI in production) is not set.");
  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  const user = await db.collection("users").findOne(
    { email },
    { projection: { name: 1, email: 1, role: 1, company: 1, companyStatus: 1, regionLabel: 1, customRole: 1 } },
  );
  if (!user) {
    console.log(`No user found for ${email}.`);
    await mongoose.disconnect();
    return;
  }
  console.log("Member:", JSON.stringify(user, null, 2));

  const company = user.company
    ? await db.collection("companies").findOne(
        { _id: user.company },
        { projection: { name: 1, owner: 1, address: 1, addresses: 1 } },
      )
    : null;
  console.log("Company:", JSON.stringify(company, null, 2));

  const audits = await db
    .collection("auditlogs")
    .find({
      $or: [{ target: user._id }, { actor: user._id }],
      action: { $in: ["data.document.revoke", "member.terminated", "approval.approve", "approval.reject"] },
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  console.log(
    "Relevant audits:",
    JSON.stringify(
      audits.map((a) => ({
        at: a.createdAt,
        action: a.action,
        actionLabel: a.actionLabel,
        metadata: a.metadata,
      })),
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
