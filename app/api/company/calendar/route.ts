import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Holiday } from "@/models/Holiday";
import { LeaveRequest } from "@/models/LeaveRequest";
import { WfhRequest } from "@/models/WfhRequest";
import { Meeting } from "@/models/Meeting";
import { effectiveRegionLabelOf } from "@/lib/company-regions";
import { eventsForMonth } from "@/lib/company-calendar";
import {
  weekendEntryForDate,
  weekendKeysForMonth,
  weekendLabel,
  type WeekendEntry,
  type WeekendExclusion,
} from "@/lib/weekends";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select("company companyStatus regionLabel");
  if (!actor || !actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11)
    return jsonError("Valid year and month are required.", 400);

  const company = await Company.findById(actor.company)
      .select("name addresses address weekendDates weekendExclusions wfhDates")
      .lean();
    if (!company) return jsonError("Company not found.", 404);

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [members, holidays, leaves, wfhs, meetings, salaryCycle] = await Promise.all([
    User.find({ company: actor.company, companyStatus: "approved" })
      .select("name dob regionLabel companyJoined employmentEndDate membershipHistory createdAt")
      .lean(),
    Holiday.find({ company: actor.company, startDate: { $lte: monthEnd }, endDate: { $gte: monthStart } })
      .select("title startDate endDate region")
      .lean(),
    LeaveRequest.find({
      requester: userId,
      status: { $in: ["approved", "hr-approved", "manager-approved"] },
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    })
      .select("requester startDate endDate reason")
      .lean(),
    WfhRequest.find({
      requester: userId,
      status: "approved",
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    })
      .select("requester startDate endDate reason")
      .lean(),
    Meeting.find({ company: actor.company, date: { $gte: monthStart, $lte: monthEnd }, status: { $ne: "cancelled" } })
      .select("title date creator")
      .populate("creator", "name")
      .lean(),
    Promise.resolve(null),
  ]);

  const memberInputs = (members as any[]).map((m) => ({
    id: String(m._id),
    name: String(m.name ?? ""),
    region: effectiveRegionLabelOf(company as any, m),
    dob: m.dob ?? null,
    companyJoined: m.companyJoined ?? null,
    employmentEndDate: m.employmentEndDate ?? null,
    createdAt: m.createdAt ?? null,
    membershipHistory: m.membershipHistory ?? [],
  }));

  // Resolve every weekend day for the viewer's region: default Sundays, any
  // assigned company weekends, and explicitly removed (working) Sundays.
  const viewerRegion = effectiveRegionLabelOf(company as any, actor as any);
  const weekendContext = {
    weekendEntries: ((company as any).weekendDates ?? []) as WeekendEntry[],
    weekendExclusions: ((company as any).weekendExclusions ?? []) as WeekendExclusion[],
    region: viewerRegion,
  };
  const weekendEvents = Array.from(weekendKeysForMonth(weekendContext, year, month)).map((key) => {
    const entry = weekendEntryForDate(key, weekendContext);
    return {
      date: key,
      reason: weekendLabel(entry),
      kind: entry?.kind ?? null,
      region: viewerRegion,
    };
  });

  // Company-wide WFH dates are already in company.wfhDates; include as wfhs with requester null? They appear as WFH for everyone.
  const companyWfh = ((company as any).wfhDates ?? []).map((w: any) => ({
    requester: null,
    startDate: w.date,
    endDate: w.date,
    reason: w.reason ? String(w.reason) : "Company WFH",
  }));

  const events = eventsForMonth({
    members: memberInputs,
    holidays: (holidays as any[]).map((h) => ({
      title: h.title,
      startDate: h.startDate,
      endDate: h.endDate,
      region: h.region,
    })),
    weekends: weekendEvents,
    weekendExclusions: ((company as any).weekendExclusions ?? []).map((e: any) => ({ date: e.date, region: e.region })),
    leaves: (leaves as any[]).map((l) => ({
      requester: String(l.requester),
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
    })),
    wfhs: [...(wfhs as any[]).map((w) => ({
      requester: String(w.requester),
      startDate: w.startDate,
      endDate: w.endDate,
      reason: w.reason,
    })), ...companyWfh],
    meetings: (meetings as any[]).map((m) => ({
      title: m.title,
      date: m.date,
      creator: m.creator ? { name: m.creator.name } : null,
    })),
    payrollDay: 29,
    year,
    monthIndex: month,
  });

  return NextResponse.json({ events });
}
