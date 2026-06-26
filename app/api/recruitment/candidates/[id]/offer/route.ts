import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import { sendMail } from "@/lib/mailer";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

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
    salaryType: body.salaryType === "per-month" ? "per-month" : "per-annum",
    pfAmount: Number(body.pfAmount || 0),
    esicAmount: Number(body.esicAmount || 0),
    joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
    designation: String(body.designation).trim(),
    department: String(body.department ?? "").trim(),
    officeLocation: String(body.officeLocation ?? "").trim(),
    perks: String(body.perks ?? "").trim(),
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

  const stageOrder = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];
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

  const pfAmt = Number(body.pfAmount || 0);
  const esicAmt = Number(body.esicAmount || 0);
  const candidateName = `${candidate.firstName} ${candidate.lastName}`;
  const salaryPeriodLabel = offer.salaryType === "per-month" ? "month" : "year";

  try {
    await sendMail({
      to: candidate.email,
      subject: `Offer Letter - ${offer.designation} position`,
      text: `Dear ${candidateName},\n\nWe are pleased to offer you the position of ${offer.designation}.\n\nOffered CTC: ₹${Number(offer.offeredCTC).toLocaleString()}\n\nPlease log in to the candidate portal (using the link from your application email) to view and accept your offer letter.\n\nBest regards,\nThe Recruitment Team`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0f172a;padding:24px;border-radius:12px 12px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:20px;">Offer Letter</h1>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
            <p>Dear <strong>${candidateName}</strong>,</p>
            <p>We are pleased to offer you the position of <strong>${offer.designation}</strong>. Please find the details below:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px 0;color:#64748b;">Designation</td><td style="padding:8px 0;font-weight:600;">${offer.designation}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;">Department</td><td style="padding:8px 0;font-weight:600;">${offer.department || "N/A"}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;">Offered CTC</td><td style="padding:8px 0;font-weight:600;">₹${Number(offer.offeredCTC).toLocaleString()}/year</td></tr>
              ${offer.joiningDate ? `<tr><td style="padding:8px 0;color:#64748b;">Joining Date</td><td style="padding:8px 0;font-weight:600;">${new Date(offer.joiningDate).toLocaleDateString()}</td></tr>` : ""}
            </table>
            <p style="color:#64748b;font-size:13px;">Please log in to the candidate portal (using the link from your application email) to view and accept your offer letter.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
            <p style="color:#94a3b8;font-size:12px;">This is a system-generated offer letter. For any queries, please contact the HR team.</p>
          </div>
        </div>`,
    });
  } catch {
    // email is best-effort
  }

  const recUsers = await User.find({ company: user.company, role: { $in: ["admin", "human-resource", "project-manager", "qa-tester", "finance"] }, _id: { $ne: userId } });
  for (const ru of recUsers) {
    emitToUser(String(ru._id), "recruitment:update", { type: "offer-generated", candidateId: String(candidate._id) });
  }

  const populated = await ATSOffer.findById(offer._id)
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  return NextResponse.json({ offer: serializeDoc(populated!) }, { status: 201 });
}
