import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

const ALLOWED_NOTICE_PERIOD_DAYS = new Set([5, 15, 30, 45, 60, 90]);
const ALLOWED_PAID_LEAVE_PERIODS = new Set(["monthly", "yearly"]);

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const hasNoticePeriod = Object.prototype.hasOwnProperty.call(body, "noticePeriodDays");
  const hasPaidLeaveDays = Object.prototype.hasOwnProperty.call(body, "paidLeaveDays");
  const hasPaidLeavePeriod = Object.prototype.hasOwnProperty.call(body, "paidLeavePeriod");
  const noticePeriodDays = Number((body as any).noticePeriodDays);
  const paidLeaveDays = Number((body as any).paidLeaveDays);
  const paidLeavePeriod = String((body as any).paidLeavePeriod ?? "");

  if (hasNoticePeriod && (!Number.isFinite(noticePeriodDays) || !ALLOWED_NOTICE_PERIOD_DAYS.has(noticePeriodDays))) {
    return jsonError("Invalid notice period.", 400);
  }
  if (hasPaidLeaveDays && (!Number.isFinite(paidLeaveDays) || paidLeaveDays < 0 || paidLeaveDays > 365)) {
    return jsonError("Invalid paid leave days.", 400);
  }
  if (hasPaidLeavePeriod && !ALLOWED_PAID_LEAVE_PERIODS.has(paidLeavePeriod)) {
    return jsonError("Invalid paid leave period.", 400);
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const hr = await User.findById(userId);
  if (!hr) return jsonError("User not found.", 404);
  if (hr.role !== "human-resource" || hr.companyStatus !== "approved" || !hr.company) {
    return jsonError("Only approved HR can update policy.", 403);
  }

  const company = await Company.findById(hr.company);
  if (!company) return jsonError("Company not found.", 404);

  if (hasNoticePeriod) company.noticePeriodDays = noticePeriodDays;
  if (hasPaidLeaveDays) company.paidLeaveDays = Math.floor(paidLeaveDays);
  if (hasPaidLeavePeriod) company.paidLeavePeriod = paidLeavePeriod;
  await company.save();

  if (hasPaidLeaveDays || hasPaidLeavePeriod) {
    const targets = new Set<string>(
      (company.members ?? []).map((member: any) => String(member))
    );
    targets.add(String(company.owner));

    const body = `Paid leave policy updated: ${Math.floor(Number(company.paidLeaveDays ?? 0))} day(s) per ${String(company.paidLeavePeriod ?? "monthly")}`;

    await Notification.insertMany(
      Array.from(targets).map((targetUserId) => ({
        user: targetUserId,
        company: company._id,
        type: "system",
        title: "Paid Leave Policy Updated",
        body,
      }))
    );
    Array.from(targets).forEach((target) => emitNotification(target));
  }

  return NextResponse.json({
    ok: true,
    noticePeriodDays: company.noticePeriodDays,
    paidLeaveDays: company.paidLeaveDays,
    paidLeavePeriod: company.paidLeavePeriod,
  });
}

