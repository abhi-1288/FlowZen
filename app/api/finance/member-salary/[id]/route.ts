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

  let body: { baseSalary?: number };
  try {
    body = await request.json();
  } catch (err) {
    return jsonError("Invalid JSON", 400);
  }

  if (typeof body.baseSalary !== "number" || body.baseSalary < 0) {
    return jsonError("Invalid baseSalary", 400);
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

  const salaryAmount = body.baseSalary;
  const oldSalary = Math.max(0, Number(member.baseSalary ?? 0));
  member.baseSalary = salaryAmount;
  if (!Array.isArray(member.salaryHistory)) member.salaryHistory = [];
  member.salaryHistory.push({
    amount: salaryAmount,
    date: new Date(),
    type: salaryAmount >= oldSalary ? "increment" : "decrement",
  });
  await member.save();

  const currentMonth = new Date().toISOString().slice(0, 7);
  await FinanceSalary.findOneAndUpdate(
    { company: actor.company, employee: member._id, month: currentMonth },
    {
      $set: {
        baseSalary: salaryAmount,
        allowances: 0,
        deductions: 0,
        netSalary: salaryAmount,
        status: "pending",
      },
    },
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
      newBaseSalary: body.baseSalary,
      oldBaseSalary: oldSalary
    }
  });

  await Notification.create({
    user: approverId,
    company: actor.company,
    type: "approval",
    title: "Salary Update Approval Required",
    message: `Finance (${actor.name}) requested a salary update for ${member.name} to ₹${body.baseSalary.toLocaleString("en-IN")}.`,
  });
  emitNotification(String(approverId));

  return NextResponse.json({ success: true, baseSalary: salaryAmount });
}
