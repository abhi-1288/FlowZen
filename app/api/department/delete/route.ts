import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import {
  departmentDeleteRecipients,
  departmentRegionOf,
  notifyDepartmentDelete,
} from "@/lib/department-delete";
import { departmentRegionHeads } from "@/lib/department-routing";

/**
 * A department head or the region's HR head may request a deletion. It goes to
 * the region's HR head first, then to the admin head for final approval, and
 * even then deletion waits 7 days.
 */
export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const department = String(body.department ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  if (!department) return jsonError("Department name is required.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId);
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("You are not assigned to a company.", 403);
  if (String(actor.companyStatus) !== "approved") {
    return jsonError("Your company membership is not approved.", 403);
  }
  const companyId = actor.company;

  const approvedCreate = await JoinRequest.findOne({
    company: companyId,
    kind: "department",
    status: "approved",
    "metadata.department": department,
  })
    .sort({ createdAt: -1 })
    .lean();
  const departmentHeadId = String(
    (approvedCreate as any)?.metadata?.departmentHeadId ?? (approvedCreate as any)?.requester ?? "",
  );
  const namedTeams = await Team.find({ company: companyId, name: department });
  const team = namedTeams.find(
    (candidate) =>
      String(candidate.manager) === departmentHeadId || String(candidate.manager) === String(userId),
  );
  if (!departmentHeadId && namedTeams.length === 0) {
    return jsonError("Department not found.", 404);
  }

  const region = await departmentRegionOf(companyId, department);
  const { hrHeadId, adminHeadId } = await departmentRegionHeads(companyId, region);

  const isDepartmentHead = departmentHeadId
    ? departmentHeadId === String(userId)
    : String(team?.manager ?? "") === String(userId);
  const isHrHead = String(actor.role) === "human-resource" && hrHeadId === String(userId);
  if (!isDepartmentHead && !isHrHead) {
    return jsonError("Only the department head or the HR head of this region can request deletion.", 403);
  }
  if (!adminHeadId) {
    return jsonError("No admin head is assigned to this region. Ask an admin to assign one first.", 409);
  }
  if (adminHeadId === String(userId)) {
    return jsonError("The admin head must approve a deletion request; they cannot start one.", 403);
  }
  // When the requester is the HR head, they have already done the HR stage.
  const skipHrStage = isHrHead;
  let approverId = adminHeadId;
  if (!skipHrStage) {
    if (!hrHeadId) {
      return jsonError("No HR head is assigned to this region. Ask an admin to assign one first.", 409);
    }
    approverId = hrHeadId;
  }

  // Only teams managed by the department head (or the requester) are safe to
  // remove — a normal team with the same name stays untouched.
  const teamIds = namedTeams
    .filter(
      (candidate) =>
        String(candidate.manager) === departmentHeadId || String(candidate.manager) === String(userId),
    )
    .map((candidate) => String(candidate._id));

  const existing = await JoinRequest.findOne({
    company: companyId,
    kind: "department-delete",
    status: { $in: ["pending", "hr-approved", "approved"] },
    "metadata.department": department,
  });
  if (existing) return jsonError("A deletion request for this department is already in progress.", 409);

  const recipients = await departmentDeleteRecipients(
    companyId,
    department,
    region,
    String(userId),
  );
  const memberCount = recipients.memberIds.length;

  const joinRequest = await JoinRequest.create({
    requester: userId,
    approver: approverId,
    company: companyId,
    team: team?._id ?? null,
    kind: "department-delete",
    status: "pending",
    metadata: {
      department,
      reason,
      region,
      requesterName: actor.name,
      departmentHeadId: recipients.departmentHeadId,
      hrHeadId: recipients.hrHeadId,
      adminHeadId: recipients.adminHeadId,
      skipHrStage,
      teamIds,
      memberIds: recipients.memberIds,
      memberCount,
    },
  });

  await notifyDepartmentDelete(
    companyId,
    [
      recipients.adminHeadId,
      recipients.hrHeadId,
      recipients.departmentHeadId,
      ...recipients.memberIds,
    ],
    "Department deletion requested",
    `${actor.name ?? "A member"} requested deletion of the "${department}" department. Awaiting approval from the region's HR head, then the admin head.`,
  );

  return NextResponse.json(
    { requestId: String(joinRequest._id), status: "submitted" },
    { status: 201 },
  );
}

/** Cancel a scheduled deletion — only inside the 4-day window after approval. */
export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const requestId = String(body.requestId ?? "").trim();
  if (!requestId) return jsonError("requestId is required.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const joinRequest = await JoinRequest.findById(requestId);
  if (!joinRequest || String(joinRequest.kind) !== "department-delete") {
    return jsonError("Deletion request not found.", 404);
  }
  if (String(joinRequest.requester) !== String(userId)) {
    return jsonError("Only the person who requested this deletion can cancel it.", 403);
  }
  if (String(joinRequest.status) !== "approved") {
    return jsonError("This deletion request is no longer scheduled.", 409);
  }

  const meta = (joinRequest.metadata ?? {}) as Record<string, unknown>;
  const deadline = meta.cancelDeadline ? new Date(String(meta.cancelDeadline)) : null;
  if (!deadline || Number.isNaN(deadline.getTime()) || Date.now() > deadline.getTime()) {
    return jsonError("The 4-day cancellation window has closed.", 409);
  }
  if (meta.deletedAt) return jsonError("The department has already been deleted.", 409);

  const department = String(meta.department ?? "");
  joinRequest.status = "rejected";
  joinRequest.cancelReason = "Cancelled by requester during the grace period.";
  joinRequest.cancelledAt = new Date();
  meta.cancelledAt = new Date().toISOString();
  joinRequest.metadata = { ...meta };
  joinRequest.markModified("metadata");
  await joinRequest.save();

  await notifyDepartmentDelete(
    joinRequest.company,
    [
      String(meta.adminHeadId ?? ""),
      String(meta.hrHeadId ?? ""),
      String(meta.departmentHeadId ?? joinRequest.requester),
      ...(Array.isArray(meta.memberIds) ? meta.memberIds.map(String) : []),
    ],
    "Department deletion cancelled",
    `The scheduled deletion of the "${department}" department was cancelled by the requester. No changes were made.`,
  );

  return NextResponse.json({ ok: true, status: "cancelled" });
}
