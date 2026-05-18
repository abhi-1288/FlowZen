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
  if (!teamId) return jsonError("teamId is required.");

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

  const employees = await User.find({ _id: { $in: team.employees } }).select("_id");
  await User.updateMany(
    { _id: { $in: team.employees } },
    { $set: { team: null, teamStatus: "none" }, $pull: { activeTeams: team._id } }
  );

  if (String(manager.team ?? "") === String(team._id)) {
    manager.team = null;
    manager.teamStatus = "none";
    await manager.save();
  }

  await Team.deleteOne({ _id: team._id });

  const company = await Company.findById(team.company).select("owner");
  const targets = new Set<string>(employees.map((emp) => String(emp._id)));
  if (company?.owner) targets.add(String(company.owner));

  const message = `${manager.name} has deleted the team ${team.name}.`;
  await Notification.insertMany(
    Array.from(targets).map((targetUserId) => ({
      user: targetUserId,
      company: team.company,
      team: team._id,
      type: "system",
      title: "Team deleted",
      message,
    }))
  );
  Array.from(targets).forEach((target) => emitNotification(target));

  return NextResponse.json({ ok: true });
}
