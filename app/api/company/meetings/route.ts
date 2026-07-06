import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { Meeting } from "@/models/Meeting";
import { User } from "@/models/User";
import { Message } from "@/models/Message";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { emitToUser, isUserOnline } from "@/lib/socket-emit";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? "", 10);
  const month = parseInt(searchParams.get("month") ?? "", 10);

  if (isNaN(year) || isNaN(month) || month < 0 || month > 11)
    return jsonError("Valid year and month are required.", 400);

  await connectDb();

  const actor = await User.findById(userId).select("company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const meetings = await Meeting.find({
    company: actor.company,
    date: { $gte: startDate, $lte: endDate },
    status: { $ne: "cancelled" },
  })
    .populate("creator", "name avatarUrl")
    .populate("participants", "name avatarUrl")
    .sort({ date: 1 })
    .lean();

  return NextResponse.json({ meetings });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select("name role company companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);
  if (actor.role !== "admin" && actor.role !== "human-resource")
    return jsonError("Only admins and HR can schedule meetings.", 403);

  const body = await request.json();
  const { title, description, meetingType, meetingLink, location, date, time, durationMinutes, participantIds } = body;

  if (!title || !title.trim())
    return jsonError("Meeting title is required.", 400);
  if (!date)
    return jsonError("Meeting date is required.", 400);

  const meetingDate = new Date(date);
  if (isNaN(meetingDate.getTime()))
    return jsonError("Invalid meeting date.", 400);

  const participants = Array.isArray(participantIds)
    ? participantIds.filter((id: string) => id !== userId).map(String)
    : [];

  const validMeetingType = meetingType === "offline" ? "offline" : "online";
  const normalizedDuration = Math.min(120, Math.max(15, Math.floor(Number(durationMinutes) || 30)));

  const meeting = await Meeting.create({
    company: actor.company,
    creator: userId,
    title: title.trim(),
    description: description?.trim() || "",
    meetingType: validMeetingType,
    meetingLink: validMeetingType === "online" ? (meetingLink?.trim() || "") : "",
    location: validMeetingType === "offline" ? (location?.trim() || "") : "",
    date: meetingDate,
    time: time || "",
    durationMinutes: normalizedDuration,
    participants,
    status: "scheduled",
  });

  const durationLabel = normalizedDuration >= 60
    ? (normalizedDuration === 60 ? "1 hour" : `${normalizedDuration / 60} hours`)
    : `${normalizedDuration} minutes`;
  const meetingInfo = `Meeting: "${title.trim()}" on ${meetingDate.toLocaleDateString("en-IN")}${time ? " at " + time : ""} (${durationLabel})`;

  for (const pid of participants) {
    await Notification.create({
      user: pid,
      company: actor.company,
      type: "system",
      title: "Meeting invitation",
      message: `${actor.role}:${actor.name} has invited you to a ${meetingInfo}`,
    });
    emitNotification(pid);

    const msg = await Message.create({
      sender: userId,
      recipient: pid,
      company: actor.company,
      message: `📅 ${meetingInfo}` + (description?.trim() ? `\n\n${description.trim()}` : ""),
    });
    if (isUserOnline(pid)) {
      msg.receivedAt = new Date();
      await msg.save();
    }
    emitToUser(pid, "message:new", {
      senderId: userId,
      senderName: actor.name,
      message: msg.message,
      createdAt: msg.createdAt,
      receivedAt: msg.receivedAt,
    });
  }

  return NextResponse.json({ meeting }, { status: 201 });
}
