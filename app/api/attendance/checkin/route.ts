import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { attendanceDay, attendanceDayKey } from "@/lib/attendance-day";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  
  const user = await User.findById(userId);
  if (!user) return jsonError("User not found", 404);
  if (!user.company) return jsonError("You must belong to a company to check in.", 400);

  const company = await Company.findById(user.company);

  // Resolve "today" in the company's timezone so attendance and EOD/EOW
  // compactions agree on which calendar day an event belongs to.
  const now = new Date();
  const todayKey = attendanceDayKey(now, company?.timeZone);
  const today = attendanceDay(now, company?.timeZone);

  // Check if check-in is allowed based on WFH settings
  if (company && company.wfhCheckInMode === "wfh-only") {
    const isWfhDay = company.wfhDates?.some((entry: any) => {
      const dateVal = entry?.date ? entry.date : entry;
      if (!dateVal) return false;
      return attendanceDayKey(dateVal, company.timeZone) === todayKey;
    });

    if (!isWfhDay) {
      return jsonError("Check-in is not allowed on non-WFH days", 403);
    }
  }

  const existing = await Attendance.findOne({ user: userId, date: today });
  if (existing) {
    return jsonError("Already checked in for today.");
  }

  let attendance;
  try {
    attendance = await Attendance.create({
      user: userId,
      date: today,
      checkIn: now,
      status: "present"
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return jsonError("Already checked in for today.");
    }
    throw err;
  }

  return NextResponse.json({ attendance });
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select("company");
  let minWorkHours = 8;
  let timeZone: string | null = null;
  if (user?.company) {
    const company = await Company.findById(user.company).select("minWorkHours timeZone");
    if (company) {
      minWorkHours = company.minWorkHours ?? 8;
      timeZone = company.timeZone ?? null;
    }
  }

  const today = attendanceDay(new Date(), timeZone);
  const history = await Attendance.find({ user: userId }).sort({ date: -1 }).limit(30);
  return NextResponse.json({ history, today: today.toISOString(), minWorkHours });
}
