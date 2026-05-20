import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { listApprovedHrUserIds } from "@/lib/join-approvers";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const reason = String((body as any).reason ?? "").trim();
  if (!reason) return jsonError("Reason is required.", 400);
  if (reason.length > 500) return jsonError("Reason must be 500 characters or less.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, pendingQuit] = await Promise.all([
    User.findById(userId).select("name role company"),
    JoinRequest.findOne({
      requester: userId,
      kind: { $in: ["quit-company", "quit-team"] },
      status: "pending",
    }).sort({ createdAt: -1 }),
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!pendingQuit) return jsonError("No pending quit request found.", 404);

  pendingQuit.status = "rejected";
  pendingQuit.cancelReason = reason;
  pendingQuit.cancelledAt = new Date();
  await pendingQuit.save();

  let recipientIds = [String(pendingQuit.approver)];
  if (pendingQuit.kind === "quit-company" && ["project-manager", "qa-tester", "employee", "others"].includes(String(user.role))) {
    const companyId = pendingQuit.company;
    recipientIds = await listApprovedHrUserIds(companyId);
  }
  recipientIds = Array.from(new Set(recipientIds.filter(Boolean)));

  if (recipientIds.length > 0) {
    const message = `${String(user.name ?? "User")} cancelled their quit request. Reason: ${reason}`;
    await Notification.insertMany(
      recipientIds.map((recipientId) => ({
        user: recipientId,
        company: pendingQuit.company,
        team: pendingQuit.team,
        type: "approval",
        title: "Quit request cancelled",
        message,
      })),
    );
    recipientIds.forEach((id) => emitNotification(id));
  }

  return NextResponse.json({ ok: true });
}

