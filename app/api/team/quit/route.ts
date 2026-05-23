import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { JoinRequest } from "@/models/JoinRequest";
import { Company } from "@/models/Company";
import { Board } from "@/models/Board";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (!user.team) return jsonError("You are not in a team.", 400);

  const team = await Team.findById(user.team);
  if (!team) return jsonError("Team not found.", 404);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found.", 404);

  const existing = await JoinRequest.findOne({
    requester: user._id,
    kind: "quit-team",
    status: "pending",
  });
  if (existing) return jsonError("Quit request already pending.", 409);

  const assignedBoards = await Board.find({
    $or: [
      { "members.assignedTo": user._id },
      {
        members: {
          $elemMatch: {
            user: user._id,
            assignedTo: { $ne: null },
          },
        },
      },
    ],
  }, "title");
  const boardTitles = assignedBoards.map((board) => board.title).filter(Boolean);
  const assignedMessage = boardTitles.length
    ? ` and they are assigned on board${boardTitles.length > 1 ? "s" : ""} ${boardTitles.join(", ")}`
    : "";

  await JoinRequest.create({
    requester: user._id,
    approver: team.manager,
    company: user.company,
    team: user.team,
    kind: "quit-team",
  });

  await Notification.create({
    user: team.manager,
    company: user.company,
    team: user.team,
    type: "approval",
    title: "Quit Request",
    message: `${user.name}: ${user.role} is requesting to quit the ${team.name} on ${company.name}${assignedMessage}`,
  });
  emitNotification(String(team.manager));

  return NextResponse.json({ ok: true });
}
