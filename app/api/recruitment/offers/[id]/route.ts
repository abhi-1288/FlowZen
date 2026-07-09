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
import { offerLetterContent } from "@/lib/email-templates";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid offer id.");

  await connectDb();
  const user = await User.findById(userId);
  const isSeniorSecurity = user?.role === "security" && Boolean((user as any).isSeniorSecurity);
  if (!user || (!HR_ROLES.includes(user.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const offer = await ATSOffer.findOne({ _id: id, company: user.company })
    .populate("candidate", "firstName lastName email phone")
    .populate("job", "title department location")
    .populate("company", "name icon")
    .populate("signedBy", "name role");

  if (!offer) return jsonError("Offer not found.", 404);

  return NextResponse.json({ offer: serializeDoc(offer) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid offer id.");

  const body = await request.json();

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const existingOffer = await ATSOffer.findOne({ _id: id, company: user.company });
  if (!existingOffer) return jsonError("Offer not found.", 404);

  if (body.action === "sign") {
    if (existingOffer.isSigned) return jsonError("Offer is already signed.", 400);
    const updates: Record<string, unknown> = {
      signedBy: userId,
      signedAt: new Date(),
      isSigned: true,
    };
    const offer = await ATSOffer.findOneAndUpdate(
      { _id: id, company: user.company },
      { $set: updates },
      { new: true }
    )
      .populate("candidate", "firstName lastName email phone")
      .populate("job", "title")
      .populate("signedBy", "name role");

    return NextResponse.json({ offer: serializeDoc(offer!) });
  }

  const updates: Record<string, unknown> = {};
  const contentFields = ["offeredCTC", "pfAmount", "esicAmount", "joiningDate", "designation", "department", "officeLocation", "perks"];
  const hasContentChanges = contentFields.some((f) => body[f] !== undefined);
  if (body.offeredCTC !== undefined) updates.offeredCTC = Number(body.offeredCTC);
  if (body.pfAmount !== undefined) updates.pfAmount = Number(body.pfAmount);
  if (body.esicAmount !== undefined) updates.esicAmount = Number(body.esicAmount);
  if (body.joiningDate !== undefined) updates.joiningDate = body.joiningDate ? new Date(body.joiningDate) : null;
  if (body.designation !== undefined) updates.designation = String(body.designation).trim();
  if (body.department !== undefined) updates.department = String(body.department).trim();
  if (body.officeLocation !== undefined) updates.officeLocation = String(body.officeLocation).trim();
  if (body.perks !== undefined) updates.perks = String(body.perks).trim();
  if (body.status !== undefined) updates.status = body.status;

  if (existingOffer.isSigned && hasContentChanges) {
    updates.signedBy = null;
    updates.signedAt = null;
    updates.isSigned = false;
  }

  const offer = await ATSOffer.findOneAndUpdate(
    { _id: id, company: user.company },
    { $set: updates },
    { new: true }
  )
    .populate("candidate", "firstName lastName email phone")
    .populate("job", "title")
    .populate("signedBy", "name role");

  if (!offer) return jsonError("Offer not found.", 404);

  const cand = offer.candidate as any;

  if (body.status === "sent") {
    const candidateName = `${cand.firstName} ${cand.lastName}`;

    try {
      const emailContent = offerLetterContent({
        candidateName,
        designation: offer.designation,
        offeredCTC: Number(offer.offeredCTC),
        department: offer.department,
        joiningDate: offer.joiningDate,
      });
      await sendMail({
        to: cand.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
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
