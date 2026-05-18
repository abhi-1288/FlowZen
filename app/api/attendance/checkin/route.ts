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

  const existing = await Attendance.findOne({ user: userId, date: today });
  if (existing) {
    return jsonError("Already checked in for today.");
  }

  const attendance = await Attendance.create({
    user: userId,
    date: today,
    checkIn: new Date(),
    status: "present"
  });

  return NextResponse.json({ attendance });
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const history = await Attendance.find({ user: userId }).sort({ date: -1 }).limit(30);
  return NextResponse.json({ history });
}
