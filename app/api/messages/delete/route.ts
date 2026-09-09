import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { emitToUser, isUserOnline } from "@/lib/socket-emit";

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const messageId = String(body.messageId ?? "");
  if (!messageId) return jsonError("messageId is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("company companyStatus");
  if (!user?.company || user.companyStatus !== "approved") {
    return jsonError("Unauthorized.", 403);
  }

  const msg = await Message.findById(messageId);
  if (!msg) return jsonError("Message not found.", 404);
  if (String(msg.company) !== String(user.company)) {
    return jsonError("Message does not belong to your company.", 403);
  }
  if (String(msg.sender) !== userId) {
    return jsonError("You can only delete messages you sent.", 403);
  }

  const targetUserIds = new Set<string>();
  if (msg.recipient && String(msg.recipient) !== userId) targetUserIds.add(String(msg.recipient));

  if (msg.group) {
    const team = await Team.findById(msg.group).select("manager employees");
    if (team) {
      const memberIds = [String(team.manager), ...team.employees.map((id: any) => String(id))];
      for (const id of memberIds) {
        if (id !== userId) targetUserIds.add(id);
      }
    }
  }

  await Message.deleteOne({ _id: msg._id });

  for (const uid of targetUserIds) {
    if (isUserOnline(uid)) {
      emitToUser(uid, "message:deleted", {
        messageId: String(msg._id),
      });
    }
  }

  return NextResponse.json({ ok: true });
}