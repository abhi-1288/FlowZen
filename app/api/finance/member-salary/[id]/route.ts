import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { FinanceSalary } from "@/models/FinanceSalary";
import { User } from "@/models/User";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: memberId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  
  await connectDb();
  
  const actor = await User.findById(userId).select("role company companyStatus name");
  if (!actor || !actor.company || actor.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }
  if (String(actor.role) !== "finance") {
    return jsonError("Only finance can update member salary.", 403);
  }
  
  const member = await User.findOne({ _id: memberId, company: actor.company, companyStatus: "approved" });
  if (!member) return jsonError("Member not found.", 404);

  let body: { baseSalary?: number; amount?: number; salaryType?: string };
  try {
    body = await request.json();
  } catch (err) {
    return jsonError("Invalid JSON", 400);
  }

  if (typeof body.baseSalary !== "number" && typeof body.amount !== "number") {
    return jsonError("Invalid salary amount", 400);
  }

  const salaryType =
    typeof body.salaryType === "string" &&
    ["per-annum", "per-month", "per-day", "per-hour"].includes(body.salaryType)
      ? body.salaryType
      : "per-month";

  const rawAmount = Math.max(0, Number(body.amount ?? body.baseSalary ?? 0));
  if (!Number.isFinite(rawAmount) || rawAmount < 0) {
    return jsonError("Invalid salary amount", 400);
  }

  // Find the HR who enrolled the user
  let approverId = null;
  if (Array.isArray(member.membershipHistory)) {
    const joinedEvent = member.membershipHistory.find((h: any) => h.action === "joined-company" && String(h.company) === String(actor.company));
    if (joinedEvent && joinedEvent.inviter) {
      // Check if inviter is still HR and active
      const inviter = await User.findOne({ _id: joinedEvent.inviter, company: actor.company, role: "human-resource", companyStatus: "approved" }).select("_id");
      if (inviter) {
        approverId = String(inviter._id);
      }
    }
  }

  // Fallback to any HR
  if (!approverId) {
    const hr = await User.findOne({ company: actor.company, role: "human-resource", companyStatus: "approved" }).select("_id");
    if (hr) approverId = String(hr._id);
  }

  // Fallback to any admin
  if (!approverId) {
    const admin = await User.findOne({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
    if (admin) approverId = String(admin._id);
  }

  if (!approverId) {
    return jsonError("No HR or admin found to approve the salary increment.", 404);
  }

  const existing = await JoinRequest.findOne({
    company: actor.company,
    kind: "salary-increment",
    status: { $in: ["pending", "hr-approved"] },
    "metadata.targetUser": memberId
  });

  if (existing) {
    existing.status = "rejected";
    existing.cancelReason = "Superseded by a new salary update from finance.";
    existing.cancelledAt = new Date();
    await existing.save();
  }

  const salaryAmount = rawAmount;
  const oldSalary = Math.max(
    0,
    Number(
      salaryType === "per-hour"
        ? member.hourlyRate ?? 0
        : salaryType === "per-day"
          ? member.dailyRate ?? 0
          : member.baseSalary ?? 0,
    ),
  );

  if (salaryType === "per-hour") {
    member.salaryType = "per-hour";
    member.hourlyRate = salaryAmount;
    member.dailyRate = 0;
    member.baseSalary = 0;
  } else if (salaryType === "per-day") {
    member.salaryType = "per-day";
    member.dailyRate = salaryAmount;
    member.hourlyRate = 0;
    member.baseSalary = 0;
  } else {
    const baseSalary =
      salaryType === "per-annum" ? Math.round(salaryAmount / 12) : salaryAmount;
    member.salaryType = salaryType;
    member.baseSalary = baseSalary;
    member.hourlyRate = 0;
    member.dailyRate = 0;
  }

  if (!Array.isArray(member.salaryHistory)) member.salaryHistory = [];
  member.salaryHistory.push({
    amount: salaryAmount,
    date: new Date(),
    type: salaryAmount >= oldSalary ? "increment" : "decrement",
  });
  await member.save();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const recordUpdate: Record<string, any> = {
    allowances: 0,
    deductions: 0,
    netSalary: salaryAmount,
    status: "pending",
  };
  if (salaryType === "per-hour" || salaryType === "per-day") {
    recordUpdate.baseSalary = 0;
  } else {
    recordUpdate.baseSalary = salaryAmount;
  }
  await FinanceSalary.findOneAndUpdate(
    { company: actor.company, employee: member._id, month: currentMonth, kind: "monthly" },
    { $set: recordUpdate },
    { upsert: true },
  );

  await JoinRequest.create({
    requester: userId,
    approver: approverId,
    company: actor.company,
    kind: "salary-increment",
    status: "pending",
    metadata: {
      targetUser: memberId,
      targetUserName: member.name,
      newBaseSalary: salaryAmount,
      oldBaseSalary: oldSalary,
      salaryType,
    }
  });

  await Notification.create({
    user: approverId,
    company: actor.company,
    type: "approval",
    title: "Salary Update Approval Required",
    message: `Finance (${actor.name}) requested a salary update for ${member.name} to ₹${salaryAmount.toLocaleString("en-IN")}/${salaryType.replace("per-", "").replace("annum", "year")}.`,
  });
  emitNotification(String(approverId));

  return NextResponse.json({ success: true, salaryType, amount: salaryAmount });
}
