import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { CrmCompany } from "@/models/CrmCompany";
import { CrmContact } from "@/models/CrmContact";
import { CrmLead } from "@/models/CrmLead";
import { CrmDeal } from "@/models/CrmDeal";
import { CrmActivity } from "@/models/CrmActivity";
import { CrmTicket } from "@/models/CrmTicket";
import { CrmQuotation } from "@/models/CrmQuotation";
import { CrmWorkflow } from "@/models/CrmWorkflow";
import { crmWriteFilter } from "@/lib/crm-assign";
import {
  effectiveRegionLabelOf,
  regionApproverClause,
  regionLabelsOf,
  isMainOfficeRegion,
} from "@/lib/company-regions";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";

const ENTITY_MODELS: Record<string, any> = {
  companies: CrmCompany,
  contacts: CrmContact,
  leads: CrmLead,
  deals: CrmDeal,
  activities: CrmActivity,
  tickets: CrmTicket,
  quotations: CrmQuotation,
  workflows: CrmWorkflow,
};

function userSummary(user: any) {
  return {
    id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    role: user.role || "",
    regionLabel: String(user.regionLabel || ""),
  };
}

function teamSummary(team: any) {
  const approved = (team.employees ?? []).filter((employee: any) => employee?.teamStatus === "approved");
  const manager = team.manager && typeof team.manager === "object" && "name" in team.manager ? team.manager : null;
  return {
    id: String(team._id),
    name: team.name,
    managerId: manager ? String(manager._id ?? "") : String(team.manager ?? ""),
    managerName: manager?.name || "",
    employeeCount: approved.length,
    employeeIds: approved.map((employee: any) => String(employee._id)),
    employees: approved.map((employee: any) => ({
      id: String(employee._id),
      name: employee.name || "",
      email: employee.email || "",
      role: employee.role || "",
    })),
  };
}

async function loadContext(userId: string) {
  const user = await User.findById(userId);
  if (!user?.company) return null;
  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);
  const company = await Company.findById(companyId).select("addresses address owner");
  return { user, company, companyId };
}

/** Candidates are scoped to the selected region of the caller's company. */
export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const context = await loadContext(userId);
  if (!context) return jsonError("No company found.", 400);
  const { user, company, companyId } = context;
  const url = new URL(request.url);
  const ownRegion = effectiveRegionLabelOf(company as any, user);
  const region = String(url.searchParams.get("region") || ownRegion);
  const regionClause = regionApproverClause(company as any, region) || {};
  const scoped = { company: companyId, companyStatus: "approved", ...regionClause };

  const [managers, testers, finance, hr, employees, regionUsers, teams, managedTeams, memberTeams] = await Promise.all([
    User.find({ ...scoped, role: "project-manager" }).sort({ name: 1 }),
    User.find({ ...scoped, role: "qa-tester" }).sort({ name: 1 }),
    User.find({ ...scoped, role: "finance" }).sort({ name: 1 }),
    User.find({ ...scoped, role: "human-resource" }).sort({ name: 1 }),
    User.find({ ...scoped, role: { $in: ["employee", "others", "warehouse"] } }).sort({ name: 1 }),
    User.find(scoped).select("_id"),
    Team.find({ company: companyId }).populate("manager", "name").populate("employees", "name email role teamStatus").sort({ name: 1 }),
    Team.find({ manager: userId }).select("_id"),
    Team.find({ employees: userId }).select("_id"),
  ]);

  const regionIds = new Set(regionUsers.map((entry) => String(entry._id)));
  const visibleTeams = teams.filter((team) => {
    const managerId = String((team.manager as any)?._id ?? team.manager ?? "");
    return regionIds.has(managerId) || (team.employees as any[]).some((employee) => regionIds.has(String(employee?._id ?? "")));
  });

  const isAdminOwner =
    user.role === "admin" &&
    (String((company as any)?.owner ?? "") === userId || isMainOfficeRegion(company as any, user));

  return NextResponse.json({
    ownRegion,
    region,
    regions: regionLabelsOf(company as any),
    currentUser: {
      id: userId,
      role: user.role,
      teamId: user.team ? String(user.team) : "",
      isAdminOwner,
    },
    candidates: {
      managers: managers.map(userSummary),
      testers: testers.map(userSummary),
      finance: finance.map(userSummary),
      hr: hr.map(userSummary),
      employees: employees.map(userSummary),
    },
    managedTeamIds: managedTeams.map((team) => String(team._id)),
    memberTeamIds: memberTeams.map((team) => String(team._id)),
    teams: visibleTeams.map(teamSummary),
  });
}

