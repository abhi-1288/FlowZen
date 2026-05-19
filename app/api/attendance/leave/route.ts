import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Notification } from "@/models/Notification";
import { emitToUser } from "@/lib/socket-emit";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const { startDate, endDate, reason, attachmentUrl } = await req.json();
    if (!startDate || !endDate || !reason) return jsonError("All fields are required.");

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 0) return jsonError("Invalid date range.");
    if (diffDays > 15) return jsonError("Leaves longer than 15 days cannot be requested.");

    await connectDb();
    const user = await User.findById(userId).populate("team");
    if (!user) return jsonError("User not found.");
    if (!user.company) return jsonError("You must belong to a company to request leave.", 400);

    const teamName = (user.team as any)?.name || "General Team";
    const notificationBody = `${user.name}: ${user.role}, from ${teamName} has requested a leave.`;

    // Determine the first step approver
    let firstApproverRole: "manager" | "admin" = "manager";
    if (user.role === "project-manager" || user.role === "qa-tester" || user.role === "admin") {
      firstApproverRole = "admin";
    }

    // If requesting leave for today and user already checked in, treat as half-day
    let halfDay = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start.getTime() === today.getTime()) {
      const existingAttendance = await Attendance.findOne({ user: userId, date: today });
      if (existingAttendance) {
        halfDay = true;
      }
    }

    const leave = await LeaveRequest.create({
      requester: userId,
      company: user.company,
      startDate: start,
      endDate: end,
      duration: halfDay ? 0.5 : diffDays,
      halfDay,
      reason,
      attachmentUrl: attachmentUrl || "",
      status: "pending",
      currentStep: firstApproverRole
    });

    if (firstApproverRole === "manager") {
      const team = await Team.findOne({ employees: userId }).populate("manager");
      if (team?.manager) {
        const managerId = (team.manager as any)._id || team.manager;
        await Notification.create({
          user: managerId,
          title: "New Leave Request",
          body: notificationBody,
          link: "/profile?tab=attendance"
        });
        emitToUser(String(managerId), "notification:new", {});
      }
    } else {
      // Notify all admins
      const admins = await User.find({ role: "admin" });
      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          title: "New Leave Request",
          body: notificationBody,
          link: "/profile?tab=attendance"
        });
        emitToUser(String(admin._id), "notification:new", {});
      }
    }

    return NextResponse.json({ leave });
  } catch (err: any) {
    console.error("Leave creation error:", err);
    return jsonError(err.message || "Failed to submit leave request", 500);
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.");

  // If user is admin, they see all admin-step requests
  // If user is manager, they see requests from their team
  // Otherwise, user sees their own requests

  let requests;
  if (user.role === "admin") {
    requests = await LeaveRequest.find({ currentStep: "admin", status: { $in: ["pending", "manager-approved"] } })
      .populate("requester", "name email role")
      .sort({ createdAt: -1 });
  } else if (user.role === "project-manager" || user.role === "qa-tester") {
    const teams = await Team.find({ manager: userId });
    const teamUserIds = teams.flatMap(t => t.employees);
    const ownQuery: any = { requester: userId };
    if (user.company) {
      ownQuery.company = user.company;
    }
    requests = await LeaveRequest.find({ 
      $or: [
        ownQuery,
        { requester: { $in: teamUserIds }, currentStep: "manager", status: "pending" }
      ]
    }).populate("requester", "name email role").sort({ createdAt: -1 });
  } else {
    const query: any = { requester: userId };
    if (user.company) {
      query.company = user.company;
    }
    requests = await LeaveRequest.find(query).populate("requester", "name email role").sort({ createdAt: -1 });
  }

  return NextResponse.json({ requests });
}
