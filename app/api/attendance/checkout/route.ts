import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { Attendance } from "@/models/Attendance";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await Attendance.findOne({ user: userId, date: today });
  if (!attendance) {
    return jsonError("You haven't checked in today.", 400);
  }

  if (attendance.checkOut) {
    return jsonError("Already checked out for today.", 400);
  }

  attendance.checkOut = new Date();
  await attendance.save();

  return NextResponse.json({ attendance });
}
