import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

const ALLOWED_MINUTES = new Set([15, 30, 45, 60, 90, 120]);

function durationPhrase(minutes: number): string {
  if (minutes === 60) return "1 hour";
  if (minutes === 90) return "1.5 hours";
  if (minutes === 120) return "2 hours";
  return `${minutes} minutes`;
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const memberId = String(body.memberId ?? "");
  const durationMinutes = Number(body.durationMinutes);
  if (!memberId) return jsonError("Member is required.");
  if (!Number.isFinite(durationMinutes) || !ALLOWED_MINUTES.has(durationMinutes)) {
    return jsonError("Invalid meeting duration.", 400);
  }
  if (memberId === userId) return jsonError("You cannot invite yourself.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [hr, member] = await Promise.all([User.findById(userId), User.findById(memberId)]);
  if (!hr) return jsonError("User not found.", 404);
  if (!member) return jsonError("Member not found.", 404);
  if (!["human-resource", "admin"].includes(String(hr.role)) || hr.companyStatus !== "approved" || !hr.company) {
    return jsonError("Only approved HR or admins can send meeting invites.", 403);
  }
  if (String(member.company ?? "") !== String(hr.company) || member.companyStatus !== "approved") {
    return jsonError("You can only invite approved members in your company.", 403);
  }

  const when = durationPhrase(durationMinutes);
  const inviterName = String(hr.name ?? "Member");
  const inviterRole = String(hr.role ?? "member") === "admin" ? "Admin" : "HR";
  const message = `${inviterRole}:${inviterName} has invited you to meet in ${when}`;

  await Notification.create({
    user: member._id,
    company: hr.company,
    type: "system",
    title: "Meeting invitation",
    message,
    body: message,
  });
  emitNotification(String(member._id));

  return NextResponse.json({ ok: true });
}
