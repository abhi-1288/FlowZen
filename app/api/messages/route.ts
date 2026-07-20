import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Message } from "@/models/Message";
import { Team } from "@/models/Team";
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
  const groupId = String(body.groupId ?? "");
  const replyToId = String(body.replyTo ?? "");
  const message = String(body.message ?? "").trim();
  if (!message) return jsonError("Message is required.");
  if (message.length > 1000) return jsonError("Message must be 1000 characters or less.");
  if (!recipientId && !groupId) return jsonError("recipientId or groupId is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const sender = await User.findById(userId);
  if (!sender) return jsonError("Sender not found.", 404);
  if (!sender.company || sender.companyStatus !== "approved") {
    return jsonError("Join a company before sending messages.", 403);
  }

  if (groupId) {
    const team = await Team.findById(groupId).select("company manager employees");
    if (!team) return jsonError("Team not found.", 404);
    if (String(team.company) !== String(sender.company)) {
      return jsonError("Team does not belong to your company.", 403);
    }
    const isMember =
      String(team.manager) === userId ||
      team.employees.some((id: any) => String(id) === userId);
    if (!isMember) return jsonError("You are not a member of this team.", 403);

    const newMessage = await Message.create({
      sender: sender._id,
      recipient: null,
      company: sender.company,
      group: team._id,
      message,
      ...(replyToId ? { replyTo: replyToId } : {}),
    });

    const memberIds = [
      String(team.manager),
      ...team.employees.map((id: any) => String(id)),
    ].filter((id) => id !== userId);

    for (const memberId of memberIds) {
      if (isUserOnline(memberId)) {
        emitToUser(memberId, "message:new", {
          senderId: String(sender._id),
          senderName: sender.name,
          message,
          groupId: String(team._id),
          groupName: team.name,
          createdAt: newMessage.createdAt,
          ...(replyToId ? { replyTo: replyToId } : {}),
        });
      }
    }

    return NextResponse.json({ ok: true });
  }

  const [recipient] = await Promise.all([
    User.findById(recipientId),
  ]);
  if (!recipient) return jsonError("Recipient not found.", 404);
  if (String(recipient.company ?? "") !== String(sender.company) || recipient.companyStatus !== "approved") {
    return jsonError("You can only message approved members in your company.", 403);
  }

  const newMessage = await Message.create({
    sender: sender._id,
    recipient: recipient._id,
    company: sender.company,
    message,
    ...(replyToId ? { replyTo: replyToId } : {}),
  });

  if (isUserOnline(String(recipient._id))) {
    newMessage.receivedAt = new Date();
    await newMessage.save();
  }

  emitToUser(String(recipient._id), "message:new", {
    senderId: String(sender._id),
    senderName: sender.name,
    message,
    createdAt: newMessage.createdAt,
    receivedAt: newMessage.receivedAt,
    ...(replyToId ? { replyTo: replyToId } : {}),
  });

  return NextResponse.json({ ok: true });
}
