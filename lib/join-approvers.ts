import type { Types } from "mongoose";
import { User } from "@/models/User";
import { Company } from "@/models/Company";

/** Company join codes tied to HR-distributed role invites → approve via HR, not company owner. */
const COMPANY_JOIN_ROLES_USING_HR = new Set([
  "project-manager",
  "qa-tester",
  "finance",
  "employee",
  "others",
]);

/**
 * We personalize HR-distributed codes by appending a suffix:
 *   <baseCompanyRoleCode>-HR<tag>
 *
 * This allows multiple HRs to share the same company role codes while still tracking
 * which HR issued the invite.
 */
export function hrInviteTagForUserId(userId: string): string {
  const normalized = String(userId ?? "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  return normalized.slice(-6) || "000000";
}

export function hrInviteSuffixForUserId(userId: string): string {
  return `HR${hrInviteTagForUserId(userId)}`;
}

export function stripHrInviteSuffix(code: string): { baseCode: string; hrSuffix: string | null } {
  const normalized = String(code ?? "").trim().toUpperCase();
  const match = normalized.match(/^(.*)-HR([A-Z0-9]{4,12})$/);
  if (!match) return { baseCode: normalized, hrSuffix: null };
  return { baseCode: match[1], hrSuffix: `HR${match[2]}` };
}

export function companyJoinUsesHrApprover(codeRole: string): boolean {
  return COMPANY_JOIN_ROLES_USING_HR.has(codeRole);
}

export async function findApprovedHrUserId(
  companyId: Types.ObjectId | string,
): Promise<string | null> {
  const hr = await User.findOne({
    company: companyId,
    role: "human-resource",
    companyStatus: "approved",
  })
    .select("_id")
    .sort({ createdAt: 1 });

  return hr ? String(hr._id) : null;
}

export async function listApprovedHrUserIds(
  companyId: Types.ObjectId | string,
): Promise<string[]> {
  const hrs = await User.find({
    company: companyId,
    role: "human-resource",
    companyStatus: "approved",
  }).select("_id");
  return hrs.map((hr) => String(hr._id));
}

export async function findApprovedHrUserIdByInviteSuffix(
  companyId: Types.ObjectId | string,
  hrSuffix: string,
): Promise<string | null> {
  const suffix = String(hrSuffix ?? "").trim().toUpperCase();
  if (!suffix.startsWith("HR")) return null;
  const tag = suffix.slice(2);
  if (!tag) return null;

  const hrs = await User.find({
    company: companyId,
    role: "human-resource",
    companyStatus: "approved",
  })
    .select("_id")
    .sort({ createdAt: 1 });

  const match = hrs.find((hr) => hrInviteTagForUserId(String(hr._id)) === tag);
  return match ? String(match._id) : null;
}

export async function findApprovedAdminUserId(
  companyId: Types.ObjectId | string,
  excludeUserId?: string,
): Promise<string | null> {
  const filter: Record<string, any> = {
    company: companyId,
    role: "admin",
    companyStatus: "approved",
  };
  if (excludeUserId) {
    filter._id = { $ne: excludeUserId };
  }
  const admin = await User.findOne(filter).select("_id").sort({ createdAt: 1 });
  return admin ? String(admin._id) : null;
}

export async function listApprovedAdminUserIds(
  companyId: Types.ObjectId | string,
): Promise<string[]> {
  const admins = await User.find({
    company: companyId,
    role: "admin",
    companyStatus: "approved",
  }).select("_id");
  return admins.map((a) => String(a._id));
}

export async function resolveCompanyJoinApproverId(
  company: { _id: Types.ObjectId | string; owner: Types.ObjectId | string },
  codeRole: string,
): Promise<string> {
  if (codeRole === "admin") {
    const admin = await findApprovedAdminUserId(company._id);
    if (admin) return admin;
    const hr = await findApprovedHrUserId(company._id);
    if (hr) return hr;
    return String(company.owner);
  }
  if (codeRole === "human-resource") {
    const admin = await findApprovedAdminUserId(company._id);
    if (admin) return String(admin);
  }
  if (companyJoinUsesHrApprover(codeRole)) {
    const hrId = await findApprovedHrUserId(company._id);
    if (hrId) return hrId;
  }
  return String(company.owner);
}

export async function resolveTeamJoinApproverId(team: {
  company: Types.ObjectId | string;
  manager: Types.ObjectId | string;
}): Promise<string> {
  // Prefer the team manager (creator) as the approver. If the manager record
  // isn't present or isn't approved, fall back to an approved HR. If no HR
  // exists, fall back to the company owner.
  try {
    if (team.manager) {
      const manager = await User.findOne({ _id: team.manager, companyStatus: "approved" }).select("_id");
      if (manager) return String(manager._id);
    }
  } catch (err) {
    // ignore and try fallbacks
  }

  const hrId = await findApprovedHrUserId(team.company);
  if (hrId) return hrId;

  const company = await Company.findById(team.company).select("owner");
  if (company && (company as any).owner) return String((company as any).owner);

  // Last resort: return manager id coerced to string (may be empty)
  return String(team.manager ?? "");
}
