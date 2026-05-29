import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { LeaveRequest } from "@/models/LeaveRequest";
import { WfhRequest } from "@/models/WfhRequest";
import { FinanceSalary } from "@/models/FinanceSalary";
import { Holiday } from "@/models/Holiday";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: memberId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);
  if (String(actor.role) !== "finance") return jsonError("Only finance can view member attendance.", 403);
  const member = await User.findOne({ _id: memberId, company: actor.company, companyStatus: "approved" }).select("name email role baseSalary companyJoined createdAt");
  if (!member) return jsonError("Member not found.", 404);

  const url = new URL(request.url);
  const month = String(url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7));
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mon = Number(monthStr);

  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 1);

  const [attendanceRecords, leaveRecords, wfhRecords, holidays, salary] = await Promise.all([
    Attendance.find({
      user: memberId,
      date: { $gte: monthStart, $lt: monthEnd },
    }).sort({ date: 1 }),
    LeaveRequest.find({
      requester: memberId,
      status: { $in: ["approved", "pending", "manager-approved"] },
      startDate: { $lt: monthEnd },
      endDate: { $gte: monthStart },
    }).sort({ startDate: 1 }),
    WfhRequest.find({
      requester: memberId,
      status: "approved",
      startDate: { $lt: monthEnd },
      endDate: { $gte: monthStart },
    }).sort({ startDate: 1 }),
    Holiday.find({ company: actor.company, startDate: { $lt: monthEnd }, endDate: { $gte: monthStart } }).sort({ startDate: 1 }),
    FinanceSalary.findOne({ company: actor.company, employee: memberId, month }).select("netSalary baseSalary"),
  ]);

  const daysInMonth = new Date(year, mon, 0).getDate();
  const calendar: {
    day: number;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    leave: boolean;
    leaveReason: string;
    leaveStatus: string;
    absent: boolean;
    holiday: boolean;
    holidayTitle: string;
    notJoined: boolean;
    wfh: boolean;
    wfhReason: string;
    wfhDuration: number;
  }[] = [];

  const joinedDate = new Date(member.companyJoined || member.createdAt);
  joinedDate.setHours(0, 0, 0, 0);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, mon - 1, d);
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isBeforeJoined = date < joinedDate;

    const att = attendanceRecords.find((a: any) => {
      const aDate = new Date(a.date);
      return aDate.getFullYear() === year && aDate.getMonth() === mon - 1 && aDate.getDate() === d;
    });
    const leave = leaveRecords.find((l: any) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
    const holiday = holidays.find((h: any) => {
      const start = new Date(h.startDate);
      const end = new Date(h.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const wfh = wfhRecords.find((w: any) => {
      const start = new Date(w.startDate);
      const end = new Date(w.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });

    calendar.push({
      day: d,
      date: dateStr,
      checkIn: att ? new Date(att.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null,
      checkOut: att?.checkOut ? new Date(att.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null,
      leave: isBeforeJoined ? false : !!leave,
      leaveReason: isBeforeJoined ? "" : leave ? String(leave.reason ?? "") : "",
      leaveStatus: isBeforeJoined ? "Not Joined" : leave ? String(leave.status ?? "") : "",
      absent: isBeforeJoined ? false : (!att && !leave && !wfh && !isWeekend && !holiday),
      holiday: !!holiday,
      holidayTitle: holiday ? String(holiday.title ?? "") : "",
      notJoined: isBeforeJoined,
      wfh: !!wfh,
      wfhReason: wfh ? String(wfh.reason ?? "") : "",
      wfhDuration: wfh ? Number(wfh.duration) : 0,
    });
  }

  return NextResponse.json({
    member: { id: String(member._id), name: member.name, email: member.email, role: member.role, baseSalary: member.baseSalary },
    month,
    salary: salary ? { netSalary: salary.netSalary, baseSalary: salary.baseSalary } : null,
    calendar,
  });
}
