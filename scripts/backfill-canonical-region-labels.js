/* eslint-disable @typescript-eslint/no-require-imports */
// One-off repair: rewrite stored main-office region labels that were saved as
// the *display* string ("Uttarakhand Region (Main Office)") back to the canonical
// office label ("Uttarakhand Region").
//
// Region-scoped queries match `addresses[].label`; the display helper adds the
// "(Main Office)" suffix. A member whose stored label contains that suffix looks
// correct in their profile but is invisible to every region-scoped list, which
// is why an HR admin tile can read 0 while the admin's own view reads 1.
//
// Idempotent — safe to run more than once. Run with:
//   node scripts/backfill-canonical-region-labels.js

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

const REASON =
  "Stored label included the main-office display suffix; canonicalised so region-scoped lists include this member.";

function mainOfficeLabelOf(company) {
  const addresses = Array.isArray(company.addresses) ? company.addresses : [];
  const main = addresses.find((a) => Boolean(a && a.isMain));
  const label = String((main ?? addresses[0])?.label ?? "").trim();
  if (label) return label;
  return String(company.address ?? "").trim() ? "Main Office" : "";
}

async function main() {
  const uri = process.env.NODE_ENV === "production" ? process.env.ATLAS_URI : process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI (or ATLAS_URI in production) is not set.");
  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  const companies = await db.collection("companies").find({}).toArray();
  let fixed = 0;

  for (const company of companies) {
    const mainLabel = mainOfficeLabelOf(company);
    if (!mainLabel) continue;
    const displayLabel = `${mainLabel} (Main Office)`.toLowerCase();

    const users = await db
      .collection("users")
      .find({ company: company._id, regionLabel: { $ne: "" } })
      .project({ name: 1, regionLabel: 1 })
      .toArray();

    for (const user of users) {
      const label = String(user.regionLabel ?? "").trim();
      if (label.toLowerCase() !== displayLabel) continue;
      await db.collection("users").updateOne(
        { _id: user._id },
        {
          $set: { regionLabel: mainLabel },
          $push: {
            membershipHistory: {
              company: company._id,
              action: "region-corrected",
              at: new Date(),
              fromRegionLabel: label,
              toRegionLabel: mainLabel,
              reason: REASON,
            },
          },
        },
      );
      console.log(`  user     ${String(user.name ?? "").slice(0, 40)}: "${label}" -> "${mainLabel}"`);
      fixed += 1;
    }
  }

  console.log(`\nCanonicalised ${fixed} stored region label(s). Companies scanned: ${companies.length}.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
