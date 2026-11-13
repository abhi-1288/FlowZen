import { NextResponse } from "next/server";
import { jsonError, requireUserId } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { effectiveRegionLabelOf } from "@/lib/company-regions";
import { recordAudit } from "@/lib/audit";
import { sendPolicyChangeEmail } from "@/lib/company-policy-email";
import {
  dateKey,
  isWeekendDate,
  normalizeDateOnly,
  type WeekendEntry,
  type WeekendExclusion,
} from "@/lib/weekends";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_LIMIT_DAYS = 60;

type CompanyWeekendDate = {
  date: Date;
  reason?: string;
  kind?: string;
  region?: string;
};

type CompanyWeekendExclusion = {
  date: Date;
  reason?: string;
  region?: string;
};

/** Expand an inclusive date range into local `YYYY-MM-DD` keys. */
function dateKeysBetween(
  startValue: unknown,
  endValue: unknown,
): { keys: string[]; start: Date; end: Date } | { error: string } {
  const start = normalizeDateOnly(String(startValue ?? ""));
  const end = normalizeDateOnly(
    String(endValue ?? "") || String(startValue ?? ""),
  );
  if (!start || !end) return { error: "Valid start and end dates are required." };
  if (start.getTime() > end.getTime())
    return { error: "The end date must be on or after the start date." };

  const dayCount = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (dayCount > RANGE_LIMIT_DAYS)
    return { error: `A weekend range cannot exceed ${RANGE_LIMIT_DAYS} days.` };

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return { keys, start, end };
}

