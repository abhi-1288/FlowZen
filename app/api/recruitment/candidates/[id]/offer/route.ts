import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  const body = await request.json();
  if (!body.offeredCTC) return jsonError("Offered CTC is required.");
  if (!body.designation) return jsonError("Designation is required.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company }).populate("job", "title");
  if (!candidate) return jsonError("Candidate not found.", 404);

  const jobId = candidate.job && typeof candidate.job === "object" ? (candidate.job as any)._id || (candidate.job as any).id : candidate.job;

  const offer = await ATSOffer.create({
    candidate: candidate._id,
    job: jobId,
    offeredCTC: Number(body.offeredCTC),
    joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
    designation: String(body.designation).trim(),
    department: String(body.department ?? "").trim(),
    status: body.status || "draft",
    createdBy: userId,
    company: user.company,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: jobId,
    action: "offer-generated",
    metadata: { offerId: String(offer._id), offeredCTC: body.offeredCTC },
    actor: userId,
    company: user.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "generate-offer",
    entityType: "ATSOffer",
    entityId: offer._id,
    metadata: { candidateName: `${candidate.firstName} ${candidate.lastName}`, offeredCTC: body.offeredCTC },
    company: user.company,
  });

  const populated = await ATSOffer.findById(offer._id)
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  return NextResponse.json({ offer: serializeDoc(populated!) }, { status: 201 });
}
