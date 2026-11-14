import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { AttendanceDeleteRequest } from "@/models/AttendanceDeleteRequest";
import { Attendance } from "@/models/Attendance";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import {
  effectiveRegionLabelOf,
  isUserInEffectiveRegion,
  isUserInRegion,
  regionApproverClause,
  regionEntryForMember,
} from "@/lib/company-regions";
import { recordAudit } from "@/lib/audit";

function serialize(row: any) {
  const slot = (value: any) =>
    value && {
      approver: value.approver && {
        id: String(value.approver._id ?? value.approver),
        name: value.approver.name,
        role: value.approver.role,
      },
      status: value.status,
      reason: value.reason ?? "",
    };
  return {
    id: String(row._id),
    member: row.member && typeof row.member === "object"
      ? { id: String(row.member._id ?? row.member), name: row.member.name, role: row.member.role }
      : { id: String(row.member ?? ""), name: "", role: "" },
    requester: row.requester && typeof row.requester === "object"
      ? { id: String(row.requester._id ?? row.requester), name: row.requester.name, role: row.requester.role }
      : null,
    date: row.date,
    region: row.region,
    reason: row.reason,
    status: row.status,
    teamOwnerRequired: row.teamOwnerRequired === true,
    financeApproval: slot(row.financeApproval),
    teamOwnerApproval: slot(row.teamOwnerApproval),
    adminApproval: slot(row.adminApproval),
    createdAt: row.createdAt,
  };
}

