import { NextResponse } from "next/server";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { regionLabelsOf } from "@/lib/company-regions";
import { withCandidateAccess } from "@/lib/recruitment-candidate-access";
import { jsonError, serializeDoc } from "@/lib/api";
import { effectiveRegionOf } from "@/lib/region-scope";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const access = await withCandidateAccess(id, "write");
  if (!access.ok) return access.response;
  const { user } = access;

  const offer = await ATSOffer.findOne({ candidate: id, company: user.company })
    .sort({ createdAt: -1 })
    .populate("candidate", "firstName lastName email phone")
    .populate("job", "title department location")
    .populate("company", "name icon")
    .populate("signedBy", "name role");

  return NextResponse.json({ offer: offer ? serializeDoc(offer) : null });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  const body = await request.json();
  if (
    body.offeredCTC === undefined ||
    body.offeredCTC === null ||
    Number(body.offeredCTC) <= 0
  ) {
    return jsonError(
      "Cannot generate an offer: the offered CTC must be greater than 0. Please set a salary on the job description first.",
    );
  }
  if (!body.designation) return jsonError("Designation is required.");

  const access = await withCandidateAccess(id, "write");
  if (!access.ok) return access.response;
  const { user, company } = access;
  const userId = String(user._id);

  const candidate = await ATSCandidate.findById(access.candidate._id).populate("job", "title regionLabel");
  if (!candidate) return jsonError("Candidate not found.", 404);

  const jobId = candidate.job && typeof candidate.job === "object" ? (candidate.job as any)._id || (candidate.job as any).id : candidate.job;

  // Region precedence, strongest first.
  //
  // 1. `candidate.joiningRegionLabel` — set by the bulk transfer. This is the
  //    answer, because "send these candidates to Pune, then Pune raises the
  //    offer" only holds if the offer cannot disagree with the transfer.
  // 2. The job's own region, for candidates never transferred — a job scoped to
  //    one office is the closest thing to an intent.
  // 3. The generating HR's region, which is the historical behaviour and a poor
  //    last resort: a regional HR head raising an offer for another region would
  //    file the hire under their own office. `officeLocation` is recruiter free
  //    text and is not an office label, so it cannot stand in for one either.
  const jobRegionLabel =
    candidate.job && typeof candidate.job === "object"
      ? String((candidate.job as any).regionLabel ?? "").trim()
      : "";
  const transferredRegion = String(candidate.joiningRegionLabel ?? "").trim();
  const regionLabel =
    transferredRegion || jobRegionLabel || (await effectiveRegionOf(user));

  // A stored region that no longer names a real office cannot be relied on for
  // the join approval, which routes to that region's head. Surface it rather
  // than silently writing a letter that will be signed by nobody.
  if (regionLabel && !regionLabelsOf(company).some((l) => l.toLowerCase() === regionLabel.toLowerCase())) {
    return jsonError(
      `This candidate's joining region ("${regionLabel}") is no longer a configured office. Update the region before generating the offer.`,
    );
  }

  const offer = await ATSOffer.create({
    candidate: candidate._id,
    job: jobId,
    offeredCTC: Number(body.offeredCTC),
    salaryType: ["per-annum", "per-month", "per-day", "per-hour"].includes(body.salaryType)
      ? body.salaryType
      : "per-annum",
    currency: String(body.currency || "INR").toUpperCase(),
    pfAmount: Number(body.pfAmount || 0),
    esicAmount: Number(body.esicAmount || 0),
    joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
    designation: String(body.designation).trim(),
    department: String(body.department ?? "").trim(),
    officeLocation: String(body.officeLocation ?? "").trim(),
    perks: String(body.perks ?? "").trim(),
    status: "draft",
    createdBy: userId,
    company: user.company,
    regionLabel,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: jobId,
    action: "offer-generated",
    metadata: { offerId: String(offer._id), offeredCTC: body.offeredCTC },
    actor: userId,
    company: user.company,
  });

  const stageOrder = ["applied", "screening", "assessment", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];
  const currentStage = candidate.stage;
  const targetStage = "offer";
  const currentIdx = stageOrder.indexOf(currentStage);
  const targetIdx = stageOrder.indexOf(targetStage);
  if (targetIdx > currentIdx && targetIdx >= 0) {
    candidate.stage = targetStage;
    await candidate.save();
    await ATSTimeline.create({
      candidate: candidate._id,
      job: jobId,
      action: "stage-changed",
      metadata: { from: currentStage, to: targetStage, reason: "Offer generated" },
      actor: userId,
      company: user.company,
    });
  }

  await ATSAuditLog.create({
    actor: userId,
    action: "generate-offer",
    entityType: "ATSOffer",
    entityId: offer._id,
    metadata: { candidateName: `${candidate.firstName} ${candidate.lastName}`, offeredCTC: body.offeredCTC },
    company: user.company,
  });

  const recUsers = await User.find({ company: user.company, role: { $in: ["admin", "human-resource", "project-manager", "qa-tester", "finance"] }, _id: { $ne: userId } });
  for (const ru of recUsers) {
    emitToUser(String(ru._id), "recruitment:update", { type: "offer-generated", candidateId: String(candidate._id) });
  }

  const populated = await ATSOffer.findById(offer._id)
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  return NextResponse.json({ offer: serializeDoc(populated!) }, { status: 201 });
}
