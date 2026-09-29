import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { Holiday } from "@/models/Holiday";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { effectiveRegionApproverClause, effectiveRegionLabelOf } from "@/lib/company-regions";

const formatHolidayDate = (date: Date) => date.toLocaleDateString("en-GB");
const buildHolidayNotificationBody = (companyName: string, title: string, start: Date, end: Date, duration: number) => {
  const dateText = duration === 1 ? formatHolidayDate(start) : `${formatHolidayDate(start)} to ${formatHolidayDate(end)}`;
  const dayText = `${duration} day${duration === 1 ? "" : "s"}`;
  return `${companyName} has holiday ${dayText} ${dateText} ${title}`;
};

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    await connectDb();
    const user = await User.findById(userId);
    if (!user) return jsonError("User not found.", 404);
    if (user.role !== "admin") return jsonError("Only admins can add holidays.", 403);

    const { title, description, startDate, endDate, region } = await req.json();
    if (!startDate || !endDate) return jsonError("Start date and end date are required.");

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return jsonError("Invalid date format.");
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0) return jsonError("Invalid date range.");
    if (diffDays > 365) return jsonError("Holiday range cannot exceed 365 days.");

    if (!user.company) return jsonError("Only company-associated admins can add holidays.", 400);

    // Regional admins create holidays for their own region; the company owner
    // may also create global holidays (region "") or any region's holidays.
    const company = (await Company.findById(user.company)
      .select("name owner addresses address members")
      .lean()) as {
      _id?: unknown;
      name?: string | null;
      owner?: unknown;
      addresses?: { label?: string | null }[] | null;
      address?: string | null;
      members?: unknown[] | null;
    } | null;
    const ownerId = company?.owner ?? null;
    const isOwner = ownerId != null && String(ownerId) === String(user._id);
    const adminRegion = effectiveRegionLabelOf(company, user);
    const requestedRegion = String(region ?? "").trim();
    let holidayRegion = adminRegion;
    if (isOwner && requestedRegion) {
      holidayRegion = requestedRegion;
    } else if (!isOwner && requestedRegion && requestedRegion !== adminRegion) {
      return jsonError(`You can only create holidays for your own region (${adminRegion}).`, 403);
    }

    const holiday = await Holiday.create({
      title: title || "Company Holiday",
      description: description || "",
      startDate: start,
      endDate: end,
      duration: diffDays,
      createdBy: userId,
      company: user.company,
      region: holidayRegion,
    });

    if (company) {
      // Global holidays notify everyone; regional holidays notify only that
      // region's members (plus the owner).
      const targets = new Set<string>();
      if (holidayRegion) {
        const regionClause = effectiveRegionApproverClause(company, holidayRegion);
        const regionMembers = regionClause
          ? await User.find({ company: user.company, companyStatus: "approved", ...regionClause }).select("_id")
          : [];
        regionMembers.forEach((m: any) => targets.add(String(m._id)));
      } else {
        (company.members ?? []).forEach((member: any) => targets.add(String(member)));
      }
      if (company.owner) targets.add(String(company.owner));

      const body = buildHolidayNotificationBody(
        String(company.name),
        String(holiday.title),
        start,
        end,
        diffDays
      );

      await Notification.insertMany(
        Array.from(targets).map((targetUserId) => ({
          user: targetUserId,
          company: company._id,
          type: "system",
          title: "Holiday announced",
          body,
        }))
      );
      Array.from(targets).forEach((target) => emitNotification(target));
    }

    return NextResponse.json({ holiday });
  } catch (err: any) {
    console.error("Holiday creation error:", err);
    return jsonError(err.message || "Failed to add holiday", 500);
  }
}