/**
 * Assign a CRM record to a user or a whole team. Team owners may assign their
 * own team members, and an approved member may take a record that was assigned
 * to their team (only when that team actually has approved work members).
 */
export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const entity = String(body.entity ?? "");
  const recordId = String(body.recordId ?? "");
  const memberId = String(body.memberId ?? "");
  const teamId = String(body.teamId ?? "");
  const leadId = String(body.leadId ?? "");
  const take = Boolean(body.take);

  const Model = ENTITY_MODELS[entity];
  if (!Model) return jsonError("Unknown CRM record type.", 400);
  if (!isObjectId(recordId)) return jsonError("Invalid record id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const context = await loadContext(userId);
  if (!context) return jsonError("No company found.", 400);
  const { user, company, companyId } = context;
  const isAdminOwner =
    user.role === "admin" &&
    (String((company as any)?.owner ?? "") === userId || isMainOfficeRegion(company as any, user));

  const record = await Model.findOne(await crmWriteFilter(userId)).where({ _id: recordId });
  if (!record) return jsonError("Record not found.", 404);

  const patch: Record<string, unknown> = {};

  if (teamId) {
    if (!isObjectId(teamId)) return jsonError("Invalid team id.", 400);
    const team = await Team.findOne({ _id: teamId, company: companyId }).populate("manager", "name");
    if (!team) return jsonError("Team not found.", 404);
    if (!isAdminOwner && String(team.manager ?? "") !== userId) {
      return jsonError("Only the team owner can assign their whole team.", 403);
    }
    const approved = (team.employees as any[]).filter((employee) => employee?.teamStatus === "approved");
    if (approved.length === 0) return jsonError("This team has no approved work members.", 400);
    patch.teamId = teamId;
    patch.teamName = team.name;
    patch.assignedTo = String((team.manager as any)?._id ?? team.manager ?? "");
    patch.ownerId = patch.assignedTo;
    if (entity === "tickets") patch.agentId = patch.assignedTo;
  } else if (memberId) {
    if (!isObjectId(memberId)) return jsonError("Invalid member id.", 400);
    const target = await User.findOne({ _id: memberId, company: companyId, companyStatus: "approved" });
    if (!target) return jsonError("Member not found.", 404);

    if (take && memberId === userId) {
      const teamIds = await Team.find({ employees: userId }).select("_id");
      const allowedIds = teamIds.map((team) => String(team._id));
      const recordTeamId = String(record.teamId ?? "");
      if (!recordTeamId || !allowedIds.includes(recordTeamId)) {
        return jsonError("You can only take work assigned to your own team.", 403);
      }
      const team = await Team.findById(recordTeamId).select("employees");
      const hasWork = (team?.employees as any[] || []).some((employee) => employee?.teamStatus === "approved");
      if (!hasWork) return jsonError("This team has no approved work members yet.", 400);
    } else if (!isAdminOwner) {
      const managedTeams = await Team.find({ manager: userId, employees: memberId }).select("_id");
      if (!managedTeams.length) return jsonError("You can only assign members of your own team.", 403);
    }

    if (leadId && !isObjectId(leadId)) return jsonError("Invalid lead id.", 400);
    if (leadId) {
      const lead = await User.findOne({ _id: leadId, company: companyId, companyStatus: "approved" });
      if (!lead) return jsonError("Lead not found.", 404);
      patch.assignedLeadId = leadId;
    }
    patch.assignedTo = memberId;
    patch.ownerId = memberId;
    if (entity === "tickets") patch.agentId = memberId;
    if (take) patch.takenById = userId;
  } else {
    return jsonError("Member or team is required.", 400);
  }

  const access = await crmWriteFilter(userId);
  const updated = await Model.findOneAndUpdate(
    { ...access, _id: recordId },
    patch,
    { new: true },
  );
  if (!updated) return jsonError("Record not found.", 404);

  return NextResponse.json({ record: serializeDoc(updated) });
}
