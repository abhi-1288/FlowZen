import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const targetUserId = String(body.memberId ?? "").trim();
  if (!targetUserId) return jsonError("Member ID is required.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("name role company");
  if (!actor) return jsonError("User not found.", 404);
  if (actor.role !== "human-resource" && actor.role !== "admin") {
    return jsonError("Only HR or admin can revoke ID cards.", 403);
  }

  const target = await User.findById(targetUserId).select("company");
  if (!target) return jsonError("Target user not found.", 404);

  const actorCompanyId = typeof actor.company === "object" && actor.company
    ? String((actor.company as any)._id ?? "")
    : String(actor.company);
  const targetCompanyId = typeof target.company === "object" && target.company
    ? String((target.company as any)._id ?? "")
    : String(target.company);

  if (!actorCompanyId || actorCompanyId !== targetCompanyId) {
    return jsonError("Target user is not in your company.", 403);
  }

  const result = await JoinRequest.deleteOne({
    requester: targetUserId,
    company: actorCompanyId,
    kind: "id-card",
    status: "approved",
  });

  if (result.deletedCount === 0) {
    return jsonError("No approved ID card found for this member.", 404);
  }

  await Notification.create({
    user: targetUserId,
    company: actorCompanyId,
    type: "system",
    title: "ID Card Revoked",
    message: `${actor.name} (${actor.role === "human-resource" ? "HR" : "Admin"}) has revoked your ID card.`,
  });
  emitNotification(targetUserId);

  return NextResponse.json({ status: "revoked" });
}
