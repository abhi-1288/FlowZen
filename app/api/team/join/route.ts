import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!code) return jsonError("Team code is required.");
  const isSuffixedTeamCode = /^TM-.+-\d+$/.test(code);
  const baseCode = isSuffixedTeamCode ? code.replace(/-\d+$/, "") : code;

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, team] = await Promise.all([
    User.findById(userId),
    Team.findOne({ $or: [{ joinCode: code }, { joinCode: baseCode }, { otherJoinCode: code }] })
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!team) return jsonError("Invalid team code.", 404);
  const isOtherCode = isSuffixedTeamCode || String(team.otherJoinCode ?? "") === code;
  if (isOtherCode) {
    if (user.role !== "others") {
      return jsonError("This team code is for Others role users.", 403);
    }
  } else if (user.role !== "employee") {
    return jsonError("This team code is for Employee role users.", 403);
  }
  const isAlreadyMember = team.employees?.some((employeeId: { toString: () => string }) => String(employeeId) === userId);
  const hasActiveTeam = user.activeTeams?.some((teamId: { toString: () => string }) => String(teamId) === String(team._id));
  if (isAlreadyMember || hasActiveTeam || (String(user.team ?? "") === String(team._id) && user.teamStatus === "approved")) {
    return NextResponse.json({ status: "joined" });
  }

  const existingPendingRequest = await JoinRequest.findOne({
    requester: userId,
    team: team._id,
    kind: "team",
    status: "pending"
  });
  if (existingPendingRequest) {
    user.company = team.company;
    user.team = team._id;
    user.teamStatus = "pending";
    await user.save();
    return NextResponse.json({ request: serializeDoc(existingPendingRequest), status: "requested" });
  }

  const joinRequest = await JoinRequest.findOneAndUpdate(
    { requester: userId, team: team._id, kind: "team", status: "pending" },
    {
      $setOnInsert: {
        requester: userId,
        approver: team.manager,
        company: team.company,
        team: team._id,
        kind: "team"
      }
    },
    { new: true, upsert: true }
  );

  user.company = team.company;
  user.team = team._id;
  user.teamStatus = "pending";
  await user.save();

  await Notification.create({
    user: team.manager,
    company: team.company,
    team: team._id,
    type: "approval",
    title: isOtherCode ? "Others join request" : "Employee join request",
    message: `${user.name} requested approval to join ${team.name}.`
  });
  emitNotification(String(team.manager));

  return NextResponse.json({ request: serializeDoc(joinRequest), status: "requested" }, { status: 201 });
}
