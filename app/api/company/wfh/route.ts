import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { effectiveRegionLabelOf } from "@/lib/company-regions";
import { recordAudit } from "@/lib/audit";
import { sendPolicyChangeEmail } from "@/lib/company-policy-email";

const formatDate = (date: Date) => date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

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

  // Dates are global ("" / unset) or regional. Everyone sees global dates
  // plus their own region's dates.
  const userRegion = effectiveRegionLabelOf(company, user);
  const inRegion = (d: any) => {
    const r = String(d?.region ?? "").trim();
    return !r || !userRegion || r === userRegion;
  };

  return NextResponse.json({
    wfhDays: company.wfhDays ?? 0,
    wfhPeriod: company.wfhPeriod ?? "monthly",
    wfhCheckInMode: company.wfhCheckInMode || "all-day",
    carryForwardWfhDays: company.carryForwardWfhDays ?? false,
    wfhDates: (company.wfhDates || []).filter(inRegion),
    weekendDates: (company.weekendDates || []).filter(inRegion),
    weekendExclusions: ((company as any).weekendExclusions || []).filter(inRegion),
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

  const isOwner = String(company.owner) === String(userId);
  const isHr = user.role === "human-resource";
  const isAdmin = user.role === "admin";
  if (!isOwner && !isHr && !isAdmin) {
    return jsonError("Only company owner, HR, or admins can manage WFH settings", 403);
  }

  const { wfhDays, wfhPeriod, mode, startDate, endDate, reason, carryForwardWfhDays, region } = await request.json();

  // Regional admins may only add dates for their own region. The owner and HR
  // may add global dates (region "") or any region's dates.
  const adminRegion = effectiveRegionLabelOf(company, user);
  const requestedRegion = String(region ?? "").trim();
  let dateRegion = adminRegion;
  if (isOwner || isHr) {
    dateRegion = requestedRegion || "";
  } else if (requestedRegion && requestedRegion !== adminRegion) {
    return jsonError(`You can only add WFH dates for your own region (${adminRegion}).`, 403);
  }

  let quotaUpdated = false;
  let modeUpdated = false;
  let datesAdded = 0;
  let addedRange: { start: Date; end: Date } | null = null;

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
    if (company.wfhCheckInMode !== mode) modeUpdated = true;
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
    const dates: { date: Date; reason: string; region: string }[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push({ date: new Date(current), reason: reason || "", region: dateRegion });
      current.setDate(current.getDate() + 1);
    }
    company.wfhDates.push(...dates);
    datesAdded = dates.length;
    addedRange = { start, end };

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

  await recordAudit({
    action: "company.settings.change",
    actionLabel: "WFH policy updated",
    company: company._id,
    actor: { id: user._id, name: user.name, role: user.role },
    to: {
      wfhDays: company.wfhDays,
      wfhPeriod: company.wfhPeriod,
      wfhCheckInMode: company.wfhCheckInMode,
      carryForwardWfhDays: company.carryForwardWfhDays ?? false,
      datesAdded,
      region: dateRegion,
    },
    result: "success",
    request,
  });

  const policyChanged = quotaUpdated || modeUpdated;
  if (policyChanged || datesAdded > 0) {
    const details: { label: string; value: string }[] = [];
    if (quotaUpdated) {
      details.push({
        label: "WFH quota",
        value: `${company.wfhDays} day(s) per ${company.wfhPeriod}`,
      });
    }
    if (modeUpdated) {
      details.push({
        label: "Check-in mode",
        value: company.wfhCheckInMode === "wfh-only" ? "WFH only — office check-in disabled" : "All day",
      });
    }
    if (datesAdded > 0 && addedRange) {
      const dateText =
        formatDate(addedRange.start) === formatDate(addedRange.end)
          ? formatDate(addedRange.start)
          : `${formatDate(addedRange.start)} to ${formatDate(addedRange.end)}`;
      details.push({ label: "WFH dates", value: `${dateText} (${datesAdded} day${datesAdded === 1 ? "" : "s"})` });
      details.push({ label: "Applies to", value: dateRegion || "All offices" });
    }

    void sendPolicyChangeEmail({
      company,
      actor: user,
      kind: "wfh",
      // Quota/check-in-mode changes are company-wide; only date-only changes
      // are scoped to the region the dates were added for.
      region: policyChanged ? "" : dateRegion,
      title: policyChanged ? "WFH policy updated" : "Company-wide WFH announced",
      summary: policyChanged
        ? `${String(company.name ?? "The company")} has updated its WFH policy.`
        : `${String(company.name ?? "The company")} has announced company-wide WFH.`,
      details,
      reason: details.length > 0 && addedRange ? reason || "" : "",
    });
  }

  return NextResponse.json({
    wfhDays: company.wfhDays,
    wfhPeriod: company.wfhPeriod,
    wfhCheckInMode: company.wfhCheckInMode,
    carryForwardWfhDays: company.carryForwardWfhDays ?? false,
    wfhDates: company.wfhDates || [],
    weekendDates: company.weekendDates || [],
    weekendExclusions: (company as any).weekendExclusions || [],
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

  const isOwner = String(company.owner) === String(userId);
  const isHr = user.role === "human-resource";
  const isAdmin = user.role === "admin";
  if (!isOwner && !isHr && !isAdmin) {
    return jsonError("Only company owner, HR, or admins can delete WFH dates", 403);
  }

  const { date } = await request.json();
  if (!date) return jsonError("Date is required", 400);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // A regional admin may only delete dates for their own region; the owner and
  // HR may delete any. Entries for other regions are left untouched.
  const adminRegion = effectiveRegionLabelOf(company, user);
  const datesBefore = company.wfhDates.length;
  company.wfhDates = company.wfhDates.filter((d: any) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    if (dDate.getTime() !== targetDate.getTime()) return true;
    if (isOwner || isHr) return false;
    return String(d?.region ?? "").trim() !== adminRegion;
  });

  await company.save();

  await recordAudit({
    action: "company.settings.change",
    actionLabel: "WFH date removed",
    company: company._id,
    actor: { id: user._id, name: user.name, role: user.role },
    to: { date: targetDate.toISOString(), region: adminRegion },
    result: "success",
    request,
  });

  if (company.wfhDates.length !== datesBefore) {
    void sendPolicyChangeEmail({
      company,
      actor: user,
      kind: "wfh",
      region: adminRegion,
      title: "Company WFH day removed",
      summary: `The company-wide WFH on ${formatDate(targetDate)} has been removed.`,
      details: [
        { label: "Date", value: formatDate(targetDate) },
        { label: "Applies to", value: adminRegion || "All offices" },
      ],
    });
  }

  return NextResponse.json({
    wfhDates: company.wfhDates || [],
    weekendDates: company.weekendDates || [],
    weekendExclusions: (company as any).weekendExclusions || [],
  });
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

  const previousMode = company.wfhCheckInMode;
  company.wfhCheckInMode = mode;
  await company.save();

  await recordAudit({
    action: "company.settings.change",
    actionLabel: "WFH check-in mode updated",
    company: company._id,
    actor: { id: user._id, name: user.name, role: user.role },
    from: { wfhCheckInMode: previousMode },
    to: { wfhCheckInMode: mode },
    result: "success",
    request,
  });

  if (previousMode !== mode) {
    void sendPolicyChangeEmail({
      company,
      actor: user,
      kind: "wfh",
      region: "",
      title: "WFH check-in policy updated",
      summary: `${String(company.name ?? "The company")} has changed how WFH days are tracked.`,
      details: [
        { label: "Previous mode", value: previousMode === "wfh-only" ? "WFH only" : "All day" },
        { label: "New mode", value: mode === "wfh-only" ? "WFH only — office check-in disabled" : "All day" },
        { label: "Applies to", value: "All offices" },
      ],
    });
  }

  return NextResponse.json({ wfhCheckInMode: company.wfhCheckInMode });
}
