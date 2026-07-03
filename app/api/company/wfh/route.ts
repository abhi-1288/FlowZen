import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

const formatDate = (date: Date) => date.toLocaleDateString("en-GB");

const buildWfhNotificationBody = (companyName: string, start: Date, end: Date, reason: string) => {
  const dateText = start.getTime() === end.getTime()
    ? formatDate(start)
    : `${formatDate(start)} to ${formatDate(end)}`;
  const reasonText = reason ? ` (${reason})` : "";
  return `${companyName} has a company-wide WFH day on ${dateText}${reasonText}`;
};

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found", 404);

  return NextResponse.json({
    wfhDays: company.wfhDays ?? 0,
    wfhPeriod: company.wfhPeriod ?? "monthly",
    wfhCheckInMode: company.wfhCheckInMode || "all-day",
    carryForwardWfhDays: company.carryForwardWfhDays ?? false,
    wfhDates: company.wfhDates || [],
    weekendDates: company.weekendDates || [],
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found", 404);

  if (String(company.owner) !== String(userId) && user.role !== "human-resource") {
    return jsonError("Only company owner or HR can manage WFH settings", 403);
  }

  const { wfhDays, wfhPeriod, mode, startDate, endDate, reason, carryForwardWfhDays } = await request.json();

  let quotaUpdated = false;

  if (wfhDays !== undefined) {
    const days = Number(wfhDays);
    if (Number.isNaN(days) || days < 0) {
      return jsonError("Invalid WFH days value", 400);
    }
    company.wfhDays = days;
    quotaUpdated = true;
  }

  if (wfhPeriod && ["monthly", "yearly"].includes(wfhPeriod)) {
    company.wfhPeriod = wfhPeriod;
    quotaUpdated = true;
  }

  if (typeof carryForwardWfhDays === "boolean") {
    company.carryForwardWfhDays = carryForwardWfhDays;
  }

  if (mode && ["all-day", "wfh-only"].includes(mode)) {
    company.wfhCheckInMode = mode;
  }

  if (quotaUpdated) {
    const populatedCompany = await Company.findById(user.company).select("name owner members");
    if (populatedCompany) {
      const targets = new Set<string>(
        (populatedCompany.members ?? []).map((member: any) => String(member))
      );
      if (populatedCompany.owner) targets.add(String(populatedCompany.owner));

      const body = `WFH policy updated: ${company.wfhDays} day(s) per ${company.wfhPeriod}`;

      await Notification.insertMany(
        Array.from(targets).map((targetUserId) => ({
          user: targetUserId,
          company: populatedCompany._id,
          type: "system",
          title: "WFH Policy Updated",
          body,
        }))
      );
      Array.from(targets).forEach((target) => emitNotification(target));
    }
  }

  if (startDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(start);
    const dates: { date: Date; reason: string }[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push({ date: new Date(current), reason: reason || "" });
      current.setDate(current.getDate() + 1);
    }
    company.wfhDates.push(...dates);

    // Notify all company members
    const populatedCompany = await Company.findById(user.company).select("name owner members");
    if (populatedCompany) {
      const targets = new Set<string>(
        (populatedCompany.members ?? []).map((member: any) => String(member))
      );
      if (populatedCompany.owner) targets.add(String(populatedCompany.owner));

      const body = buildWfhNotificationBody(
        String(populatedCompany.name),
        start,
        end,
        reason || ""
      );

      await Notification.insertMany(
        Array.from(targets).map((targetUserId) => ({
          user: targetUserId,
          company: populatedCompany._id,
          type: "system",
          title: "Company WFH announced",
          body,
        }))
      );
      Array.from(targets).forEach((target) => emitNotification(target));
    }
  }

  await company.save();

  return NextResponse.json({
    wfhDays: company.wfhDays,
    wfhPeriod: company.wfhPeriod,
    wfhCheckInMode: company.wfhCheckInMode,
    carryForwardWfhDays: company.carryForwardWfhDays ?? false,
    wfhDates: company.wfhDates || [],
    weekendDates: company.weekendDates || [],
  });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found", 404);

  if (String(company.owner) !== String(userId)) {
    return jsonError("Only company owner can delete WFH dates", 403);
  }

  const { date } = await request.json();
  if (!date) return jsonError("Date is required", 400);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  company.wfhDates = company.wfhDates.filter((d: any) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() !== targetDate.getTime();
  });

  await company.save();

  return NextResponse.json({ wfhDates: company.wfhDates || [] });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found", 404);

  if (String(company.owner) !== String(userId) && user.role !== "human-resource") {
    return jsonError("Only company owner or HR can manage WFH settings", 403);
  }

  const { mode } = await request.json();
  if (!mode || !["all-day", "wfh-only"].includes(mode)) {
    return jsonError("Invalid mode. Must be 'all-day' or 'wfh-only'", 400);
  }

  company.wfhCheckInMode = mode;
  await company.save();

  return NextResponse.json({ wfhCheckInMode: company.wfhCheckInMode });
}
