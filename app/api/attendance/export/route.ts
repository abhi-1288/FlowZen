import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { Company } from "@/models/Company";
import { Holiday } from "@/models/Holiday";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { WfhRequest } from "@/models/WfhRequest";


/** Parse a date string and return midnight local time (or null if invalid). */
function startOfDay(value: string): Date | null {
  if (!value) return null;
  // "YYYY-MM-DD" strings must be parsed as LOCAL midnight, not UTC midnight.
  // Split manually to avoid the UTC-midnight pitfall of new Date("YYYY-MM-DD").
  const parts = value.split("T")[0].split("-");
  if (parts.length < 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1; // 0-indexed
  const day = Number(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day, 0, 0, 0, 0);
}

/** Return 23:59:59.999 on the same local day as the given date. */
function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Escape a value for CSV output. */
function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function isoDay(date: Date) {
  // Convert to local date string (YYYY-MM-DD) accounting for timezone offset
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return local.toISOString().slice(0, 10);
}

function memberIdentity(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.split("-").filter(Boolean).at(-1) ?? text;
}

function safeFilenamePart(value: unknown) {
  const text = String(value ?? "company").trim();
  return (
    text
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "company"
  );
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const url = new URL(request.url);
  const from = startOfDay(url.searchParams.get("from") ?? "");
  const to = startOfDay(url.searchParams.get("to") ?? "");
  if (!from || !to) return jsonError("Start and end dates are required.");
  if (from.getTime() > to.getTime()) return jsonError("Start date must be before end date.");

  const dayCount = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (dayCount > 92) return jsonError("Attendance exports are limited to 92 days.");

  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must belong to an approved company to export attendance.", 403);
  }

  const role = String(actor.role ?? "");
  let memberIds: string[] = [];
  if (["admin", "human-resource", "finance"].includes(role)) {
    const members = await User.find({
      company: actor.company,
      companyStatus: "approved",
    }).select("_id");
    memberIds = members.map((member) => String(member._id));
  } else if (["project-manager", "qa-tester"].includes(role)) {
    const teams = await Team.find({ manager: userId }).select("employees");
    memberIds = Array.from(
      new Set([
        userId,
        ...teams.flatMap((team: any) =>
          Array.isArray(team.employees)
            ? team.employees.map((employeeId: unknown) => String(employeeId))
            : [],
        ),
      ]),
    );
  } else {
    memberIds = [userId];
  }

  const [members, attendanceRows, leaveRows, wfhRows, holidayRows, company] = await Promise.all([
    User.find({ _id: { $in: memberIds } })
      .select("name email role customRole companyIdentityCode companyJoined createdAt")
      .sort({ name: 1 }),
    Attendance.find({
      user: { $in: memberIds },
      date: { $gte: from, $lte: endOfDay(to) },
    }).lean(),
    LeaveRequest.find({
      requester: { $in: memberIds },
      status: "approved",
      startDate: { $lte: endOfDay(to) },
      endDate: { $gte: from },
    }).lean(),
    WfhRequest.find({
      requester: { $in: memberIds },
      status: "approved",
      startDate: { $lte: endOfDay(to) },
      endDate: { $gte: from },
    }).lean(),
    Holiday.find({
      company: actor.company,
      startDate: { $lte: endOfDay(to) },
      endDate: { $gte: from },
    }).lean(),
    Company.findById(actor.company).select("name wfhDates weekendDates").lean(),
  ]);

  const attendanceByUserDay = new Map<string, any>();
  attendanceRows.forEach((entry: any) => {
    attendanceByUserDay.set(`${String(entry.user)}:${isoDay(new Date(entry.date))}`, entry);
  });

  const leaveByUserDay = new Map<string, any>();
  leaveRows.forEach((leave: any) => {
    const current = startOfDay(String(leave.startDate));
    const last = startOfDay(String(leave.endDate));
    if (!current || !last) return;
    while (current.getTime() <= last.getTime()) {
      if (current.getTime() >= from.getTime() && current.getTime() <= to.getTime()) {
        leaveByUserDay.set(`${String(leave.requester)}:${isoDay(current)}`, leave);
      }
      current.setDate(current.getDate() + 1);
    }
  });

  const wfhByUserDay = new Map<string, any>();
  wfhRows.forEach((wfh: any) => {
    const current = startOfDay(String(wfh.startDate));
    const last = startOfDay(String(wfh.endDate));
    if (!current || !last) return;
    while (current.getTime() <= last.getTime()) {
      if (current.getTime() >= from.getTime() && current.getTime() <= to.getTime()) {
        wfhByUserDay.set(`${String(wfh.requester)}:${isoDay(current)}`, wfh);
      }
      current.setDate(current.getDate() + 1);
    }
  });

  const holidayByDay = new Map<string, any>();
  holidayRows.forEach((holiday: any) => {
    const current = startOfDay(String(holiday.startDate));
    const last = startOfDay(String(holiday.endDate));
    if (!current || !last) return;
    while (current.getTime() <= last.getTime()) {
      if (current.getTime() >= from.getTime() && current.getTime() <= to.getTime()) {
        holidayByDay.set(isoDay(current), holiday);
      }
      current.setDate(current.getDate() + 1);
    }
  });

  const companyWfhDays = new Set<string>();
  ((company as any)?.wfhDates ?? []).forEach((entry: any) => {
    const date = startOfDay(String(entry.date));
    if (!date) return;
    if (date.getTime() >= from.getTime() && date.getTime() <= to.getTime()) {
      companyWfhDays.add(isoDay(date));
    }
  });

  const assignedWeekendsByMonth = new Map<string, boolean>();
  ((company as any)?.weekendDates ?? []).forEach((entry: any) => {
    const date = startOfDay(String(entry.date));
    if (date) {
      assignedWeekendsByMonth.set(date.toISOString().slice(0, 7), true);
    }
  });

  const companyWeekendDays = new Set<string>();
  ((company as any)?.weekendDates ?? []).forEach((entry: any) => {
    const date = startOfDay(String(entry.date));
    if (!date) return;
    if (date.getTime() >= from.getTime() && date.getTime() <= to.getTime()) {
      companyWeekendDays.add(isoDay(date));
    }
  });

  const dates = Array.from({ length: dayCount }, (_, offset) => {
    const date = new Date(from);
    date.setDate(from.getDate() + offset);
    return date;
  });

  const headers = ["S.No", "ID", "Name", ...dates.map(isoDay)];
  const lines = [headers.map(csvCell).join(",")];

  (members as any[]).forEach((member, index) => {
    const joinedAt = startOfDay(String(member.companyJoined || member.createdAt));
    const memberId = String(member._id);
    const identity = memberIdentity(member.companyIdentityCode, memberId);

    const statuses = dates.map((date) => {
      if (joinedAt && date.getTime() < joinedAt.getTime()) return "Not Joined";

      const dateText = isoDay(date);
      const key = `${String(member._id)}:${isoDay(date)}`;
      const attendance = attendanceByUserDay.get(key);
      const leave = leaveByUserDay.get(key);
      const wfh = wfhByUserDay.get(key);
      const holiday = holidayByDay.get(dateText);

      if (attendance) return "Present";
      if (leave) return "Leave";
      if (wfh || companyWfhDays.has(dateText)) return "WFH";
      if (holiday) return "Holiday";
      if (companyWeekendDays.has(dateText) || (!assignedWeekendsByMonth.has(dateText.slice(0, 7)) && date.getDay() === 0)) return "Weekend";
      return "Absent";
    });

    lines.push(
      [index + 1, identity, member.name ?? "", ...statuses]
        .map(csvCell)
        .join(","),
    );
  });

  const companyName = safeFilenamePart((company as any)?.name);
  const filename = `${companyName}-${isoDay(from)}-to-${isoDay(to)}.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
