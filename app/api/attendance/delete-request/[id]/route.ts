import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { AttendanceDeleteRequest } from "@/models/AttendanceDeleteRequest";
import { Attendance } from "@/models/Attendance";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Notification } from "@/models/Notification";
import { isUserInEffectiveRegion } from "@/lib/company-regions";
import { recordAudit } from "@/lib/audit";
import { emitNotification } from "@/lib/realtime";

function dayLabel(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "the selected day" : date.toISOString().slice(0, 10);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String((body as any).action ?? "");
  if (!["approve", "reject"].includes(action)) return jsonError("Invalid decision.", 400);
  const reason = String((body as any).reason ?? "").trim().slice(0, 500);
  if (action === "reject" && !reason) return jsonError("A rejection reason is required.", 400);

  const actor: any = await User.findById(userId).select("company role regionLabel name");
  if (!actor?.company) return jsonError("You must belong to an approved company.", 403);
  const row: any = await AttendanceDeleteRequest.findOne({
    _id: id,
    company: actor.company,
    status: "pending",
  }).populate("member", "name regionLabel company");
  if (!row) return jsonError("Removal request not found or already decided.", 404);
  if (String(row.requester ?? "") === userId) {
    return jsonError("You cannot decide your own removal request.", 403);
  }
  const member: any = row.member;
  if (!member) return jsonError("The member on this request is no longer available.", 400);

  const company: any = await Company.findById(actor.company).select("addresses address").lean();
  if (!company) return jsonError("Company not found.", 404);

  // Decide which slot the actor fills. The sequence is: Finance first (scoped
  // to the member's region), then the member's team owner, then the admin of
  // the member's region. The team-owner slot belongs to whoever *currently*
  // manages a team containing the member (teams change; the creation-time
  // assignment is only a default).
  const assignedFinance = String(row.financeApproval?.approver ?? "");
  const assignedTeamOwner = String(row.teamOwnerApproval?.approver ?? "");
  const managesMemberTeam = Boolean(
    await Team.exists({ company: actor.company, manager: userId, employees: member._id }),
  );
  const financeAllowed =
    actor.role === "finance" &&
    (assignedFinance === userId || isUserInEffectiveRegion(company, row.region, actor));
  const adminAllowed =
    actor.role === "admin" &&
    (String(row.adminApproval?.approver ?? "") === userId ||
      isUserInEffectiveRegion(company, row.region, actor));

  let slot: "financeApproval" | "teamOwnerApproval" | "adminApproval" | null = null;
  if (row.financeApproval?.status === "pending" && financeAllowed) {
    slot = "financeApproval";
  } else if (row.financeApproval?.status === "approved") {
    if (row.teamOwnerRequired && (assignedTeamOwner === userId || managesMemberTeam)) {
      slot = "teamOwnerApproval";
    } else if (adminAllowed) {
      slot = "adminApproval";
    }
  }
  if (!slot) {
    if (row.financeApproval?.status !== "approved") {
      return jsonError("Finance has to review this request first.", 400);
    }
    return jsonError("You are not an approver for this removal request.", 403);
  }

  // Every approval must come from a different person: nobody fills two slots.
  const otherSlots = (["financeApproval", "teamOwnerApproval", "adminApproval"] as const).filter(
    (name) => name !== slot,
  );
  if (otherSlots.some((name) => String(row[name]?.approver ?? "") === userId)) {
    return jsonError("Each approval must come from a different person.", 403);
  }
  if (row[slot]?.status !== "pending") {
    return jsonError("That approval slot is already decided.", 400);
  }

  // Finance may name the admin who should close the request out. The picker
  // in the modal is region-scoped; the same rule is enforced here.
  const requestedAdminId = String((body as any).adminId ?? "").trim();
  if (requestedAdminId) {
    if (!(action === "approve" && slot === "financeApproval")) {
      return jsonError("Only Finance can choose the admin while approving.", 400);
    }
    const picked: any = await User.findOne({
      _id: requestedAdminId,
      company: actor.company,
      role: "admin",
      companyStatus: "approved",
    }).select("_id name role regionLabel");
    if (!picked) return jsonError("Select a valid admin from your company.", 400);
    if (
      String(picked._id) === userId ||
      String(picked._id) === String(row.requester ?? "") ||
      String(picked._id) === String(member._id)
    ) {
      return jsonError("That admin cannot decide this request.", 400);
    }
    if (row.teamOwnerApproval && String(row.teamOwnerApproval.approver ?? "") === String(picked._id)) {
      return jsonError("That admin already holds the team-owner slot.", 400);
    }
    const memberRegion = String(row.region ?? "").trim();
    if (memberRegion && !isUserInEffectiveRegion(company, memberRegion, picked)) {
      return jsonError("That admin is not in the member's region.", 400);
    }
    row.adminApproval = { approver: picked._id, status: "pending" };
  }

  row[slot].approver = userId;
  row[slot].status = action === "approve" ? "approved" : "rejected";
  row[slot].decidedAt = new Date();
  row[slot].reason = reason;

  let recordRemoved = false;
  if (action === "reject") {
    row.status = "rejected";
  } else {
    const teamDone = !row.teamOwnerRequired || row.teamOwnerApproval?.status === "approved";
    const adminDone = row.adminApproval?.status === "approved";
    if (teamDone && adminDone) {
      row.status = "approved";
      const removed = await Attendance.deleteOne({ _id: row.attendance, user: member._id });
      recordRemoved = removed.deletedCount > 0;
    }
  }
  await row.save();

  const actorName = String(actor?.name ?? "An approver");
  const day = dayLabel(row.date);
  // In-app notification + realtime ping (sound + bottom-right popup) for each
  // target: the next approver in the chain, or the sender on a final call.
  const notifyTargets = async (
    targetUserIds: unknown[],
    title: string,
    message: string,
    type: string,
  ) => {
    const ids = Array.from(new Set(targetUserIds.map((t) => String(t ?? "")).filter(Boolean)));
    if (!ids.length) return;
    await Notification.insertMany(
      ids.map((targetUserId) => ({
        user: targetUserId,
        company: actor.company,
        type,
        title,
        message,
        link: "/profile/attendance",
      })),
    );
    ids.forEach((targetUserId) => emitNotification(targetUserId));
  };

  if (row.status === "approved") {
    await notifyTargets(
      [String(row.requester ?? ""), String(member._id)],
      "Attendance record removed",
      `Your removal request for ${day} was approved. The attendance record has been deleted.`,
      "approval",
    );
  } else if (row.status === "rejected") {
    await notifyTargets(
      [String(row.requester ?? ""), String(member._id)],
      "Attendance removal rejected",
      `Your removal request for ${day} was rejected: ${reason}`,
      "system",
    );
  } else if (action === "approve") {
    // Hand-off: whoever is next in the chain gets their turn flagged.
    const nextTargets: string[] = [];
    if (row.teamOwnerRequired && row.teamOwnerApproval?.status === "pending") {
      nextTargets.push(String(row.teamOwnerApproval.approver ?? ""));
    } else if (row.adminApproval?.status === "pending") {
      nextTargets.push(String(row.adminApproval.approver ?? ""));
    }
    if (nextTargets.length) {
      await notifyTargets(
        nextTargets,
        "Attendance removal awaits your approval",
        `${actorName} approved the removal of ${member.name}'s attendance record for ${day}. Your approval is needed next.`,
        "approval",
      );
    }
  }
  await recordAudit({
    action: `attendance.removal.${action === "approve" ? "approved" : "rejected"}`,
    actionLabel: `Attendance record removal ${action === "approve" ? "approved" : "rejected"}`,
    company: actor.company,
    actor: userId,
    target: String(row.requester),
    entityType: "AttendanceDeleteRequest",
    entityId: String(row._id),
    metadata: {
      member: String(member._id),
      slot,
      region: row.region,
      recordRemoved,
      reason,
    },
  });

  return NextResponse.json({ ok: true, status: row.status, recordRemoved });
}
