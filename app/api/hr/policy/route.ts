import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";

const ALLOWED_NOTICE_PERIOD_DAYS = new Set([15, 30, 45, 60, 90]);

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const noticePeriodDays = Number((body as any).noticePeriodDays);
  if (!Number.isFinite(noticePeriodDays) || !ALLOWED_NOTICE_PERIOD_DAYS.has(noticePeriodDays)) {
    return jsonError("Invalid notice period.", 400);
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

  company.noticePeriodDays = noticePeriodDays;
  await company.save();

  return NextResponse.json({ ok: true, noticePeriodDays });
}

