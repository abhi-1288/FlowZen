import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Company } from "@/models/Company";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  
  const user = await User.findById(userId);
  if (!user) return jsonError("User not found", 404);
  if (!user.company) return jsonError("You must belong to a company to check in.", 400);

  const company = await Company.findById(user.company);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if check-in is allowed based on WFH settings
  if (company && company.wfhCheckInMode === "wfh-only") {
    const todayTime = today.getTime();
    const isWfhDay = company.wfhDates?.some((entry: any) => {
      const dateVal = entry?.date ? entry.date : entry;
      const dateTime = new Date(dateVal).getTime();
      const wfhDate = new Date(dateTime);
      wfhDate.setHours(0, 0, 0, 0);
      return wfhDate.getTime() === todayTime;
    });

    if (!isWfhDay) {
      return jsonError("Check-in is not allowed on non-WFH days", 403);
    }
  }

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const history = await Attendance.find({ user: userId }).sort({ date: -1 }).limit(30);
  return NextResponse.json({ history, today: today.toISOString() });
}
