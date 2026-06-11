import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { WfhRequest } from "@/models/WfhRequest";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { Company } from "@/models/Company";
import { Team } from "@/models/Team";
import { emitToUser } from "@/lib/socket-emit";
import { resolveEnrollingHr } from "@/lib/enrolling-hr";
import { findApprovedHrUserId } from "@/lib/join-approvers";
import { startOfDay, endOfDay } from "date-fns";

const ROLES_WITH_MANAGER_STEP = new Set(["employee", "others"]);
const DAY_MS = 1000 * 60 * 60 * 24;

function wfhWindow(date: Date, period: string) {
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

function overlapDuration(wfh: any, windowStart: Date, windowEnd: Date) {
  const start = startOfDay(new Date(wfh.startDate)) < windowStart
    ? windowStart
    : startOfDay(new Date(wfh.startDate));
  const end = startOfDay(new Date(wfh.endDate)) > windowEnd
    ? windowEnd
    : startOfDay(new Date(wfh.endDate));
  if (end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

async function notifyAdmins(companyId: string, body: string) {
  const admins = await User.find({ role: "admin", company: companyId, companyStatus: "approved" });
  for (const admin of admins) {
    await Notification.create({ user: admin._id, title: "WFH Request", body, link: "/profile?tab=attendance" });
    emitToUser(String(admin._id), "notification:new", {});
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const { startDate, endDate, reason, hrApprover } = await req.json();
    if (!startDate || !endDate || !reason) return jsonError("All fields are required.");

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 0) return jsonError("Invalid date range.");
    if (diffDays > 5) return jsonError("WFH requests longer than 5 days cannot be requested.");

    await connectDb();
    const user = await User.findById(userId).populate("team");
    if (!user) return jsonError("User not found.");
    if (!user.company) return jsonError("You must belong to a company to request WFH.", 400);

    // WFH quota check (mirrors paid leave pattern)
    const company = await Company.findById(user.company).select("wfhDays wfhPeriod wfhDates");
    if (!company) return jsonError("Company not found.", 404);
    const wfhDays = Math.max(0, Number(company.wfhDays ?? 0));
    const wfhPeriod = String(company.wfhPeriod ?? "monthly");
    if (wfhDays <= 0) {
      return jsonError("WFH is not configured for this company yet.", 409);
    }

    const quota = wfhWindow(start, wfhPeriod);
    const existingWfh = await WfhRequest.find({
      requester: userId,
      company: user.company,
      status: { $in: ["pending", "manager-approved", "hr-approved", "approved"] },
      startDate: { $lte: quota.end },
      endDate: { $gte: quota.start },
    }).select("startDate endDate duration");
    const usedWfhDays = existingWfh.reduce(
      (sum, w) => sum + overlapDuration(w, quota.start, quota.end),
      0,
    );

    // Count company-wide WFH dates within the same period
    const companyWfhDaysInPeriod = (company.wfhDates ?? []).filter((entry: any) => {
      const d = new Date(entry.date);
      return d >= quota.start && d <= quota.end;
    }).length;

    const totalUsedWfhDays = usedWfhDays + companyWfhDaysInPeriod;
    const remainingWfhDays = Math.max(0, wfhDays - totalUsedWfhDays);
    if (diffDays > remainingWfhDays) {
      return jsonError(
        `WFH quota exceeded. Remaining ${wfhPeriod} WFH: ${remainingWfhDays} day${remainingWfhDays === 1 ? "" : "s"}.`,
        409,
      );
    }

    const isManagerStep = ROLES_WITH_MANAGER_STEP.has(String(user.role));

    const wfhData: any = {
      requester: userId,
      company: user.company,
      startDate: start,
      endDate: end,
      duration: diffDays,
      reason,
      status: "pending",
      currentStep: isManagerStep ? "manager" : "hr",
    };
    if (hrApprover) {
      wfhData.hrApprover = hrApprover;
    }

    const wfh = await WfhRequest.create(wfhData);

    const requesterName = String(user.name ?? "User");
    const requesterRole = String(user.role ?? "unknown");
    const teamName = (user.team as any)?.name || "General";
    const companyId = String(user.company);
    const body = `${requesterName}: ${requesterRole}, from ${teamName} has requested WFH (${diffDays} day${diffDays === 1 ? "" : "s"}).`;

    if (isManagerStep) {
      // Employee/Others → Team Manager approves → then HR approves
      const team = user.team as any;
      let managerId: string | null = null;

      if (team?.manager) {
        const managerUser = await User.findOne({ _id: team.manager, companyStatus: "approved" }).select("_id");
        if (managerUser) managerId = String(managerUser._id);
      }

      if (managerId) {
        await Notification.create({ user: managerId, title: "WFH Request", body, link: "/profile?tab=attendance" });
        emitToUser(managerId, "notification:new", {});
      } else {
        // No manager, skip to HR step
        wfh.currentStep = "hr";
        await wfh.save();
        if (hrApprover) {
          const assignedHr = await User.findById(hrApprover).select("_id name");
          if (assignedHr) {
            await Notification.create({ user: assignedHr._id, title: "WFH Request", body: `${body} (No manager assigned, assigned to you)`, link: "/profile?tab=attendance" });
            emitToUser(String(assignedHr._id), "notification:new", {});
          } else {
            const enrollingHr = await resolveEnrollingHr(user);
            if (enrollingHr) {
              await Notification.create({ user: enrollingHr.id, title: "WFH Request", body: `${body} (No manager assigned)`, link: "/profile?tab=attendance" });
              emitToUser(enrollingHr.id, "notification:new", {});
            } else {
              const hrId = await findApprovedHrUserId(companyId as any);
              if (hrId) {
                await Notification.create({ user: hrId, title: "WFH Request", body: `${body} (No manager assigned)`, link: "/profile?tab=attendance" });
                emitToUser(hrId, "notification:new", {});
              } else {
                wfh.currentStep = "admin";
                await wfh.save();
                await notifyAdmins(companyId, `${body} (No HR available)`);
              }
            }
          }
        } else {
          const enrollingHr = await resolveEnrollingHr(user);
          if (enrollingHr) {
            await Notification.create({ user: enrollingHr.id, title: "WFH Request", body: `${body} (No manager assigned)`, link: "/profile?tab=attendance" });
            emitToUser(enrollingHr.id, "notification:new", {});
          } else {
            const hrId = await findApprovedHrUserId(companyId as any);
            if (hrId) {
              wfh.currentStep = "hr";
              await wfh.save();
              const hr = await User.findById(hrId).select("name");
              const hrName = String(hr?.name ?? "HR");
              await Notification.create({ user: hrId, title: "WFH Request", body: `${body} (No manager assigned)`, link: "/profile?tab=attendance" });
              emitToUser(hrId, "notification:new", {});
            } else {
              wfh.currentStep = "admin";
              await wfh.save();
              await notifyAdmins(companyId, `${body} (No HR available)`);
            }
          }
        }
      }
    } else {
      // Manager/Tester/HR/Finance → HR approves → then Admin approves
      if (hrApprover) {
        const assignedHr = await User.findById(hrApprover).select("_id name");
        if (assignedHr) {
          await Notification.create({ user: assignedHr._id, title: "WFH Request", body: `${body} (Assigned to you)`, link: "/profile?tab=attendance" });
          emitToUser(String(assignedHr._id), "notification:new", {});
        } else {
          // Fall back if assigned HR not found
          const enrollingHr = await resolveEnrollingHr(user);
          if (enrollingHr) {
            await Notification.create({ user: enrollingHr.id, title: "WFH Request", body, link: "/profile?tab=attendance" });
            emitToUser(enrollingHr.id, "notification:new", {});
          } else {
            const hrId = await findApprovedHrUserId(companyId as any);
            if (hrId) {
              await Notification.create({ user: hrId, title: "WFH Request", body, link: "/profile?tab=attendance" });
              emitToUser(hrId, "notification:new", {});
            } else {
              wfh.currentStep = "admin";
              await wfh.save();
              await notifyAdmins(companyId, `${body} (No HR available)`);
            }
          }
        }
      } else {
        const enrollingHr = await resolveEnrollingHr(user);
        if (enrollingHr) {
          await Notification.create({ user: enrollingHr.id, title: "WFH Request", body, link: "/profile?tab=attendance" });
          emitToUser(enrollingHr.id, "notification:new", {});
        } else {
          const hrId = await findApprovedHrUserId(companyId as any);
          if (hrId) {
            const hr = await User.findById(hrId).select("name");
            const hrName = String(hr?.name ?? "HR");
            await Notification.create({ user: hrId, title: "WFH Request", body, link: "/profile?tab=attendance" });
            emitToUser(hrId, "notification:new", {});
          } else {
            wfh.currentStep = "admin";
            await wfh.save();
            await notifyAdmins(companyId, `${body} (No HR available)`);
          }
        }
      }
    }

    return NextResponse.json({ wfh });
  } catch (err: any) {
    console.error("WFH creation error:", err);
    return jsonError(err.message || "Failed to submit WFH request", 500);
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);

  let requests: any = [];

  if (user.role === "admin") {
    requests = await WfhRequest.find({ company: user.company })
      .populate("requester", "name email role")
      .sort({ createdAt: -1 });
  } else if (user.role === "human-resource") {
    requests = await WfhRequest.find({
      company: user.company,
      $or: [
        { requester: { $ne: userId } },
        { requester: userId },
      ],
    })
      .populate("requester", "name email role")
      .sort({ createdAt: -1 });
  } else if (user.role === "project-manager" || user.role === "qa-tester") {
    const teams = await Team.find({ manager: userId, company: user.company }).select("employees");
    const teamMemberIds = teams.flatMap((t: any) =>
      (t.employees || []).map((e: any) => String(e._id || e)),
    );
    requests = await WfhRequest.find({
      company: user.company,
      $or: [
        { requester: userId },
        { requester: { $in: teamMemberIds }, currentStep: "manager" },
      ],
    })
      .populate("requester", "name email role")
      .sort({ createdAt: -1 });
  } else {
    requests = await WfhRequest.find({ company: user.company, requester: userId })
      .populate("requester", "name email role")
      .sort({ createdAt: -1 });
  }

  // Compute remaining WFH quota for the requester
  const company = await Company.findById(user.company).select("wfhDays wfhPeriod wfhDates");
  let wfhPolicy: Record<string, any> = { wfhDays: 0, wfhPeriod: "monthly", usedWfhDays: 0, remainingWfhDays: 0 };
  if (company) {
    const wfhDays = Math.max(0, Number(company.wfhDays ?? 0));
    const wfhPeriod = String(company.wfhPeriod ?? "monthly");

    // Pick the most relevant period: latest of today, user's WFH requests, or company WFH dates
    let refDate = new Date();
    const latestReq = await WfhRequest.findOne({
      requester: userId,
      company: user.company,
      status: { $in: ["pending", "manager-approved", "hr-approved", "approved"] },
    }).sort({ startDate: -1 }).select("startDate");
    if (latestReq && latestReq.startDate > refDate) refDate = latestReq.startDate;
    if (company.wfhDates && company.wfhDates.length > 0) {
      const latestCompany = company.wfhDates.reduce((latest: Date, entry: any) => {
        const d = new Date(entry.date);
        return d > latest ? d : latest;
      }, new Date(0));
      if (latestCompany > refDate) refDate = latestCompany;
    }

    const quota = wfhWindow(refDate, wfhPeriod);
    const ownWfh = await WfhRequest.find({
      requester: userId,
      company: user.company,
      status: { $in: ["pending", "manager-approved", "hr-approved", "approved"] },
      startDate: { $lte: quota.end },
      endDate: { $gte: quota.start },
    }).select("startDate endDate duration");
    const usedWfhDays = ownWfh.reduce(
      (sum, w) => sum + overlapDuration(w, quota.start, quota.end),
      0,
    );
    const companyWfhDaysInPeriod = (company.wfhDates ?? []).filter((entry: any) => {
      const d = new Date(entry.date);
      return d >= quota.start && d <= quota.end;
    }).length;
    const totalUsed = usedWfhDays + companyWfhDaysInPeriod;
    wfhPolicy = { wfhDays, wfhPeriod, usedWfhDays: totalUsed, remainingWfhDays: Math.max(0, wfhDays - totalUsed) };
  }

  return NextResponse.json({ requests, wfhPolicy });
}
