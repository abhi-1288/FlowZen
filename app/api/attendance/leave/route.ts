import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { Company } from "@/models/Company";
import { emitToUser } from "@/lib/socket-emit";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function leaveWindow(date: Date, period: string) {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (period === "yearly") {
    return {
      start: new Date(year, 0, 1),
      end: endOfDay(new Date(year, 11, 31)),
    };
  }
  return {
    start: new Date(year, month, 1),
    end: endOfDay(new Date(year, month + 1, 0)),
  };
}

function overlapDuration(leave: any, windowStart: Date, windowEnd: Date) {
  const start = startOfDay(new Date(leave.startDate)) < windowStart
    ? windowStart
    : startOfDay(new Date(leave.startDate));
  const end = startOfDay(new Date(leave.endDate)) > windowEnd
    ? windowEnd
    : startOfDay(new Date(leave.endDate));
  if (end < start) return 0;
  const days = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return leave.halfDay ? Math.min(0.5, days) : days;
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const { startDate, endDate, reason, attachmentUrl, hrApprover } = await req.json();
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
    if (String(user.role) === "admin") return jsonError("Admins cannot request paid leave.", 403);

    const company = await Company.findById(user.company).select("paidLeaveDays paidLeavePeriod carryForwardLeaveDays");
    if (!company) return jsonError("Company not found.", 404);
    const paidLeaveDays = Math.max(0, Number(company.paidLeaveDays ?? 0));
    const paidLeavePeriod = String(company.paidLeavePeriod ?? "monthly");
    if (paidLeaveDays <= 0) {
      return jsonError("Paid leave is not configured for this company yet.", 409);
    }

    const teamName = (user.team as any)?.name || "General Team";
    const notificationBody = `${user.name}: ${user.role}, from ${teamName} has requested a leave.`;

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

    const requestedDuration = halfDay ? 0.5 : diffDays;
    const quota = leaveWindow(start, paidLeavePeriod);
    const existingLeaves = await LeaveRequest.find({
      requester: userId,
      company: user.company,
      isPaidLeave: { $ne: false },
      status: { $in: ["pending", "hr-approved", "manager-approved", "approved"] },
      startDate: { $lte: quota.end },
      endDate: { $gte: quota.start },
    }).select("startDate endDate duration halfDay");
    const usedLeaveDays = existingLeaves.reduce(
      (sum, leave) => sum + overlapDuration(leave, quota.start, quota.end),
      0,
    );
    let carryForward = 0;
    if (company.carryForwardLeaveDays) {
      const prevQuota = leaveWindow(new Date(quota.start.getTime() - 1), paidLeavePeriod);
      const prevLeaves = await LeaveRequest.find({
        requester: userId,
        company: user.company,
        isPaidLeave: { $ne: false },
        status: { $in: ["pending", "hr-approved", "manager-approved", "approved"] },
        startDate: { $lte: prevQuota.end },
        endDate: { $gte: prevQuota.start },
      }).select("startDate endDate duration halfDay");
      const usedPrev = prevLeaves.reduce(
        (sum, leave) => sum + overlapDuration(leave, prevQuota.start, prevQuota.end),
        0,
      );
      carryForward = Math.max(0, paidLeaveDays - usedPrev);
    }
    const totalAvailable = paidLeaveDays + carryForward;
    const remainingLeaveDays = Math.max(0, totalAvailable - usedLeaveDays);
    if (requestedDuration > remainingLeaveDays) {
      return jsonError(
        `Paid leave quota exceeded. Remaining ${paidLeavePeriod} paid leave: ${remainingLeaveDays} day${remainingLeaveDays === 1 ? "" : "s"}.`,
        409,
      );
    }

    const leaveData: any = {
      requester: userId,
      company: user.company,
      startDate: start,
      endDate: end,
      duration: requestedDuration,
      halfDay,
      isPaidLeave: true,
      reason,
      attachmentUrl: attachmentUrl || "",
      status: "pending",
      currentStep: "hr"
    };
    if (hrApprover && String(hrApprover) !== String(userId)) {
      leaveData.hrApprover = hrApprover;
    }

    const leave = await LeaveRequest.create(leaveData);

    if (leaveData.hrApprover) {
      const assignedHr = await User.findById(leaveData.hrApprover).select("_id");
      if (assignedHr) {
        await Notification.create({
          user: assignedHr._id,
          title: "Paid Leave Request",
          body: `${notificationBody} (Assigned to you)`,
          link: "/profile?tab=attendance"
        });
        emitToUser(String(assignedHr._id), "notification:new", {});
      }
    } else {
      const hrs = String(user.role) === "human-resource"
        ? await User.find({
          _id: { $ne: userId },
          role: "human-resource",
          company: user.company,
          companyStatus: "approved",
        })
        : await User.find({ role: "human-resource", company: user.company, companyStatus: "approved" });

      if (hrs.length > 0) {
        for (const hr of hrs) {
          await Notification.create({
            user: hr._id,
            title: "Paid Leave Request",
            body: notificationBody,
            link: "/profile?tab=attendance"
          });
          emitToUser(String(hr._id), "notification:new", {});
        }
      } else {
        const admins = await User.find({ role: "admin", company: user.company, companyStatus: "approved" });
        for (const admin of admins) {
          await Notification.create({
            user: admin._id,
            title: "Paid Leave Request",
            body: `${notificationBody} No HR is available, admin approval required.`,
            link: "/profile?tab=attendance"
          });
          emitToUser(String(admin._id), "notification:new", {});
        }
        leave.currentStep = "admin";
        await leave.save();
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
  if (!user) return jsonError("User not found.", 404);
  const company = user.company
    ? await Company.findById(user.company).select("paidLeaveDays paidLeavePeriod carryForwardLeaveDays")
    : null;
  const paidLeaveDays = Math.max(0, Number(company?.paidLeaveDays ?? 0));
  const paidLeavePeriod = String(company?.paidLeavePeriod ?? "monthly");
  const quota = leaveWindow(new Date(), paidLeavePeriod);
  const ownPaidLeaves = user.company
    ? await LeaveRequest.find({
      requester: userId,
      company: user.company,
      isPaidLeave: { $ne: false },
      status: { $in: ["pending", "hr-approved", "manager-approved", "approved"] },
      startDate: { $lte: quota.end },
      endDate: { $gte: quota.start },
    }).select("startDate endDate duration halfDay")
    : [];
  const usedPaidLeaveDays = ownPaidLeaves.reduce(
    (sum, leave) => sum + overlapDuration(leave, quota.start, quota.end),
    0,
  );
  let carryForwardLeaveDays = 0;
  if (company?.carryForwardLeaveDays) {
    const prevQuota = leaveWindow(new Date(quota.start.getTime() - 1), paidLeavePeriod);
    const prevLeaves = user.company
      ? await LeaveRequest.find({
        requester: userId,
        company: user.company,
        isPaidLeave: { $ne: false },
        status: { $in: ["pending", "hr-approved", "manager-approved", "approved"] },
        startDate: { $lte: prevQuota.end },
        endDate: { $gte: prevQuota.start },
      }).select("startDate endDate duration halfDay")
      : [];
    const usedPrev = prevLeaves.reduce(
      (sum, leave) => sum + overlapDuration(leave, prevQuota.start, prevQuota.end),
      0,
    );
    carryForwardLeaveDays = Math.max(0, paidLeaveDays - usedPrev);
  }

  // Base query: all leave requests for the same company
  let query: any = { company: user.company };
  let requests: any = [];

    if (user.role === "admin") {
      requests = await LeaveRequest.find({
        ...query,
        status: { $in: ["pending", "hr-approved", "manager-approved", "approved", "rejected"] },
      })
        .populate("requester", "name email role")
        .sort({ createdAt: -1 });
    } else if (user.role === "human-resource") {
      requests = await LeaveRequest.find({
        ...query,
        $or: [
          { requester: { $ne: userId }, status: { $in: ["pending", "hr-approved", "manager-approved", "approved", "rejected"] } },
          { requester: userId },
        ],
      })
        .populate("requester", "name email role")
        .sort({ createdAt: -1 });
    } else if (user.role === "finance") {
      requests = await LeaveRequest.find({
        ...query,
        requester: userId,
      })
        .populate("requester", "name email role")
        .sort({ createdAt: -1 });
  } else if (user.role === "project-manager" || user.role === "qa-tester") {
    const ownQuery: any = { requester: userId };
    if (user.company) {
      ownQuery.company = user.company;
    }
    requests = await LeaveRequest.find(ownQuery).populate("requester", "name email role").sort({ createdAt: -1 });
  } else {
    const query: any = { requester: userId };
    if (user.company) {
      query.company = user.company;
    }
    requests = await LeaveRequest.find(query).populate("requester", "name email role").sort({ createdAt: -1 });
  }

  const totalAvailable = paidLeaveDays + carryForwardLeaveDays;

  return NextResponse.json({
    requests,
    leavePolicy: {
      paidLeaveDays,
      paidLeavePeriod,
      usedPaidLeaveDays,
      carryForwardLeaveDays,
      remainingPaidLeaveDays: Math.max(0, totalAvailable - usedPaidLeaveDays),
    },
  });
}
