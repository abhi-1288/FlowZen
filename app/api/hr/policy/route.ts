import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

const ALLOWED_NOTICE_PERIOD_DAYS = new Set([5, 15, 30, 45, 60, 90]);
const ALLOWED_PAID_LEAVE_PERIODS = new Set(["monthly", "yearly"]);

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("company companyStatus role");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved" || !["human-resource", "admin"].includes(String(user.role))) {
    return jsonError("Only approved HR or admins can view policy.", 403);
  }

  const company = await Company.findById(user.company).select(
    "noticePeriodDays paidLeaveDays paidLeavePeriod wfhDays wfhPeriod carryForwardLeaveDays carryForwardWfhDays minWorkHours",
  );
  let policy = await CompanyPolicy.findOne({ company: user.company });
  if (!policy) {
    policy = await CompanyPolicy.create({ company: user.company });
  }

  return NextResponse.json({
    company: {
      noticePeriodDays: company?.noticePeriodDays ?? 30,
      paidLeaveDays: company?.paidLeaveDays ?? 0,
      paidLeavePeriod: company?.paidLeavePeriod ?? "monthly",
      wfhDays: company?.wfhDays ?? 0,
      wfhPeriod: company?.wfhPeriod ?? "monthly",
      carryForwardLeaveDays: company?.carryForwardLeaveDays ?? false,
      carryForwardWfhDays: company?.carryForwardWfhDays ?? false,
      minWorkHours: company?.minWorkHours ?? 8,
    },
    settlement: {
      enabled: policy.settlementEnabled !== false,
      hourDays: Number(policy.settlementHourDays ?? 1),
      dayDays: Number(policy.settlementDayDays ?? 2),
      monthDays: Number(policy.settlementMonthDays ?? 10),
      noticeRule: (policy.settlementNoticeRule?.toObject?.() ?? {}) as Record<string, boolean>,
    },
  });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const hasNoticePeriod = Object.prototype.hasOwnProperty.call(body, "noticePeriodDays");
  const hasPaidLeaveDays = Object.prototype.hasOwnProperty.call(body, "paidLeaveDays");
  const hasPaidLeavePeriod = Object.prototype.hasOwnProperty.call(body, "paidLeavePeriod");
  const hasCarryForwardLeave = Object.prototype.hasOwnProperty.call(body, "carryForwardLeaveDays");
  const hasMinWorkHours = Object.prototype.hasOwnProperty.call(body, "minWorkHours");
  const hasSettlementEnabled = Object.prototype.hasOwnProperty.call(body, "settlementEnabled");
  const hasSettlementHourDays = Object.prototype.hasOwnProperty.call(body, "settlementHourDays");
  const hasSettlementDayDays = Object.prototype.hasOwnProperty.call(body, "settlementDayDays");
  const hasSettlementMonthDays = Object.prototype.hasOwnProperty.call(body, "settlementMonthDays");
  const noticePeriodDays = Number((body as any).noticePeriodDays);
  const paidLeaveDays = Number((body as any).paidLeaveDays);
  const paidLeavePeriod = String((body as any).paidLeavePeriod ?? "");
  const minWorkHours = Number((body as any).minWorkHours);
  const settlementEnable = body.settlementEnabled === true;

  if (hasNoticePeriod && (!Number.isFinite(noticePeriodDays) || !ALLOWED_NOTICE_PERIOD_DAYS.has(noticePeriodDays))) {
    return jsonError("Invalid notice period.", 400);
  }
  if (hasPaidLeaveDays && (!Number.isFinite(paidLeaveDays) || paidLeaveDays < 0 || paidLeaveDays > 365)) {
    return jsonError("Invalid paid leave days.", 400);
  }
  if (hasPaidLeavePeriod && !ALLOWED_PAID_LEAVE_PERIODS.has(paidLeavePeriod)) {
    return jsonError("Invalid paid leave period.", 400);
  }
  const carryForwardLeaveDays = body.carryForwardLeaveDays === true;
  if (hasMinWorkHours && (!Number.isFinite(minWorkHours) || minWorkHours < 1 || minWorkHours > 24)) {
    return jsonError("Invalid minimum work hours.", 400);
  }

  const settlementHourDays = Number((body as any).settlementHourDays);
  const settlementDayDays = Number((body as any).settlementDayDays);
  const settlementMonthDays = Number((body as any).settlementMonthDays);
  if (hasSettlementHourDays && (!Number.isFinite(settlementHourDays) || settlementHourDays < 0 || settlementHourDays > 30)) {
    return jsonError("Invalid hourly settlement days.", 400);
  }
  if (hasSettlementDayDays && (!Number.isFinite(settlementDayDays) || settlementDayDays < 0 || settlementDayDays > 30)) {
    return jsonError("Invalid daily settlement days.", 400);
  }
  if (hasSettlementMonthDays && (!Number.isFinite(settlementMonthDays) || settlementMonthDays < 0 || settlementMonthDays > 90)) {
    return jsonError("Invalid monthly settlement days.", 400);
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
  if (!["human-resource", "admin"].includes(String(hr.role ?? "")) || hr.companyStatus !== "approved" || !hr.company) {
    return jsonError("Only approved HR or admins can update policy.", 403);
  }

  const company = await Company.findById(hr.company);
  if (!company) return jsonError("Company not found.", 404);

  if (hasNoticePeriod) company.noticePeriodDays = noticePeriodDays;
  if (hasPaidLeaveDays) company.paidLeaveDays = Math.floor(paidLeaveDays);
  if (hasPaidLeavePeriod) company.paidLeavePeriod = paidLeavePeriod;
  if (hasCarryForwardLeave) company.carryForwardLeaveDays = carryForwardLeaveDays;
  if (hasMinWorkHours) company.minWorkHours = Math.floor(minWorkHours);
  await company.save();

  const settlementFields: Record<string, unknown> = {};
  if (hasSettlementEnabled) settlementFields.settlementEnabled = settlementEnable;
  if (hasSettlementHourDays) settlementFields.settlementHourDays = Math.floor(settlementHourDays);
  if (hasSettlementDayDays) settlementFields.settlementDayDays = Math.floor(settlementDayDays);
  if (hasSettlementMonthDays) settlementFields.settlementMonthDays = Math.floor(settlementMonthDays);

  if (Object.keys(settlementFields).length > 0) {
    await CompanyPolicy.findOneAndUpdate(
      { company: hr.company },
      { $set: settlementFields },
      { upsert: true },
    );
  }

  const resp = NextResponse.json({
    ok: true,
    noticePeriodDays: company.noticePeriodDays,
    paidLeaveDays: company.paidLeaveDays,
    paidLeavePeriod: company.paidLeavePeriod,
    minWorkHours: company.minWorkHours,
  });

  const targets = new Set<string>(
    (company.members ?? []).map((member: any) => String(member))
  );
  targets.add(String(company.owner));

  if (hasPaidLeaveDays || hasPaidLeavePeriod) {
    const notifBody = `Paid leave policy updated: ${Math.floor(Number(company.paidLeaveDays ?? 0))} day(s) per ${String(company.paidLeavePeriod ?? "monthly")}`;

    void Notification.insertMany(
      Array.from(targets).map((targetUserId) => ({
        user: targetUserId,
        company: company._id,
        type: "system",
        title: "Paid Leave Policy Updated",
        body: notifBody,
      }))
    ).then(() => {
      Array.from(targets).forEach((target) => emitNotification(target));
    });
  }

  if (hasMinWorkHours) {
    const notifBody = `Minimum work hours policy updated: ${Math.floor(Number(company.minWorkHours ?? 0))} hrs / day`;

    void Notification.insertMany(
      Array.from(targets).map((targetUserId) => ({
        user: targetUserId,
        company: company._id,
        type: "system",
        title: "Work Hours Policy Updated",
        body: notifBody,
      }))
    ).then(() => {
      Array.from(targets).forEach((target) => emitNotification(target));
    });
  }

  return resp;
}

