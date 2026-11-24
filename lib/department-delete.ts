import { connectDb } from "@/lib/db";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { effectiveRegionLabelOf, regionEntryOf, regionStaffingOf } from "@/lib/company-regions";

export type DepartmentDeleteRecipients = {
  adminHeadId: string;
  hrHeadId: string;
  departmentHeadId: string;
  memberIds: string[];
};

/**
 * Everyone who must be kept informed of a department deletion: both regional
 * heads, the department head, and every member of the department. Deduped so
 * someone holding two roles only gets one notification.
 */
export async function departmentDeleteRecipients(
  companyId: unknown,
  department: string,
  region: string,
  requesterId: string,
): Promise<DepartmentDeleteRecipients> {
  const company = await Company.findById(companyId)
    .select("addresses address owner")
    .lean();
  const staffing = regionStaffingOf(regionEntryOf(company as any, region));
  const approvedCreate = await JoinRequest.findOne({
    company: companyId,
    kind: "department",
    status: "approved",
    "metadata.department": department,
  })
    .sort({ createdAt: -1 })
    .select("requester metadata")
    .lean();
  const departmentTeam = await Team.findOne({ company: companyId, name: department })
    .select("manager")
    .lean();
  const headId = String(
    (approvedCreate as any)?.metadata?.departmentHeadId ??
      (approvedCreate as any)?.requester ??
      (departmentTeam as any)?.manager ??
      requesterId,
  );

  const members = await User.find({ company: companyId, department })
    .select("_id")
    .lean();
  const memberIds = members.map((member) => String(member._id));

  return {
    adminHeadId: staffing.adminHead,
    hrHeadId: staffing.hrHead,
    departmentHeadId: headId || requesterId,
    // Members are notified separately with a member-specific message, but this
    // list is also used for "requested" notices so the whole department knows.
    memberIds,
  };
}

export async function notifyDepartmentDelete(
  companyId: unknown,
  userIds: string[],
  title: string,
  message: string,
  link = "/profile/onboarding",
) {
  const unique = Array.from(new Set(userIds.map((id) => String(id)).filter(Boolean)));
  if (unique.length === 0) return;
  await Notification.insertMany(
    unique.map((userId) => ({
      user: userId,
      company: companyId,
      type: "approval",
      title,
      message,
      link,
    })),
  );
  unique.forEach((userId) => emitNotification(userId));
}

/**
 * Actually removes the department after the grace period. The teams to remove
 * were captured when the request was made (only ones managed by the department
 * head or requester), so a normal team with the same name is never touched.
 */
export async function executeDepartmentDeletion(request: {
  company: unknown;
  requester: unknown;
  metadata?: Record<string, unknown>;
}) {
  await connectDb();
  const meta = (request.metadata ?? {}) as Record<string, unknown>;
  const department = String(meta.department ?? "").trim();
  if (!department) throw new Error("Department name is missing from the delete request.");

  const companyId = request.company;
  const memberIds = Array.isArray(meta.memberIds)
    ? meta.memberIds.map((id) => String(id)).filter(Boolean)
    : [];

  const capturedIds = Array.isArray(meta.teamIds)
    ? meta.teamIds.map((id) => String(id)).filter(Boolean)
    : [];
  const teams = capturedIds.length
    ? await Team.find({ company: companyId, _id: { $in: capturedIds } })
    : await Team.find({ company: companyId, name: department, isDepartment: true });
  const teamIds = teams.map((team) => String(team._id));

  // Clear the department label on everyone still filed under it.
  await User.updateMany(
    { company: companyId, department },
    { $unset: { department: 1 } },
  );

  // Only detach people whose primary team is one of the department teams.
  if (teamIds.length > 0) {
    await User.updateMany(
      { company: companyId, team: { $in: teamIds } },
      { $set: { team: null, teamStatus: "none" } },
    );
    await Team.deleteMany({ _id: { $in: teamIds } });
  }

  return { department, teamIds, affectedMembers: memberIds.length || undefined };
}

export async function departmentRegionOf(
  companyId: unknown,
  department: string,
): Promise<string> {
  const approvedCreate = await JoinRequest.findOne({
    company: companyId,
    kind: "department",
    status: "approved",
    "metadata.department": department,
  })
    .sort({ createdAt: -1 })
    .select("metadata")
    .lean();
  const storedRegion = String((approvedCreate as any)?.metadata?.region ?? "");
  if (storedRegion) return storedRegion;

  const headId = String((approvedCreate as any)?.metadata?.departmentHeadId ?? "");
  if (headId) {
    const head = await User.findById(headId).select("regionLabel").lean();
    if (head) {
      const company = await Company.findById(companyId).select("addresses address").lean();
      return effectiveRegionLabelOf(company as any, head as any);
    }
  }
  const team = await Team.findOne({ company: companyId, name: department, isDepartment: true })
    .select("manager")
    .lean();
  if (team) {
    const head = await User.findById((team as any).manager).select("regionLabel").lean();
    if (head) {
      const company = await Company.findById(companyId).select("addresses address").lean();
      return effectiveRegionLabelOf(company as any, head as any);
    }
  }
  const member = await User.findOne({ company: companyId, department })
    .select("regionLabel")
    .lean();
  const company = await Company.findById(companyId).select("addresses address").lean();
  return member ? effectiveRegionLabelOf(company as any, member as any) : "";
}
