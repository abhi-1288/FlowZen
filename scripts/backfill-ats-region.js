// One-off migration: backfill the region snapshot on existing ATS jobs and
// offers so the command center's region-scoped recruitment tiles have data to
// work with. Idempotent — safe to run more than once. Run with:
//   node scripts/backfill-ats-region.js
//
// A job has no member link to filter on, and `workflow.assignedHR` may be a
// regional head covering several offices, so a job's region comes from whoever
// raised it (`createdBy`) and an offer inherits it from its job. Both fall back
// to the creating user's own region and then to the company's main office,
// which is the same resolution order the write sites use at creation time.

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
  console.error("No MONGODB_URI / ATLAS_URI found in the environment.");
  process.exit(1);
}

/** Missing field and empty string both count as "not set yet". */
const UNSET_REGION = { $in: ["", null] };

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const companies = await db
    .collection("companies")
    .find({}, { projection: { addresses: 1, address: 1 } })
    .toArray();

  const mainOfficeByCompany = new Map();
  for (const company of companies) {
    const addresses = Array.isArray(company.addresses) ? company.addresses : [];
    const main = addresses.find((a) => a && a.isMain) ?? addresses[0];
    const label = String(main?.label ?? "").trim();
    if (label) {
      mainOfficeByCompany.set(String(company._id), label);
      continue;
    }
    const fallback = String(company.address ?? "").trim();
    mainOfficeByCompany.set(String(company._id), fallback ? "Main Office" : "");
  }

  // A member's effective region is their own label, else the main office.
  const members = await db
    .collection("users")
    .find(
      { companyStatus: "approved" },
      { projection: { company: 1, regionLabel: 1 } },
    )
    .toArray();

  const regionByUser = new Map();
  for (const member of members) {
    const own = String(member.regionLabel ?? "").trim();
    const main = mainOfficeByCompany.get(String(member.company)) ?? "";
    regionByUser.set(String(member._id), own || main);
  }

  const regionOf = (userId, companyId) => {
    const fromUser = userId ? regionByUser.get(String(userId)) : undefined;
    if (fromUser) return fromUser;
    return mainOfficeByCompany.get(String(companyId)) ?? "";
  };

  const jobs = await db
    .collection("atsjobs")
    .find(
      { regionLabel: UNSET_REGION },
      { projection: { company: 1, createdBy: 1, "workflow.requestedBy": 1 } },
    )
    .toArray();

  const jobRegion = new Map();
  let jobsUpdated = 0;
  for (const job of jobs) {
    const region = regionOf(job.workflow?.requestedBy, job.company) || regionOf(job.createdBy, job.company);
    jobRegion.set(String(job._id), region);
    await db
      .collection("atsjobs")
      .updateOne({ _id: job._id }, { $set: { regionLabel: region } });
    jobsUpdated += 1;
  }

  const offers = await db
    .collection("atsoffers")
    .find(
      { regionLabel: UNSET_REGION },
      { projection: { company: 1, job: 1, createdBy: 1 } },
    )
    .toArray();

  let offersUpdated = 0;
  let inherited = 0;
  for (const offer of offers) {
    const fromJob = offer.job ? jobRegion.get(String(offer.job)) : undefined;
    const region = fromJob ?? regionOf(offer.createdBy, offer.company);
    if (fromJob) inherited += 1;
    await db
      .collection("atsoffers")
      .updateOne({ _id: offer._id }, { $set: { regionLabel: region } });
    offersUpdated += 1;
  }

  console.log(
    `Backfilled ${jobsUpdated} job(s) and ${offersUpdated} offer(s) across ${companies.length} company(ies). ` +
      `${inherited} offer(s) inherited their region from the parent job.`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
