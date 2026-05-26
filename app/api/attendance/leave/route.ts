import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Notification } from "@/models/Notification";
import { emitToUser } from "@/lib/socket-emit";
import { emitNotification } from "@/lib/realtime";

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
    if (["project-manager", "qa-tester", "finance", "admin"].includes(String(user.role))) {
      firstApproverRole = "admin";
    }
    // HR leaves also go to admin (or another HR)
    if (String(user.role) === "human-resource") {
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

    // Notify admin(s)
    const admins = await User.find({ role: "admin", company: user.company, companyStatus: "approved" });
    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        title: "New Leave Request",
        body: notificationBody,
        link: "/profile?tab=attendance"
      });
      emitToUser(String(admin._id), "notification:new", {});
    }

    // For PM/QA/Finance/Admin roles, also notify HR
    if (["project-manager", "qa-tester", "finance", "admin"].includes(String(user.role))) {
      const hrs = await User.find({ role: "human-resource", company: user.company, companyStatus: "approved" });
      for (const hr of hrs) {
        await Notification.create({
          user: hr._id,
          title: "New Leave Request",
          body: notificationBody,
          link: "/profile?tab=attendance"
        });
        emitToUser(String(hr._id), "notification:new", {});
      }
    }

    // For HR leaves, find another HR or fall back to admin (already notified above)
    if (String(user.role) === "human-resource") {
      const otherHr = await User.findOne({
        _id: { $ne: userId },
        role: "human-resource",
        company: user.company,
        companyStatus: "approved",
      }).select("_id");
      if (otherHr) {
        await Notification.create({
          user: otherHr._id,
          title: "New Leave Request",
          body: `${user.name} (HR) has requested a leave.`,
          link: "/profile?tab=attendance"
        });
        emitToUser(String(otherHr._id), "notification:new", {});
      }
      // admins already notified above
    }

    // For regular employees, also notify the team manager
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

  let requests;
  if (user.role === "admin") {
    requests = await LeaveRequest.find({
      company: user.company,
      status: { $in: ["pending", "manager-approved"] },
      currentStep: "admin",
    })
      .populate("requester", "name email role")
      .sort({ createdAt: -1 });
  } else if (user.role === "human-resource") {
    requests = await LeaveRequest.find({
      company: user.company,
      status: { $in: ["pending", "manager-approved"] },
      currentStep: "admin",
      requester: { $ne: userId },
    })
      .populate("requester", "name email role")
      .sort({ createdAt: -1 });
  } else if (user.role === "finance") {
    requests = await LeaveRequest.find({
      company: user.company,
      $or: [
        { currentStep: "admin", status: { $in: ["pending", "manager-approved"] } },
        { requester: userId },
      ],
    })
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