function dayLabel(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "the selected day" : date.toISOString().slice(0, 10);
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor: any = await User.findById(userId).select("company role regionLabel name");
  if (!actor?.company) return jsonError("You must belong to an approved company.", 403);
  const role = String(actor.role ?? "");

  // Everyone can read the requests they raised (members track their own
  // removal requests here); the `requests` inbox is role-specific.
  const own = await AttendanceDeleteRequest.find({ company: actor.company, requester: userId })
    .populate("member", "name role")
    .populate("financeApproval.approver", "name role")
    .populate("teamOwnerApproval.approver", "name role")
    .populate("adminApproval.approver", "name role")
    .sort({ createdAt: -1 })
    .limit(50);

  if (!["finance", "admin", "project-manager"].includes(role)) {
    return NextResponse.json({ requests: [], own: own.map(serialize) });
  }

  const company: any = await Company.findById(actor.company).select("addresses address").lean();
  if (!company) return jsonError("Company not found.", 404);
  const pending = await AttendanceDeleteRequest.find({ company: actor.company, status: "pending" })
    .populate("member", "name role regionLabel")
    .populate("requester", "name role")
    .sort({ createdAt: -1 })
    .limit(50);

  // Finance is the first gate: they see the requests waiting on their review,
  // scoped to their own region (or an explicitly assigned slot).
  if (role === "finance") {
    const inbox = pending.filter((row: any) => {
      if (row.financeApproval?.status !== "pending") return false;
      return (
        String(row.financeApproval?.approver ?? "") === userId ||
        isUserInEffectiveRegion(company, row.region, actor)
      );
    });
    return NextResponse.json({ requests: inbox.map(serialize), own: own.map(serialize) });
  }

  if (role === "project-manager") {
    // The team-owner slot belongs to whoever currently manages a team
    // containing the member, not just whoever was assigned at creation.
    const managedTeams = await Team.find({ company: actor.company, manager: userId }).select("employees").lean();
    const managedMemberIds = new Set(
      managedTeams.flatMap((team: any) => ((team.employees ?? []) as any[]).map(String)),
    );
    const inbox = pending.filter(
      (row: any) =>
        row.financeApproval?.status === "approved" &&
        (String(row.teamOwnerApproval?.approver ?? "") === userId ||
          (row.teamOwnerRequired &&
            row.teamOwnerApproval?.status === "pending" &&
            managedMemberIds.has(String(row.member?._id ?? row.member)))),
    );
    return NextResponse.json({ requests: inbox.map(serialize), own: own.map(serialize) });
  }

  // Admins only act inside the member's region — and only after Finance has
  // reviewed the request. A region-less request is company-wide.
  const inbox = pending.filter((row: any) => {
    if (row.financeApproval?.status !== "approved") return false;
    if (String(row.adminApproval?.approver ?? "") === userId) return true;
    if (row.adminApproval?.status !== "pending") return false;
    const region = String(row.region ?? "").trim();
    if (!region) return true;
    return isUserInRegion(company, region, { _id: userId, regionLabel: actor.regionLabel });
  });
  return NextResponse.json({ requests: inbox.map(serialize), own: own.map(serialize) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const body = await request.json().catch(() => ({}));

  const actor: any = await User.findById(userId).select("company role name regionLabel");
  if (!actor?.company) return jsonError("You must belong to a company to request this.", 403);
  const raisedByFinance = actor.role === "finance";

  const attendanceId = String((body as any).attendanceId ?? "");
  const reason = String((body as any).reason ?? "").trim().slice(0, 500);
  if (!attendanceId || !reason) {
    return jsonError("Select an attendance record and describe why it should be removed.", 400);
  }

  const company: any = await Company.findById(actor.company).select("name addresses address").lean();
  if (!company) return jsonError("Company not found.", 404);

  const attendance: any = await Attendance.findOne({ _id: attendanceId }).populate(
    "user",
    "name role regionLabel company companyStatus",
  );
  if (!attendance) return jsonError("Attendance record not found.", 404);
  const member: any = attendance.user;
  if (!member || String(member.company ?? "") !== String(actor.company)) {
    return jsonError("That attendance record is not in your company.", 403);
  }
  // Members raise requests for their own records only; Finance may raise for
  // anyone it can act on.
  if (!raisedByFinance && String(member._id) !== userId) {
    return jsonError("You can only request removal of your own attendance records.", 403);
  }

  const duplicate = await AttendanceDeleteRequest.findOne({
    company: actor.company,
    attendance: attendance._id,
    status: "pending",
  }).populate("member", "name role");
  if (duplicate) {
    return NextResponse.json({ request: serialize(duplicate), alreadyPending: true });
  }

  const memberRegion = effectiveRegionLabelOf(company, member);

  // Finance gate: the request lands with the Finance user of the member's
  // region first; only after they clear it do the team owner and admin weigh
  // in. When Finance raises the request itself, the gate is already cleared.
  const financeClause = regionApproverClause(company, memberRegion);
  const regionFinance = await User.find({
    company: actor.company,
    role: "finance",
    companyStatus: "approved",
    ...(financeClause ?? {}),
  })
    .select("_id")
    .lean();
  let financeIds = regionFinance
    .map((row: any) => String(row._id))
    .filter((id) => id !== userId);
  if (!financeIds.length) {
    // No Finance user covers the member's region (or they are the requester):
    // fall back to any company Finance rather than leaving the flow stuck.
    const anyFinance = await User.find({
      company: actor.company,
      role: "finance",
      companyStatus: "approved",
    })
      .select("_id")
      .lean();
    financeIds = anyFinance.map((row: any) => String(row._id)).filter((id) => id !== userId);
  }
  if (!raisedByFinance && !financeIds.length) {
    return jsonError("No Finance user is available to review this request.", 400);
  }
  const financeId = financeIds[0] ?? "";

  // Two-person rule after Finance: the member's team owner (when they are in a
  // team) plus an admin of the member's region. The requester can never fill
  // either slot, so an approver who *is* the requester blocks the request here.
  const team: any = await Team.findOne({ company: actor.company, employees: member._id })
    .select("manager")
    .lean();
  let teamOwner: any = null;
  if (team?.manager) {
    teamOwner = await User.findOne({
      _id: team.manager,
      company: actor.company,
      companyStatus: "approved",
    })
      .select("_id name role")
      .lean();
    if (!teamOwner) return jsonError("The member's team owner is not available to approve.", 400);
    if (String(teamOwner._id) === userId) {
      return jsonError("You manage this member's team, so you cannot request this removal yourself.", 400);
    }
  }

  const entry: any = regionEntryForMember(company, member);
  const headId = entry?.adminHead ? String(entry.adminHead) : "";
  const clause = regionApproverClause(company, memberRegion);
  const adminQuery: Record<string, unknown> = {
    company: actor.company,
    role: "admin",
    companyStatus: "approved",
    ...(clause ?? {}),
  };
  const admins = await User.find(adminQuery).select("_id").lean();
  let adminIds = admins.map((row: any) => String(row._id)).filter((id) => id !== userId);
  if (headId) {
    // The region's admin head is the preferred approver when available.
    adminIds = adminIds.sort((a, b) => (a === headId ? -1 : b === headId ? 1 : 0));
  }
  if (!adminIds.length) {
    return jsonError("No other admin is available to approve this removal.", 400);
  }
  const adminId = adminIds[0];

  const row: any = await AttendanceDeleteRequest.create({
    company: actor.company,
    requester: userId,
    member: member._id,
    attendance: attendance._id,
    date: attendance.date,
    region: memberRegion,
    reason,
    teamOwnerRequired: Boolean(teamOwner),
    financeApproval: raisedByFinance
      ? { approver: userId, status: "approved", decidedAt: new Date(), reason: "Raised by Finance" }
      : { approver: financeId, status: "pending" },
    teamOwnerApproval: teamOwner ? { approver: teamOwner._id, status: "pending" } : undefined,
    adminApproval: { approver: adminId, status: "pending" },
  });

  // Sequence: a member-raised request goes to Finance first; a Finance-raised
  // one starts straight at the team owner and admin.
  const targets = raisedByFinance
    ? Array.from(new Set([teamOwner ? String(teamOwner._id) : "", adminId].filter(Boolean)))
    : Array.from(new Set([financeId].filter(Boolean)));
  if (targets.length) {
    await Notification.insertMany(
      targets.map((targetUserId) => ({
        user: targetUserId,
        company: actor.company,
        type: "approval",
        title: "Attendance removal approval requested",
        message: raisedByFinance
          ? `${actor.name} requested removal of ${member.name}'s attendance record for ${dayLabel(attendance.date)}.`
          : `${member.name} asked to remove their ${dayLabel(attendance.date)} attendance record; Finance review is needed.`,
        link: "/profile/attendance",
      })),
    );
    targets.forEach((targetUserId) => emitNotification(targetUserId));
  }
  await recordAudit({
    action: "attendance.removal.requested",
    actionLabel: "Attendance record removal requested",
    company: actor.company,
    actor: userId,
    entityType: "AttendanceDeleteRequest",
    entityId: String(row._id),
    metadata: {
      member: String(member._id),
      date: dayLabel(attendance.date),
      region: memberRegion,
      reason,
      raisedByFinance,
    },
  });

  await row.populate([
    { path: "member", select: "name role" },
    { path: "financeApproval.approver", select: "name role" },
    { path: "teamOwnerApproval.approver", select: "name role" },
    { path: "adminApproval.approver", select: "name role" },
  ]);
  return NextResponse.json({ request: serialize(row) }, { status: 201 });
}
