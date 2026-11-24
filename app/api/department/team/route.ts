import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { createJoinCode, createRoleJoinCode } from "@/lib/codes";
import { emitNotification } from "@/lib/realtime";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";

/**
 * Once a department is approved, the requester assigns the team themselves:
 * either an existing team they manage, or a brand new one. The team is flagged
 * as the department's team so deletion only ever removes the right one.
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

  const teams = await Team.find({ manager: userId })
    .select("name")
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json({
    teams: teams.map((team) => ({ id: String(team._id), name: String((team as any).name ?? "") })),
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const department = String(body.department ?? "").trim();
  const teamId = String(body.teamId ?? "").trim();
  const teamName = String(body.teamName ?? "").trim();
  if (!department) return jsonError("Department name is required.", 400);
  if (!teamId && !teamName) return jsonError("Choose an existing team or enter a new team name.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId);
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || String(actor.companyStatus) !== "approved") {
    return jsonError("Your company membership is not approved.", 403);
  }
  const companyId = actor.company;

  const approvedCreate = await JoinRequest.findOne({
    company: companyId,
    kind: "department",
    status: "approved",
    "metadata.department": department,
  }).sort({ createdAt: -1 });
  if (!approvedCreate) return jsonError("Approved department not found.", 404);
  const meta = (approvedCreate.metadata ?? {}) as Record<string, unknown>;
  const headId = String(meta.departmentHeadId ?? approvedCreate.requester ?? "");
  const actorRole = String(actor.role ?? "");
  const allowed =
    !headId ||
    headId === String(userId) ||
    actorRole === "admin" ||
    actorRole === "human-resource";
  if (!allowed) {
    return jsonError("Only the department head can assign its team.", 403);
  }

  let team;
  if (teamId) {
    team = await Team.findOne({ _id: teamId, company: companyId });
    if (!team) return jsonError("Team not found in your company.", 404);
    if (String(team.manager ?? "") !== String(userId)) {
      return jsonError("You can only assign a team you manage.", 403);
    }
    if (!team.isDepartment) {
      team.isDepartment = true;
      await team.save();
    }
  } else {
    if (teamName.length > 100) return jsonError("Team name must be 100 characters or fewer.", 400);
    const joinCode = createJoinCode("TM");
    team = await Team.create({
      name: teamName,
      company: companyId,
      manager: userId,
      createdBy: userId,
      joinCode,
      otherJoinCode: createRoleJoinCode(joinCode),
      employees: [],
      isDepartment: true,
    });
  }

  await User.updateOne(
    { _id: userId },
    { $set: { team: team._id, teamStatus: "approved" } },
  );

  meta.teamId = String(team._id);
  meta.teamName = String((team as any).name ?? "");
  approvedCreate.metadata = { ...meta };
  approvedCreate.markModified("metadata");
  await approvedCreate.save();

  await Notification.create({
    user: userId,
    company: companyId,
    team: team._id,
    type: "system",
    title: "Department team assigned",
    message: `"${teamName || team.name}" is now the team for the "${department}" department.`,
    link: "/profile/onboarding",
  });
  emitNotification(String(userId));

  return NextResponse.json({ team: serializeDoc(team) }, { status: 201 });
}
