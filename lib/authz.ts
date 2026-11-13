/**
 * Shared authorization policies.
 *
 * These are the canonical, database-backed checks for "who may act on a
 * company/team resource". Route handlers and services should call these rather
 * than re-implementing role/ownership logic inline, so a permission rule only
 * has to be correct in one place.
 *
 * No caller-supplied role or owner id is ever trusted; every check re-reads the
 * relevant documents.
 */
import { connectDb } from "@/lib/db";
import { Company } from "@/models/Company";
import { Team } from "@/models/Team";
import { User } from "@/models/User";

/** True when the user is the company owner or an approved company admin. */
export async function isCompanyAdmin(userId: string, companyId: string): Promise<boolean> {
  if (!userId || !companyId) return false;
  await connectDb();
  const company = await Company.findById(companyId).select("owner");
  if (company && String(company.owner) === String(userId)) return true;
  const user = await User.findOne({
    _id: userId,
    company: companyId,
    companyStatus: "approved",
    role: "admin",
  }).select("_id");
  return Boolean(user);
}

/** Throws unless the user is the company owner or an approved company admin. */
export async function assertCompanyAdmin(userId: string, companyId: string): Promise<void> {
  if (!(await isCompanyAdmin(userId, companyId))) {
    throw new Error("You are not allowed to manage this company's reports.");
  }
}

/** True when the user is the manager of the given team. */
export async function isTeamOwner(userId: string, teamId: string): Promise<boolean> {
  if (!userId || !teamId) return false;
  await connectDb();
  const team = await Team.findOne({ _id: teamId, manager: userId }).select("_id");
  return Boolean(team);
}

/** True when the user manages the team or administers its company. */
export async function isTeamOwnerOrAdmin(
  userId: string,
  teamId: string,
  companyId: string,
): Promise<boolean> {
  if (await isTeamOwner(userId, teamId)) return true;
  return isCompanyAdmin(userId, companyId);
}

/** Throws unless the user manages the team or administers its company. */
export async function assertTeamOwnerOrAdmin(
  userId: string,
  teamId: string,
  companyId: string,
): Promise<void> {
  if (!(await isTeamOwnerOrAdmin(userId, teamId, companyId))) {
    throw new Error("Only the Team Owner can manage this report.");
  }
}
