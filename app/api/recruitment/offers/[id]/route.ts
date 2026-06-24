import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
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
  if (!isObjectId(id)) return jsonError("Invalid offer id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const offer = await ATSOffer.findOne({ _id: id, company: user.company })
    .populate("candidate", "firstName lastName email phone")
    .populate("job", "title department location")
    .populate("company", "name icon");

  if (!offer) return jsonError("Offer not found.", 404);

  return NextResponse.json({ offer: serializeDoc(offer) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid offer id.");

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.offeredCTC !== undefined) updates.offeredCTC = Number(body.offeredCTC);
  if (body.pfAmount !== undefined) updates.pfAmount = Number(body.pfAmount);
  if (body.esicAmount !== undefined) updates.esicAmount = Number(body.esicAmount);
  if (body.joiningDate !== undefined) updates.joiningDate = body.joiningDate ? new Date(body.joiningDate) : null;
  if (body.designation !== undefined) updates.designation = String(body.designation).trim();
  if (body.department !== undefined) updates.department = String(body.department).trim();
  if (body.officeLocation !== undefined) updates.officeLocation = String(body.officeLocation).trim();
  if (body.perks !== undefined) updates.perks = String(body.perks).trim();
  if (body.status !== undefined) updates.status = body.status;

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const offer = await ATSOffer.findOneAndUpdate(
    { _id: id, company: user.company },
    { $set: updates },
    { new: true }
  )
    .populate("candidate", "firstName lastName email phone")
    .populate("job", "title");

  if (!offer) return jsonError("Offer not found.", 404);

  const cand = offer.candidate as any;

  if (body.status === "sent") {
    const candidateName = `${cand.firstName} ${cand.lastName}`;

    try {
      await sendMail({
        to: cand.email,
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
  }

  if (body.status === "accepted") {
    await ATSCandidate.findByIdAndUpdate(cand._id, { stage: "joined" });

    await ATSTimeline.create({
      candidate: offer.candidate,
      job: offer.job,
      action: "offer-accepted",
      metadata: { offerId: id, offeredCTC: offer.offeredCTC },
      actor: userId,
      company: user.company,
    });

    await ATSTimeline.create({
      candidate: offer.candidate,
      job: offer.job,
      action: "joined",
      metadata: { joinedDate: offer.joiningDate },
      actor: userId,
      company: user.company,
    });

    const hrUsers = await User.find({ company: user.company, role: { $in: ["human-resource", "admin"] } });
    for (const hr of hrUsers) {
      await Notification.create({
        user: hr._id,
        type: "info",
        title: "Offer Accepted",
        message: `Offer for ${(offer.candidate as any)?.firstName} ${(offer.candidate as any)?.lastName} has been accepted.`,
      });
      emitToUser(String(hr._id), "notification:new", { message: "Offer accepted notification." });
    }
  }

  if (body.status === "rejected") {
    await ATSTimeline.create({
      candidate: offer.candidate,
      job: offer.job,
      action: "offer-rejected",
      metadata: { offerId: id },
      actor: userId,
      company: user.company,
    });
  }

  await ATSAuditLog.create({
    actor: userId,
    action: "update-offer",
    entityType: "ATSOffer",
    entityId: offer._id,
    metadata: { status: offer.status },
    company: user.company,
  });

  return NextResponse.json({ offer: serializeDoc(offer) });
}
