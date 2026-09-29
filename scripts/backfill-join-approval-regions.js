// One-off migration: correct members whose `regionLabel` was stamped from the
// WRONG person when their join request was approved. Idempotent. Run with:
//
//   node scripts/backfill-join-approval-regions.js [--dry-run]
//
// THE BUG THIS FIXES
//
// `app/api/approvals/[id]/route.ts` used to copy the *approver's* region onto the
// new employee. A join request named the converting HR as approver, so a Pune HR
// head converting a candidate whose offer said Noida produced an employee filed
// under Pune. The region now comes from `metadata.regionLabel`, validated against
// the company's offices.
//
// This script repairs the records that bug already produced, for members whose
// join request still carries the evidence needed to prove it:
//
//   JoinRequest.metadata.convertedFromCandidate -> ATSCandidate -> ATSOffer.regionLabel
//
// A member is only touched when that chain yields an office label that matches
// one of their company's real offices AND differs from their current region. A
// member whose region already matches is left alone, and one with no usable
// evidence is reported rather than guessed at. Every change is written to
// `membershipHistory` so the correction is visible on the member's profile.

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const DRY_RUN = process.argv.includes("--dry-run");

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
  console.error("No MONGODB_URI / ATLAS_URI found in the environment.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const companies = await db
    .collection("companies")
    .find({}, { projection: { addresses: 1, name: 1 } })
    .toArray();
  const labelsByCompany = new Map();
  for (const company of companies) {
    const addresses = Array.isArray(company.addresses) ? company.addresses : [];
    const map = new Map();
    for (const address of addresses) {
      const label = String(address?.label ?? "").trim();
      if (label) map.set(label.toLowerCase(), label);
    }
    labelsByCompany.set(String(company._id), map);
  }

  // Office labels per company, keyed case-insensitively and mapped to the label
  // as the company actually spells it, so the backfilled member region matches
  // `regionEntryOf` and the rest of the region code rather than the loose casing
  // found in the source row.
  const canonical = (companyId, value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const known = labelsByCompany.get(String(companyId));
    if (!known) return "";
    return known.get(raw.toLowerCase()) || "";
  };

  const requests = await db
    .collection("joinrequests")
    .find(
      { "metadata.convertedFromCandidate": { $exists: true, $nin: [null, ""] } },
      {
        projection: {
          requester: 1,
          company: 1,
          status: 1,
          approver: 1,
          "metadata.convertedFromCandidate": 1,
        },
      },
    )
    .toArray();

  // Only approved joins produced an employee, so only those can be mis-filed.
  const approved = requests.filter((r) => String(r.status ?? "") === "approved");
  const skippedStatus = requests.length - approved.length;

  const candidates = await db
    .collection("atscandidates")
    .find(
      {},
      { projection: { firstName: 1, lastName: 1, joiningRegionLabel: 1, company: 1 } },
    )
    .toArray();
  const candidateById = new Map(candidates.map((c) => [String(c._id), c]));

  const offers = await db
    .collection("atsoffers")
    .find(
      { regionLabel: { $nin: ["", null] } },
      { projection: { candidate: 1, company: 1, regionLabel: 1, status: 1 } },
    )
    .toArray();
  // An accepted offer is the only offer that proves where the hire actually
  // landed. A candidate can hold several — a recalled draft, a regenerated
  // offer — and taking whichever came last in natural collection order would
  // file the member under whichever region happened to be written most recently.
  // Accepted wins outright; otherwise fall back to the first offer seen, so the
  // result is stable across runs rather than order-dependent.
  const offerRegionByCandidate = new Map();
  const fallbackRegionByCandidate = new Map();
  for (const offer of offers) {
    if (!offer.candidate) continue;
    const key = String(offer.candidate);
    const accepted = String(offer.status ?? "") === "accepted";
    if (accepted) {
      if (!offerRegionByCandidate.has(key)) offerRegionByCandidate.set(key, offer.regionLabel);
    } else if (!fallbackRegionByCandidate.has(key)) {
      fallbackRegionByCandidate.set(key, offer.regionLabel);
    }
  }
  for (const [key, region] of fallbackRegionByCandidate) {
    if (!offerRegionByCandidate.has(key)) offerRegionByCandidate.set(key, region);
  }

  const requesterIds = approved.map((r) => r.requester).filter(Boolean);
  const members = requesterIds.length
    ? await db
        .collection("users")
        .find(
          { _id: { $in: requesterIds } },
          { projection: { name: 1, email: 1, regionLabel: 1, company: 1 } },
        )
        .toArray()
    : [];
  const memberById = new Map(members.map((m) => [String(m._id), m]));

  // One pass per member. A member can hold more than one approved join request
  // (re-submitted after an earlier one was rejected), and correcting the same
  // `users` row twice would push a duplicate `membershipHistory` entry and
  // double-count it as "already correct" on the second visit.
  const approvedByRequester = new Map();
  for (const request of approved) {
    const key = String(request.requester ?? "");
    if (key && !approvedByRequester.has(key)) approvedByRequester.set(key, request);
  }

  let corrected = 0;
  let alreadyCorrect = 0;
  let missingMember = 0;
  const noEvidence = [];
  const details = [];

  for (const request of approvedByRequester.values()) {
    const member = memberById.get(String(request.requester));
    if (!member) {
      missingMember += 1;
      continue;
    }

    const companyId = request.company ?? member.company;
    const candidateId = String(request.metadata?.convertedFromCandidate ?? "");
    const candidate = candidateById.get(candidateId);

    // Offer region first (what the hire actually agreed to), then the
    // candidate's transferred region for anyone converted without an offer on
    // file.
    const offerRegion = canonical(
      companyId,
      offerRegionByCandidate.get(candidateId),
    );
    const candidateRegion = canonical(companyId, candidate?.joiningRegionLabel);
    const expected = offerRegion || candidateRegion;

    if (!expected) {
      noEvidence.push({ member, candidateId });
      continue;
    }

    const current = String(member.regionLabel ?? "").trim();
    if (current.toLowerCase() === expected.toLowerCase()) {
      alreadyCorrect += 1;
      continue;
    }

    details.push({
      member,
      from: current,
      to: expected,
      source: offerRegion ? "offer" : "candidate transfer",
    });

    if (!DRY_RUN) {
      await db.collection("users").updateOne(
        { _id: member._id },
        {
          $set: { regionLabel: expected },
          $push: {
            membershipHistory: {
              company: companyId,
              action: "region-corrected",
              at: new Date(),
              // Field names must match `membershipHistory` in `models/User.ts`.
              // That sub-schema is strict, so anything else is silently stripped
              // on write and the correction becomes untraceable.
              fromRegionLabel: current,
              toRegionLabel: expected,
              reason: "Join approval had copied the approver's region",
            },
          },
        },
      );
    }
    corrected += 1;
  }

  const mode = DRY_RUN ? " (dry run — nothing written)" : "";
  console.log(
    `Checked ${approvedByRequester.size} member(s) from ${approved.length} approved converted join(s) ` +
      `across ${companies.length} company(ies).${mode}\n` +
      `  region corrected : ${corrected}\n` +
      `  already correct  : ${alreadyCorrect}\n` +
      `  no evidence      : ${noEvidence.length}\n` +
      `  member gone      : ${missingMember}\n` +
      `${skippedStatus} non-approved request(s) ignored — they never created a member.`,
  );

  if (details.length > 0) {
    console.log("\nCorrections:");
    for (const d of details) {
      console.log(
        `    ${d.member.name || d.member.email || d.member._id}: ` +
          `"${d.from || "(empty)"}" -> "${d.to}" (from ${d.source})`,
      );
    }
  }

  if (noEvidence.length > 0) {
    console.log(
      `\n${noEvidence.length} member(s) had no office label on the linked offer or candidate. ` +
        `They were left untouched — set their region by hand if it is wrong.`,
    );
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
