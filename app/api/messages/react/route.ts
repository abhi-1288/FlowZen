import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { emitToUser, isUserOnline } from "@/lib/socket-emit";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const messageId = String(body.messageId ?? "");
  const emoji = String(body.emoji ?? "").trim();
  if (!messageId) return jsonError("messageId is required.");
  if (!emoji) return jsonError("emoji is required.");

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

  const existingIndex = msg.reactions.findIndex(
    (r: any) => String(r.user) === userId && r.emoji === emoji
  );

  if (existingIndex >= 0) {
    msg.reactions.splice(existingIndex, 1);
  } else {
    msg.reactions.push({ emoji, user: userId } as any);
  }
  await msg.save();

  const populatedMsg = await Message.findById(messageId).populate({ path: "reactions.user", select: "name" });

  const targetUserIds = new Set<string>();
  if (String(msg.sender) !== userId) targetUserIds.add(String(msg.sender));
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

  const reactionsData = (populatedMsg?.reactions ?? msg.reactions).map((r: any) => ({
    emoji: r.emoji,
    user: String(r.user?._id ?? r.user),
    userName: r.user?.name ?? null,
  }));

  const reactor = await User.findById(userId).select("name");

  for (const uid of targetUserIds) {
    if (isUserOnline(uid)) {
      emitToUser(uid, "message:reaction", {
        messageId: String(msg._id),
        reactions: reactionsData,
        reactorName: reactor?.name ?? "Someone",
        emoji,
      });
    }
  }

  return NextResponse.json({ ok: true, reactions: reactionsData });
}