function monthDateKeys(month: string, days: number[]): string[] | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;

  const allowedDays = new Set(days);
  const keys: string[] = [];
  const cursor = new Date(year, monthIndex, 1);
  while (cursor.getMonth() === monthIndex) {
    if (allowedDays.has(cursor.getDay())) keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

async function getManagerCompany(userId: string) {
  const user = await User.findById(userId).select(
    "name email company role regionLabel",
  );
  if (!user?.company) {
    return { error: jsonError("User not assigned to company", 400) };
  }

  const company = await Company.findById(user.company);
  if (!company) return { error: jsonError("Company not found", 404) };

  const isOwner = String(company.owner) === String(userId);
  const isHr = String(user.role) === "human-resource";
  const isAdmin = String(user.role) === "admin";
  if (!isOwner && !isHr && !isAdmin) {
    return {
      error: jsonError("Only company owner, HR, or admins can manage weekends", 403),
    };
  }

  return {
    company,
    user,
    isOwner,
    isHr,
    isAdmin,
    canPickRegion: isOwner || isHr,
    adminRegion: effectiveRegionLabelOf(company, user),
  };
}

/**
 * Resolve the region a new date belongs to. Owner and HR may write a global
 * entry (`region: ""`, which applies to every office) or target a region.
 * A regional admin is pinned to their own region.
 */
function resolveTargetRegion({
  requestedRegion,
  canPickRegion,
  adminRegion,
}: {
  requestedRegion: unknown;
  canPickRegion: boolean;
  adminRegion: string;
}): { region: string } | { error: string } {
  const requested = String(requestedRegion ?? "").trim();
  if (canPickRegion) return { region: requested };
  if (requested && requested !== adminRegion) {
    return {
      error: `You can only manage weekends for your own region (${adminRegion}).`,
    };
  }
  return { region: adminRegion };
}

function entryRegion(entry: { region?: string | null }): string {
  return String(entry?.region ?? "").trim();
}

/** Human-readable summary of a list of `YYYY-MM-DD` keys for notification email. */
function emailDateLabel(keys: string[]): string {
  if (!keys.length) return "";
  const format = (key: string) => {
    const date = normalizeDateOnly(key);
    return date
      ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : key;
  };
  if (keys.length === 1) return format(keys[0]);
  if (keys.length <= 5) return keys.map(format).join(", ");
  return `${format(keys[0])} to ${format(keys[keys.length - 1])} (${keys.length} days)`;
}

/** True when a date is already covered by an entry this write would duplicate. */
function alreadyCovered(
  entries: CompanyWeekendDate[],
  key: string,
  targetRegion: string,
): boolean {
  return entries.some((entry) => {
    if (dateKey(entry.date) !== key) return false;
    const region = entryRegion(entry);
    if (!targetRegion) return !region;
    return !region || region === targetRegion;
  });
}

/** Remove exclusions that would block a weekend being assigned. */
function clearBlockingExclusions(
  exclusions: CompanyWeekendExclusion[],
  key: string,
  targetRegion: string,
): CompanyWeekendExclusion[] {
  return exclusions.filter((entry) => {
    if (dateKey(entry.date) !== key) return true;
    const region = entryRegion(entry);
    if (!targetRegion) return false;
    return Boolean(region) && region !== targetRegion;
  });
}

function weekendPayload(company: any) {
  return {
    weekendDates: (company?.weekendDates ?? []) as CompanyWeekendDate[],
    weekendExclusions: (company?.weekendExclusions ?? []) as CompanyWeekendExclusion[],
  };
}

/** Everyone in the company hears about a new company-wide weekend range. */
async function notifyCompanyWeekend(
  companyId: unknown,
  companyName: string,
  start: Date,
  end: Date,
  reason: string,
  region: string,
  added: number,
) {
  if (added <= 0) return;

  const populatedCompany = await Company.findById(companyId).select(
    "members owner name",
  );
  if (!populatedCompany) return;

  const targets = new Set<string>(
    (populatedCompany.members ?? []).map((member: any) => String(member)),
  );
  if (populatedCompany.owner) targets.add(String(populatedCompany.owner));

  const format = (date: Date) => date.toLocaleDateString("en-GB");
  const dateText =
    format(start) === format(end)
      ? format(start)
      : `${format(start)} to ${format(end)}`;
  const reasonText = reason ? ` (${reason})` : "";
  const regionText = region ? ` for ${region}` : " for all offices";
  const body = `${companyName} has declared a holiday weekend on ${dateText}${regionText}${reasonText}.`;

  await Notification.insertMany(
    Array.from(targets).map((targetUserId) => ({
      user: targetUserId,
      company: populatedCompany._id,
      type: "system",
      title: "Holiday weekend assigned",
      body,
    })),
  );
  Array.from(targets).forEach((target) => emitNotification(target));
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select("company regionLabel");
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company).select(
    "weekendDates weekendExclusions addresses address",
  );
  if (!company) return jsonError("Company not found", 404);

  const userRegion = effectiveRegionLabelOf(company, user);
  const inRegion = (entry: any) => {
    const region = entryRegion(entry);
    return !region || !userRegion || region === userRegion;
  };

  return NextResponse.json({
    weekendDates: ((company as any).weekendDates ?? []).filter(inRegion),
    weekendExclusions: ((company as any).weekendExclusions ?? []).filter(inRegion),
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const manager = await getManagerCompany(userId);
  if ("error" in manager) return manager.error;
  const { company, user, canPickRegion, adminRegion } = manager;

  const body = await request.json().catch(() => ({}));
  const target = resolveTargetRegion({
    requestedRegion: body.region,
    canPickRegion,
    adminRegion,
  });
  if ("error" in target) return jsonError(target.error, 403);
  const targetRegion = target.region;

  const entries: CompanyWeekendDate[] = ((company as any).weekendDates ?? []).map(
    (entry: any) => (entry?.toObject ? entry.toObject() : { ...entry }),
  );
  let exclusions: CompanyWeekendExclusion[] = ((company as any).weekendExclusions ?? []).map(
    (entry: any) => (entry?.toObject ? entry.toObject() : { ...entry }),
  );

  let keys: string[] = [];
  let reason = "";
  let kind: "manual" | "holiday" = "manual";
  let holidayRange: { start: Date; end: Date } | null = null;
  let bulkMonth: { month: string; days: number[] } | null = null;
  let auditLabel = "Weekend date added";

  if (body.startDate || body.date) {
    // Range mode — also covers the single-date `date` payload the modal sends.
    const isRange = Boolean(body.startDate);
    const parsed = dateKeysBetween(
      body.startDate ?? body.date,
      body.endDate ?? body.startDate ?? body.date,
    );
    if ("error" in parsed) return jsonError(parsed.error);

    keys = parsed.keys;
    reason = String(body.reason ?? "").trim();
    kind = isRange || body.kind === "holiday" ? "holiday" : "manual";
    auditLabel = isRange ? "Holiday weekend assigned" : "Weekend date added";
    if (isRange) holidayRange = { start: parsed.start, end: parsed.end };
  } else {
    // Bulk mode — assign every Saturday/Sunday in a month.
    const month = String(body.month ?? "");
    const days = Array.isArray(body.days)
      ? body.days.map(Number).filter((day: number) => day === 0 || day === 6)
      : [];
    if (!days.length) return jsonError("Select Saturday, Sunday, or both.");

    const monthKeys = monthDateKeys(month, days);
    if (!monthKeys) return jsonError("Valid month is required.");

    keys = monthKeys;
    reason = String(body.reason ?? "").trim() || "Manual weekend";
    kind = "manual";
    auditLabel = "Weekend dates assigned";
    bulkMonth = { month, days };
  }

  const additions = keys.filter(
    (key) => !alreadyCovered(entries, key, targetRegion),
  );
  for (const key of additions) {
    const date = normalizeDateOnly(key);
    if (!date) continue;
    entries.push({ date, reason, kind, region: targetRegion });
    exclusions = clearBlockingExclusions(exclusions, key, targetRegion);
  }

  (company as any).weekendDates = entries;
  (company as any).weekendExclusions = exclusions;
  await company.save();

  await recordAudit({
    action: "company.settings.change",
    actionLabel: auditLabel,
    company: company._id,
    actor: { id: user._id, name: user.name, role: user.role },
    to: {
      dates: keys,
      added: additions.length,
      reason,
      kind,
      region: targetRegion,
    },
    result: "success",
    request,
  });

  if (holidayRange && additions.length > 0) {
    await notifyCompanyWeekend(
      company._id,
      String(company.name ?? "Company"),
      holidayRange.start,
      holidayRange.end,
      reason,
      targetRegion,
      additions.length,
    );
  } else if (bulkMonth && additions.length > 0) {
    const populatedCompany = await Company.findById(company._id).select(
      "members owner name",
    );
    if (populatedCompany) {
      const targets = new Set<string>(
        (populatedCompany.members ?? []).map((member: any) => String(member)),
      );
      if (populatedCompany.owner) targets.add(String(populatedCompany.owner));

      const monthName = new Date(`${bulkMonth.month}-01`).toLocaleString("en-US", {
        month: "long",
      });
      const hasSat = bulkMonth.days.includes(6);
      const hasSun = bulkMonth.days.includes(0);
      const dayNames =
        hasSat && hasSun
          ? "every saturday and sunday"
          : hasSat
            ? "every saturday"
            : "every sunday";
      const body = `${populatedCompany.name} has decided to give a weekend on ${dayNames} of ${monthName}. thanks`;

      await Notification.insertMany(
        Array.from(targets).map((targetUserId) => ({
          user: targetUserId,
          company: populatedCompany._id,
          type: "system",
          title: "Weekends Assigned",
          body,
        })),
      );
      Array.from(targets).forEach((target) => emitNotification(target));
    }
  }

  if (additions.length > 0) {
    const isHoliday = kind === "holiday";
    const title = holidayRange
      ? "Holiday weekend assigned"
      : bulkMonth
        ? "Company weekends assigned"
        : "Weekend day assigned";

    void sendPolicyChangeEmail({
      company,
      actor: user,
      kind: "weekend",
      region: targetRegion,
      title,
      summary: isHoliday
        ? `${String(company.name ?? "The company")} has declared a holiday weekend.`
        : `${String(company.name ?? "The company")} has declared a company weekend.`,
      details: [
        { label: "Dates", value: emailDateLabel(additions) },
        { label: "Type", value: isHoliday ? "Holiday weekend" : "Weekend" },
        { label: "Applies to", value: targetRegion || "All offices" },
      ],
      reason: holidayRange ? reason : "",
    });
  }

  return NextResponse.json(weekendPayload(company));
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const manager = await getManagerCompany(userId);
  if ("error" in manager) return manager.error;
  const { company, user, canPickRegion, adminRegion } = manager;

  const body = await request.json().catch(() => ({}));
  const targetDate = normalizeDateOnly(String(body.date ?? body.startDate ?? ""));
  if (!targetDate) return jsonError("Date is required.");
  const key = dateKey(targetDate);

  const target = resolveTargetRegion({
    requestedRegion: body.region,
    canPickRegion,
    adminRegion,
  });
  if ("error" in target) return jsonError(target.error, 403);
  const targetRegion = target.region;

  const entries: CompanyWeekendDate[] = ((company as any).weekendDates ?? []).map(
    (entry: any) => (entry?.toObject ? entry.toObject() : { ...entry }),
  );
  let exclusions: CompanyWeekendExclusion[] = ((company as any).weekendExclusions ?? []).map(
    (entry: any) => (entry?.toObject ? entry.toObject() : { ...entry }),
  );

  const nextEntries = entries.filter((entry) => {
    if (dateKey(entry.date) !== key) return true;
    // The owner and HR manage the company-wide list; a regional admin may not
    // remove another region's entry or a global entry.
    if (canPickRegion) return false;
    const region = entryRegion(entry);
    return region !== adminRegion;
  });
  const removedEntry = nextEntries.length !== entries.length;
  const exclusionsBefore = exclusions.length;

  // Removing a weekend has to make the day a working day, otherwise the default
  // Sunday rule would silently restore it. Only record an exclusion when the
  // day would still resolve to a weekend for this manager's scope.
  const stillWeekend = isWeekendDate(key, {
    weekendEntries: nextEntries as WeekendEntry[],
    weekendExclusions: exclusions as WeekendExclusion[],
    region: canPickRegion ? "" : adminRegion,
  });

  if (stillWeekend) {
    const exclusionRegion = canPickRegion ? "" : adminRegion;
    const alreadyExcluded = exclusions.some(
      (entry) =>
        dateKey(entry.date) === key &&
        (entryRegion(entry) === exclusionRegion ||
          (!canPickRegion && !entryRegion(entry))),
    );
    if (!alreadyExcluded) {
      exclusions.push({
        date: targetDate,
        reason: String(body.reason ?? "").trim() || "Weekend removed",
        region: exclusionRegion,
      });
    }
  }

  (company as any).weekendDates = nextEntries;
  (company as any).weekendExclusions = exclusions;
  await company.save();

  await recordAudit({
    action: "company.settings.change",
    actionLabel: "Weekend date removed",
    company: company._id,
    actor: { id: user._id, name: user.name, role: user.role },
    to: { date: key, region: canPickRegion ? "" : adminRegion },
    result: "success",
    request,
  });

  if (removedEntry || exclusions.length !== exclusionsBefore) {
    void sendPolicyChangeEmail({
      company,
      actor: user,
      kind: "weekend",
      region: targetRegion,
      title: "Weekend day removed",
      summary: `${emailDateLabel([key])} is now a working day at ${String(company.name ?? "the company")}.`,
      details: [
        { label: "Date", value: emailDateLabel([key]) },
        { label: "Applies to", value: targetRegion || "All offices" },
      ],
      reason: String(body.reason ?? "").trim(),
    });
  }

  return NextResponse.json(weekendPayload(company));
}
