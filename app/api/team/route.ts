import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { createJoinCode, createRoleJoinCode } from "@/lib/codes";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError("Team name is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (!["project-manager", "qa-tester", "human-resource", "finance"].includes(String(user.role))) {
    return jsonError("Only project managers, Q-A testers, HR, or finance can create teams.", 403);
  }
  if (!user.company || user.companyStatus !== "approved") return jsonError("You need admin approval before creating a team.", 403);
  const existingTeams = await Team.countDocuments({ manager: user._id });
  if (user.role === "human-resource" && existingTeams >= 2) {
    return jsonError("HR can create up to 2 teams only.", 409);
  }
  if (["project-manager", "qa-tester", "finance"].includes(String(user.role)) && existingTeams >= 5) {
    return jsonError("You can create up to 5 teams only.", 409);
  }

  const joinCode = createJoinCode("TM");
  const team = await Team.create({
    name,
    company: user.company,
    manager: user._id,
    joinCode,
    otherJoinCode: createRoleJoinCode(joinCode),
    employees: []
  });

  user.team = team._id;
  user.teamStatus = "approved";
  await user.save();

  await Notification.create({
    user: user._id,
    company: user.company,
    team: team._id,
    type: "system",
    title: "Team created",
    message: `${team.name} is ready for employee onboarding.`
  });
  emitNotification(String(user._id));

  return NextResponse.json({ team: serializeDoc(team) }, { status: 201 });
}