// Edit a holiday (admin only)
export async function PUT(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") return jsonError("Only admins can edit holidays.", 403);

    const { id, title, description, startDate, endDate } = await req.json();
    if (!id || !Types.ObjectId.isValid(id)) return jsonError("Invalid holiday ID.");
    const holiday = await Holiday.findById(id);
    if (!holiday) return jsonError("Holiday not found.", 404);

    // Regional admins can only edit holidays in their own region. The company
    // owner may edit global and any region's holidays.
    const company = (await Company.findById(user.company)
      .select("name owner addresses address")
      .lean()) as {
      _id?: unknown;
      name?: string | null;
      owner?: unknown;
      addresses?: { label?: string | null }[] | null;
      address?: string | null;
    } | null;
    const ownerId = company?.owner ?? null;
    const isOwner = ownerId != null && String(ownerId) === String(user._id);
    if (!isOwner) {
      const adminRegion = effectiveRegionLabelOf(company, user);
      const holidayRegion = String(holiday.region ?? "").trim();
      if (holidayRegion !== adminRegion) {
        return jsonError(`You can only edit holidays in your own region (${adminRegion}).`, 403);
      }
    }

    if (title !== undefined) holiday.title = title;
    if (description !== undefined) holiday.description = description;
    if (startDate !== undefined) holiday.startDate = new Date(startDate);
    if (endDate !== undefined) holiday.endDate = new Date(endDate);
    if (holiday.startDate && holiday.endDate) {
      const diffTime = holiday.endDate.getTime() - holiday.startDate.getTime();
      holiday.duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    await holiday.save();
    return NextResponse.json({ holiday });
  } catch (err: any) {
    console.error("Holiday update error:", err);
    return jsonError(err.message || "Failed to update holiday", 500);
  }
}

// Delete a holiday (admin only)
export async function DELETE(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") return jsonError("Only admins can delete holidays.", 403);

    const { id } = await req.json();
    if (!id || !Types.ObjectId.isValid(id)) return jsonError("Invalid holiday ID.");
    const holiday = await Holiday.findById(id);
    if (!holiday) return jsonError("Holiday not found.", 404);

    // Regional admins can only delete holidays in their own region. The company
    // owner may delete global and any region's holidays.
    const company = (await Company.findById(user.company)
      .select("name owner addresses address members")
      .lean()) as {
      _id?: unknown;
      name?: string | null;
      owner?: unknown;
      addresses?: { label?: string | null }[] | null;
      address?: string | null;
      members?: unknown[] | null;
    } | null;
    const ownerId = company?.owner ?? null;
    const isOwner = ownerId != null && String(ownerId) === String(user._id);
    if (!isOwner) {
      const adminRegion = effectiveRegionLabelOf(company, user);
      const holidayRegion = String(holiday.region ?? "").trim();
      if (holidayRegion !== adminRegion) {
        return jsonError(`You can only delete holidays in your own region (${adminRegion}).`, 403);
      }
    }

    await holiday.deleteOne();

    if (company) {
      const targets = new Set<string>(
        (company.members ?? []).map((member: any) => String(member))
      );
      if (company.owner) targets.add(String(company.owner));

      const body = buildHolidayNotificationBody(
        String(company.name),
        String(holiday.title),
        holiday.startDate,
        holiday.endDate,
        holiday.duration
      );

      await Notification.insertMany(
        Array.from(targets).map((targetUserId) => ({
          user: targetUserId,
          company: company._id,
          type: "system",
          title: "Holiday removed",
          body,
        }))
      );
      Array.from(targets).forEach((target) => emitNotification(target));
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Holiday delete error:", err);
    return jsonError(err.message || "Failed to delete holiday", 500);
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);

  const query: any = {};
  if (user.company) {
    query.company = user.company;
  } else {
    query.company = null;
  }

  // Everyone sees global holidays plus their own region's holidays. A user
  // with no stored regionLabel resolves to the main office.
  if (user.company) {
    const company = (await Company.findById(user.company)
      .select("addresses address")
      .lean()) as { addresses?: { label?: string | null }[] | null; address?: string | null } | null;
    const userRegion = effectiveRegionLabelOf(company, user);
    if (userRegion) {
      query.$or = [{ region: { $in: ["", null] } }, { region: userRegion }];
    }
  }

  const holidays = await Holiday.find(query).sort({ startDate: 1 });
  return NextResponse.json({ holidays });
}
