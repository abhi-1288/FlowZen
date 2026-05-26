import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select("name company companyStatus role");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to request a salary.", 403);
  }

  const otherHr = await User.findOne({
    _id: { $ne: userId },
    company: user.company,
    role: "human-resource",
    companyStatus: "approved",
  }).select("_id");
  const admin = await User.findOne({
    _id: { $ne: userId },
    company: user.company,
    role: "admin",
    companyStatus: "approved",
  }).select("_id");
  const approverId = otherHr ? String(otherHr._id) : admin ? String(admin._id) : "";
  if (!approverId) {
    return jsonError("No HR or admin is available for this company.", 404);
  }

  const existing = await JoinRequest.findOne({
    requester: userId,
    company: user.company,
    kind: "salary",
    status: "pending",
  });
  if (existing) {
    return NextResponse.json({ ok: true, status: "already_requested" });
  }

  const request = await JoinRequest.create({
    requester: userId,
    approver: approverId,
    company: user.company,
    kind: "salary",
    status: "pending",
  });

  await Notification.create({
    user: approverId,
    company: user.company,
    type: "approval",
    title: "Salary assignment request",
    message: `${user.name} requested a salary assignment.`,
  });
  emitNotification(String(approverId));

  return NextResponse.json({ ok: true, status: "requested", requestId: String(request._id) });
}
