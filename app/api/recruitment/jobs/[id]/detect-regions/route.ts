import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { extractResumeText } from "@/lib/ats-scorer";
import { closestRegionOf, fixedRegionLabel } from "@/lib/candidate-region";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];
const TERMINAL_STAGES = ["ats-rejected", "rejected"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  const body = await request.json().catch(() => ({}));
  const onlyMissing = body.onlyMissing === true;

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("_id title location");
  if (!job) return jsonError("Job not found.", 404);

  const company = (await Company.findById(user.company).select("addresses multiOffice").lean()) as any;
  const regions = Array.isArray(company?.addresses) ? (company.addresses as any[]) : [];

  if (fixedRegionLabel((job as any).location, regions)) {
    return NextResponse.json({ skipped: true, total: 0, detected: 0, errors: 0 });
  }

  const query: Record<string, unknown> = {
    job: job._id,
    company: user.company,
    stage: { $nin: TERMINAL_STAGES },
  };
  if (onlyMissing) query.regionLabel = "";
  const candidates = await ATSCandidate.find(query)
    .select("_id address resumeUrl regionLabel")
    .lean();

  let detected = 0;
  let errors = 0;
  const perCandidateStates: Record<string, unknown> = {};

  for (const candidate of candidates) {
    try {
      let resumeText = "";
      if (candidate.resumeUrl) {
        try {
          resumeText = await extractResumeText(String(candidate.resumeUrl));
        } catch {
          resumeText = "";
        }
      }
      const result = closestRegionOf({
        address: candidate.address,
        resumeText,
        jobLocation: (job as any).location,
        regions,
      });
      perCandidateStates[String(candidate._id)] = result;
      if (result.label && result.label !== candidate.regionLabel) {
        await ATSCandidate.findByIdAndUpdate(candidate._id, {
          $set: { regionLabel: result.label },
        });
      }
      detected++;
    } catch (err) {
      console.error(`Region detection failed for candidate ${candidate._id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({
    skipped: false,
    total: candidates.length,
    detected,
    errors,
    perCandidate: perCandidateStates,
  });
}