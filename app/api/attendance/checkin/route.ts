import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { WfhRequest } from "@/models/WfhRequest";
import { attendanceDay, attendanceDayKey } from "@/lib/attendance-day";
import { canCheckInOnDate, dateKey, isWeekendDate } from "@/lib/weekends";
import { effectiveRegionLabelOf } from "@/lib/company-regions";

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

  // Day-off gate: weekend and holiday-weekend dates block check-in unless the
  // company opted in through the HR policy or the member has an approved WFH
  // request covering today. Weekend exclusions (declared working days) are not
  // weekends at all, so they never reach this branch.
  const todayIsWeekend = isWeekendDate(todayKey, {
    weekendEntries: ((company as any)?.weekendDates ?? []) as any[],
    weekendExclusions: ((company as any)?.weekendExclusions ?? []) as any[],
    region: effectiveRegionLabelOf(company, user),
  });
  if (todayIsWeekend) {
    const weekendCheckInEnabled = Boolean((company as any)?.weekendCheckInEnabled);
    let hasApprovedWfh = false;
    if (!weekendCheckInEnabled) {
      // Widen the overlap window by a couple of days so both stored date
      // shapes (UTC-midnight and local-midnight) are captured; the exact
      // calendar-day comparison happens on the YYYY-MM-DD keys below.
      const dayStart = new Date(`${todayKey}T00:00:00.000Z`);
      const candidates = await WfhRequest.find({
        requester: userId,
        company: user.company,
        status: "approved",
        startDate: { $lte: new Date(dayStart.getTime() + 2 * 86400000) },
        endDate: { $gte: new Date(dayStart.getTime() - 2 * 86400000) },
      })
        .select("startDate endDate")
        .lean();
      hasApprovedWfh = candidates.some((req: any) => {
        const startKey = dateKey(req?.startDate);
        const endKey = dateKey(req?.endDate);
        return Boolean(startKey && endKey && startKey <= todayKey && todayKey <= endKey);
      });
    }
    if (!canCheckInOnDate({ isWeekend: true, weekendCheckInEnabled, hasApprovedWfh })) {
      return jsonError("Today is a weekend (day off). Check-in is disabled.", 403);
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
