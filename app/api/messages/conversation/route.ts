import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { Message } from "@/models/Message";
import { emitToUser } from "@/lib/socket-emit";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const url = new URL(request.url);
  const recipientId = url.searchParams.get("recipientId");
  if (!recipientId) return jsonError("recipientId is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  // Mark messages from recipient to user as received
  const receivedResult = await Message.updateMany(
    { sender: recipientId, recipient: userId, receivedAt: null },
    { $set: { receivedAt: new Date() } }
  );
  if (receivedResult.modifiedCount > 0) {
    emitToUser(recipientId, "message:received", { userId });
  }

  // Mark all unread messages from recipient to user as read
  const readResult = await Message.updateMany(
    { sender: recipientId, recipient: userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  if (readResult.modifiedCount > 0) {
    emitToUser(recipientId, "message:read", { userId });
  }

  // Retrieve chat history
  const messages = await Message.find({
    $or: [
      { sender: userId, recipient: recipientId },
      { sender: recipientId, recipient: userId }
    ]
  }).sort({ createdAt: 1 });

  return NextResponse.json({ messages: serializeDocs(messages) });
}
