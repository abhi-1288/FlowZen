import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { Company } from "@/models/Company";
import { Holiday } from "@/models/Holiday";
import { LeaveRequest } from "@/models/LeaveRequest";
import { User } from "@/models/User";
import { WfhRequest } from "@/models/WfhRequest";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addRangeDays(target: Set<string>, startValue: unknown, endValue: unknown, monthStart: Date, monthEndInclusive: Date) {
  const rawStart = startOfDay(new Date(String(startValue)));
  const rawEnd = startOfDay(new Date(String(endValue)));
  if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) return;

  const start = rawStart < monthStart ? monthStart : rawStart;
  const end = rawEnd > monthEndInclusive ? monthEndInclusive : rawEnd;
  if (start > end) return;

  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    target.add(dateKey(new Date(time)));
  }
}

function parseMonth(value: string | null) {
  const fallback = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(String(value ?? "")) ? String(value) : fallback;
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return parseMonth(fallback);
  }
  return { month, year, monthNumber };
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select("company companyStatus companyJoined createdAt");
  if (!user) return jsonError("User not found.", 404);

  const url = new URL(request.url);
  const { month, year, monthNumber } = parseMonth(url.searchParams.get("month"));
  const monthStart = startOfDay(new Date(year, monthNumber - 1, 1));
  const monthEnd = startOfDay(new Date(year, monthNumber, 1));
  const monthEndInclusive = startOfDay(new Date(year, monthNumber, 0));
  const today = startOfDay(new Date());
  const attendanceWindowEnd = monthEndInclusive < today ? monthEndInclusive : today;
  const daysInMonth = monthEndInclusive.getDate();

  const companyId = user.company && String(user.companyStatus ?? "") === "approved" ? user.company : null;
  const joinedDate = startOfDay(new Date(user.companyJoined || user.createdAt || monthStart));

  const [attendanceRecords, leaveRecords, wfhRecords, company, holidays] = await Promise.all([
    Attendance.find({ user: userId, date: { $gte: monthStart, $lt: monthEnd } }).select("date"),
    LeaveRequest.find({
      requester: userId,
      status: "approved",
      startDate: { $lt: monthEnd },
      endDate: { $gte: monthStart },
    }).select("startDate endDate"),
    WfhRequest.find({
      requester: userId,
      status: "approved",
      startDate: { $lt: monthEnd },
      endDate: { $gte: monthStart },
    }).select("startDate endDate"),
    companyId ? Company.findById(companyId).select("wfhDates weekendDates") : null,
    companyId
      ? Holiday.find({ company: companyId, startDate: { $lt: monthEnd }, endDate: { $gte: monthStart } }).select("startDate endDate")
      : [],
  ]);

  const presentDays = new Set<string>();
  const leaveDays = new Set<string>();
  const wfhDays = new Set<string>();
  const holidayDays = new Set<string>();
  const weekendDays = new Set<string>();
  const absentDays = new Set<string>();
  const activeDays = new Set<string>();

  attendanceRecords.forEach((record: any) => {
    presentDays.add(dateKey(startOfDay(new Date(record.date))));
  });
  leaveRecords.forEach((record: any) => addRangeDays(leaveDays, record.startDate, record.endDate, monthStart, monthEndInclusive));
  wfhRecords.forEach((record: any) => addRangeDays(wfhDays, record.startDate, record.endDate, monthStart, monthEndInclusive));
  holidays.forEach((record: any) => addRangeDays(holidayDays, record.startDate, record.endDate, monthStart, monthEndInclusive));
  (company?.wfhDates ?? []).forEach((entry: any) => {
    const date = startOfDay(new Date(String(entry.date)));
    if (date >= monthStart && date < monthEnd) wfhDays.add(dateKey(date));
  });
  let hasManualWeekends = false;
  (company?.weekendDates ?? []).forEach((entry: any) => {
    const date = startOfDay(new Date(String(entry.date)));
    if (date >= monthStart && date < monthEnd) {
      hasManualWeekends = true;
      weekendDays.add(dateKey(date));
    }
  });

  if (!hasManualWeekends) {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = startOfDay(new Date(year, monthNumber - 1, day));
      if (date.getDay() === 0) {
        weekendDays.add(dateKey(date));
      }
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = startOfDay(new Date(year, monthNumber - 1, day));
    if (date > attendanceWindowEnd) continue;
    const key = dateKey(date);
    const isBeforeJoined = date < joinedDate;
    if (isBeforeJoined) continue;

    activeDays.add(key);
    if (
      !presentDays.has(key) &&
      !leaveDays.has(key) &&
      !wfhDays.has(key) &&
      !holidayDays.has(key) &&
      !weekendDays.has(key)
    ) {
      absentDays.add(key);
    }
  }

  const counts = {
    present: presentDays.size,
    leave: leaveDays.size,
    wfh: wfhDays.size,
    holidays: holidayDays.size,
    weekends: weekendDays.size,
    absent: absentDays.size,
    activeDays: activeDays.size,
  };

  return NextResponse.json({
    month,
    counts,
    items: [
      { key: "present", label: "Present", value: counts.present },
      { key: "leave", label: "Leave", value: counts.leave },
      { key: "wfh", label: "WFH", value: counts.wfh },
      { key: "holidays", label: "Holidays", value: counts.holidays },
      { key: "weekends", label: "Weekends", value: counts.weekends },
      { key: "absent", label: "Absent", value: counts.absent },
    ],
  });
}
