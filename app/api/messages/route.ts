import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Message } from "@/models/Message";
import { emitToUser, isUserOnline } from "@/lib/socket-emit";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("company companyStatus");
  if (!user?.company || user.companyStatus !== "approved") {
    return NextResponse.json({ members: [] });
  }

  const members = await User.find({
    company: user.company,
    companyStatus: "approved",
    _id: { $ne: user._id },
  })
    .select("name email role teamStatus team activeTeams companyJoined companyIdentityCode avatarUrl lastOnline phone dob")
    .populate({ path: "team", select: "name" })
    .populate({ path: "company", select: "name" });

  const enrichedMembers = await Promise.all(
    members.map(async (m) => {
      const memberId = String(m._id);
      const unreadCount = await Message.countDocuments({
        sender: memberId,
        recipient: userId,
        readAt: null,
      });
      const lastMessage = await Message.findOne({
        $or: [
          { sender: userId, recipient: memberId },
          { sender: memberId, recipient: userId }
        ]
      })
        .sort({ createdAt: -1 })
        .select("message createdAt sender receivedAt readAt");

      return {
        ...m.toObject(),
        unreadCount,
        isOnline: isUserOnline(memberId),
        lastMessage: lastMessage ? {
          message: lastMessage.message,
          createdAt: lastMessage.createdAt,
          sender: String(lastMessage.sender),
          receivedAt: lastMessage.receivedAt,
          readAt: lastMessage.readAt,
        } : null
      };
    })
  );

  enrichedMembers.sort((a, b) => {
    const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    if (timeA || timeB) {
      return timeB - timeA;
    }
    const roleCompare = String(a.role || "").localeCompare(String(b.role || ""));
    if (roleCompare !== 0) return roleCompare;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return NextResponse.json({ members: enrichedMembers.map((m: any) => ({ ...m, id: String(m._id), _id: undefined, __v: undefined })) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const recipientId = String(body.recipientId ?? "");
  const message = String(body.message ?? "").trim();
  if (!recipientId || !message) return jsonError("Member and message are required.");
  if (message.length > 1000) return jsonError("Message must be 1000 characters or less.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [sender, recipient] = await Promise.all([
    User.findById(userId),
    User.findById(recipientId),
  ]);
  if (!sender) return jsonError("Sender not found.", 404);
  if (!recipient) return jsonError("Recipient not found.", 404);
  if (!sender.company || sender.companyStatus !== "approved") {
    return jsonError("Join a company before sending messages.", 403);
  }
  if (String(recipient.company ?? "") !== String(sender.company) || recipient.companyStatus !== "approved") {
    return jsonError("You can only message approved members in your company.", 403);
  }

  const newMessage = await Message.create({
    sender: sender._id,
    recipient: recipient._id,
    company: sender.company,
    message,
  });

  // If recipient is online, mark as received immediately
  if (isUserOnline(String(recipient._id))) {
    newMessage.receivedAt = new Date();
    await newMessage.save();
  }

  // Emit real-time message event via SSE to recipient
  emitToUser(String(recipient._id), "message:new", {
    senderId: String(sender._id),
    senderName: sender.name,
    message,
    createdAt: newMessage.createdAt,
    receivedAt: newMessage.receivedAt,
  });

  return NextResponse.json({ ok: true });
}
