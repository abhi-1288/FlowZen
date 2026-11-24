import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { departmentRegionOf } from "@/lib/department-delete";
import { regionEntryOf, regionStaffingOf } from "@/lib/company-regions";

/**
 * Departments are derived, not stored in their own collection: a department is
 * the `department` label shared by its members, plus the team flagged
 * `isDepartment` that was created when it was approved. This keeps the list in
 * sync with existing data without a migration.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company companyStatus role");
  if (!actor) return jsonError("User not found.", 404);
  if (String(actor.companyStatus) !== "approved" || !actor.company) {
    return jsonError("Your company membership is not approved.", 403);
  }
  const companyId = actor.company;

  const [members, teams, deleteRequests, createRequests] = await Promise.all([
    User.find({ company: companyId })
      .select("name email department role team")
      .lean(),
    Team.find({ company: companyId }).select("name manager createdAt isDepartment employees").lean(),
    JoinRequest.find({
      company: companyId,
      kind: "department-delete",
      status: { $in: ["pending", "hr-approved", "approved"] },
    })
      .select("status metadata createdAt requester")
      .lean(),
    JoinRequest.find({ company: companyId, kind: "department", status: "approved" })
      .select("metadata createdAt requester")
      .lean(),
  ]);

  const isDepartmentTeams = teams.filter((t) => Boolean((t as any).isDepartment));
  const teamByName = new Map(
    isDepartmentTeams.map((team) => [String((team as any).name ?? "").trim(), team as any]),
  );
  const memberIdsByDepartment = new Map<string, string[]>();
  const membersByDepartment = new Map<string, { id: string; name: string; email: string; role: string }[]>();

  const createByName = new Map<string, any>();
  for (const request of createRequests) {
    const name = String((request as any).metadata?.department ?? "").trim();
    if (!name) continue;
    const existing = createByName.get(name);
    const at = new Date((request as any).createdAt ?? 0).getTime();
    const existingAt = existing ? new Date(existing.createdAt ?? 0).getTime() : -1;
    if (!existing || at > existingAt) createByName.set(name, request);
  }

  const headIds = [
    ...teams.map((t) => String((t as any).manager ?? "")),
    ...[...createByName.values()].map((r) =>
      String((r as any).metadata?.departmentHeadId ?? (r as any).requester ?? ""),
    ),
  ];
  const [headUsers, requesterUsers] = await Promise.all([
    User.find({ _id: { $in: headIds } }).select("name").lean(),
    User.find({
      _id: {
        $in: [
          ...deleteRequests.map((r) => String((r as any).requester ?? "")),
          ...createRequests.map((r) => String((r as any).requester ?? "")),
        ],
      },
    })
      .select("name")
      .lean(),
  ]);
  const headNames = new Map(headUsers.map((u) => [String(u._id), String((u as any).name ?? "")]));
  const requesterNames = new Map(
    requesterUsers.map((u) => [String(u._id), String((u as any).name ?? "")]),
  );

  const deleteByName = new Map<string, any>();
  for (const request of deleteRequests) {
    const name = String((request as any).metadata?.department ?? "").trim();
    if (!name) continue;
    const existing = deleteByName.get(name);
    const createdAt = new Date((request as any).createdAt ?? 0).getTime();
    const existingAt = existing ? new Date(existing.createdAt ?? 0).getTime() : -1;
    if (!existing || createdAt > existingAt) deleteByName.set(name, request);
  }

  // Map each department to the teams that belong to it (assigned team, or a
  // legacy isDepartment team with the same name). Members of those teams are
  // counted as department members even if they never had the label stamped.
  const departmentTeamIds = new Map<string, Set<string>>();
  for (const [name, request] of createByName) {
    const tid = String((request as any)?.metadata?.teamId ?? "").trim();
    if (tid) {
      if (!departmentTeamIds.has(name)) departmentTeamIds.set(name, new Set());
      departmentTeamIds.get(name)!.add(tid);
    }
  }
  for (const team of teams) {
    if (!Boolean((team as any).isDepartment)) continue;
    const tname = String((team as any).name ?? "").trim();
    const hasMembers = members.some((m) => String((m as any).department ?? "").trim() === tname);
    if (createByName.has(tname) || hasMembers) {
      if (!departmentTeamIds.has(tname)) departmentTeamIds.set(tname, new Set());
      departmentTeamIds.get(tname)!.add(String((team as any)._id));
    }
  }
  const teamToDepartments = new Map<string, Set<string>>();
  for (const [dept, tids] of departmentTeamIds) {
    for (const tid of tids) {
      if (!teamToDepartments.has(tid)) teamToDepartments.set(tid, new Set());
      teamToDepartments.get(tid)!.add(dept);
    }
  }
  const employeeToDepartments = new Map<string, Set<string>>();
  for (const team of teams) {
    const tid = String((team as any)._id);
    const depts = teamToDepartments.get(tid);
    if (!depts) continue;
    for (const empId of ((team as any).employees ?? [])) {
      if (!employeeToDepartments.has(String(empId))) employeeToDepartments.set(String(empId), new Set());
      for (const d of depts) employeeToDepartments.get(String(empId))!.add(d);
    }
  }

  for (const member of members) {
    const depts = new Set<string>();
    const label = String((member as any).department ?? "").trim();
    if (label) depts.add(label);
    const tid = String((member as any).team ?? "").trim();
    if (tid && teamToDepartments.has(tid)) {
      for (const d of teamToDepartments.get(tid)!) depts.add(d);
    }
    const eid = String((member as any)._id ?? "").trim();
    if (eid && employeeToDepartments.has(eid)) {
      for (const d of employeeToDepartments.get(eid)!) depts.add(d);
    }
    for (const name of depts) {
      const ids = memberIdsByDepartment.get(name) ?? [];
      if (!ids.includes(String(member._id))) {
        ids.push(String(member._id));
        memberIdsByDepartment.set(name, ids);
      }
      const list = membersByDepartment.get(name) ?? [];
      if (!list.some((m) => m.id === String(member._id))) {
        list.push({
          id: String(member._id),
          name: String((member as any).name ?? ""),
          email: String((member as any).email ?? ""),
          role: String((member as any).role ?? ""),
        });
        membersByDepartment.set(name, list);
      }
    }
  }

  const companyDoc = await Company.findById(companyId).select("addresses address").lean();
  const names = Array.from(
    new Set([
      ...memberIdsByDepartment.keys(),
      ...createByName.keys(),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const departments = await Promise.all(names.map(async (name) => {
    const team = teamByName.get(name);
    const created = createByName.get(name);
    const deletion = deleteByName.get(name);
    const meta = (deletion?.metadata ?? {}) as Record<string, unknown>;
    const headId = String(
      (team as any)?.manager ??
        (created as any)?.metadata?.departmentHeadId ??
        (created as any)?.requester ??
        "",
    );
    let deleteState: Record<string, unknown> | null = null;
    if (deletion) {
      deleteState = {
        status: String(deletion.status ?? "pending"),
        requestedBy: requesterNames.get(String(deletion.requester ?? "")) ?? "",
        reason: String(meta.reason ?? ""),
        acceptedAt: meta.acceptedAt ?? null,
        deleteAt: meta.deleteAt ?? null,
        cancelDeadline: meta.cancelDeadline ?? null,
        deletedAt: meta.deletedAt ?? null,
      };
    }
    const region = await departmentRegionOf(companyId, name);
    const hrHeadId = regionStaffingOf(regionEntryOf(companyDoc as any, region)).hrHead;
    const isHead = !!headId && headId === String(userId);
    const isHrHead = !!hrHeadId && hrHeadId === String(userId);
    const isAdmin = String(actor.role ?? "") === "admin";
    const isMember = (memberIdsByDepartment.get(name) ?? []).includes(String(userId));
    const assignedTeamId = String((created as any)?.metadata?.teamId ?? team?._id ?? "");
    const assignedTeamName = String((created as any)?.metadata?.teamName ?? team?.name ?? "");
    const canCancel =
      !!deletion &&
      String(deletion.status) === "approved" &&
      String(deletion.requester) === String(userId) &&
      !!meta.cancelDeadline &&
      Date.now() <= new Date(String(meta.cancelDeadline)).getTime() &&
      !meta.deletedAt;

    return {
      name,
      head: headId ? headNames.get(headId) ?? "" : "",
      headId,
      createdAt:
        (team as any)?.createdAt ??
        (created as any)?.metadata?.approvedAt ??
        (created as any)?.createdAt ??
        null,
      memberCount: (memberIdsByDepartment.get(name) ?? []).length,
      members: membersByDepartment.get(name) ?? [],
      deleteState,
      canRequestDelete: (isHead || isHrHead) && !deleteState,
      canAssignTeam: !deleteState && (isHead || isHrHead || isAdmin || isMember),
      teamId: assignedTeamId,
      teamName: assignedTeamName,
      canCancel,
      deleteRequestId: deletion ? String(deletion._id) : "",
    };
  }));

  return NextResponse.json({ departments });
}
