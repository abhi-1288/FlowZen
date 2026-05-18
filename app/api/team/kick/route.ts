import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const teamId = String(body.teamId ?? "");
  const employeeId = String(body.employeeId ?? "");
  if (!teamId || !employeeId) return jsonError("teamId and employeeId are required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [manager, team] = await Promise.all([User.findById(userId), Team.findById(teamId)]);
  if (!manager) return jsonError("Manager not found.", 404);
  if (!team) return jsonError("Team not found.", 404);
  if (String(team.manager) !== userId) return jsonError("Forbidden", 403);
  const employee = await User.findById(employeeId);
  if (!employee) return jsonError("Employee not found.", 404);

  await Team.updateOne({ _id: teamId }, { $pull: { employees: employeeId } });
  await User.updateOne({ _id: employeeId, team: teamId }, { $set: { team: null, teamStatus: "none" } });
  await User.updateOne({ _id: employeeId }, { $pull: { activeTeams: team._id } });

  const company = await Company.findById(team.company).select("owner");
  const targets = [String(employee._id)];
  if (company?.owner) targets.push(String(company.owner));

  const message = `${manager.name} has kicked out ${employee.name} from the team ${team.name}.`;
  await Notification.insertMany(
    targets.map((targetUserId) => ({
      user: targetUserId,
      company: team.company,
      team: team._id,
      type: "system",
      title: "Team membership updated",
      message,
    }))
  );
  targets.forEach((target) => emitNotification(target));

  return NextResponse.json({ ok: true });
}
