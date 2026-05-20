import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const memberId = String(body.memberId ?? "");
  const message = String(body.message ?? "").trim();
  if (!memberId || !message) return jsonError("Member and message are required.");
  if (message.length > 1000) return jsonError("Message must be 1000 characters or less.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [hr, member] = await Promise.all([
    User.findById(userId),
    User.findById(memberId),
  ]);
  if (!hr) return jsonError("HR user not found.", 404);
  if (!member) return jsonError("Member not found.", 404);
  if (hr.role !== "human-resource" || hr.companyStatus !== "approved" || !hr.company) {
    return jsonError("Only approved HR members can message company members.", 403);
  }
  if (String(member.company ?? "") !== String(hr.company) || member.companyStatus !== "approved") {
    return jsonError("You can only message approved members in your company.", 403);
  }

  await Notification.create({
    user: member._id,
    company: hr.company,
    type: "info",
    title: "Message from HR",
    message,
    body: `${hr.name}: ${message}`,
  });
  emitNotification(String(member._id));

  return NextResponse.json({ ok: true });
}
