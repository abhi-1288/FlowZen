import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Team } from "@/models/Team";
import { User } from "@/models/User";

function startOfDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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

  const [members, attendanceRows, leaveRows] = await Promise.all([
    User.find({ _id: { $in: memberIds } })
      .select("name email role customRole")
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

  const headers = [
    "Date",
    "Name",
    "Email",
    "Role",
    "Status",
    "Check In",
    "Check Out",
    "Leave Reason",
  ];
  const lines = [headers.map(csvCell).join(",")];

  for (const member of members as any[]) {
    for (let offset = 0; offset < dayCount; offset += 1) {
      const date = new Date(from);
      date.setDate(from.getDate() + offset);
      const key = `${String(member._id)}:${isoDay(date)}`;
      const attendance = attendanceByUserDay.get(key);
      const leave = leaveByUserDay.get(key);
      const status = attendance ? "Present" : leave ? "Leave" : "Absent";
      const roleLabel =
        String(member.role ?? "") === "others" && member.customRole
          ? `Others | ${String(member.customRole)}`
          : String(member.role ?? "");

      lines.push(
        [
          isoDay(date),
          member.name ?? "",
          member.email ?? "",
          roleLabel,
          status,
          formatTime(attendance?.checkIn),
          formatTime(attendance?.checkOut),
          leave?.reason ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  const filename = `attendance-${isoDay(from)}-to-${isoDay(to)}.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
