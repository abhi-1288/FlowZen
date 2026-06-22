import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid offer id.");

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.offeredCTC !== undefined) updates.offeredCTC = Number(body.offeredCTC);
  if (body.joiningDate !== undefined) updates.joiningDate = body.joiningDate ? new Date(body.joiningDate) : null;
  if (body.designation !== undefined) updates.designation = String(body.designation).trim();
  if (body.department !== undefined) updates.department = String(body.department).trim();
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
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  if (!offer) return jsonError("Offer not found.", 404);

  if (body.status === "accepted") {
    await ATSTimeline.create({
      candidate: offer.candidate,
      job: offer.job,
      action: "offer-accepted",
      metadata: { offerId: id, offeredCTC: offer.offeredCTC },
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
