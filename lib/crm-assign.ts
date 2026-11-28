import type { FilterQuery } from "mongoose";
import { Team } from "@/models/Team";

/**
 * CRM records are normally private to their creator (`owner`). Once a record is
 * assigned to a team, the team manager and its approved members need to see and
 * act on it. These helpers keep that rule in one place for every CRM route.
 */
export async function crmTeamIdsOf(userId: string): Promise<string[]> {
  const teams = await Team.find({
    $or: [{ manager: userId }, { employees: userId }],
  }).select("_id");
  return teams.map((team) => String(team._id));
}

export async function crmReadFilter(userId: string): Promise<FilterQuery<any>> {
  const teamIds = await crmTeamIdsOf(userId);
  return {
    $or: [
      { owner: userId },
      { assignedTo: userId },
      { ownerId: userId },
      { agentId: userId },
      ...(teamIds.length ? [{ teamId: { $in: teamIds } }] : []),
    ],
  };
}

export async function crmWriteFilter(userId: string): Promise<FilterQuery<any>> {
  return crmReadFilter(userId);
}
