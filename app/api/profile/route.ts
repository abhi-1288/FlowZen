import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { createRoleJoinCode } from "@/lib/codes";
import { User } from "@/models/User";
import { Board } from "@/models/Board";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { Notification } from "@/models/Notification";
import { JoinRequest } from "@/models/JoinRequest";
import { Team } from "@/models/Team";
import { Company } from "@/models/Company";
import "@/models/Company";
import "@/models/Team";

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

  const user = await User.findById(userId)
  .populate("company")
  .populate({
    path: "team",
    populate: {
      path: "manager",
      select: "name email"
    }
  })
  .populate("membershipHistory.board", "title")
  .populate("membershipHistory.inviter", "name role")
  .populate("membershipHistory.invitee", "name role");
  if (!user) return jsonError("User not found.", 404);

  const safeRole = String(user.role);
  const insights: Record<string, unknown> = {};

  if (
    safeRole === "admin" &&
    user.company &&
    typeof user.company === "object" &&
    "joinCode" in user.company &&
    !("otherJoinCode" in user.company && user.company.otherJoinCode)
  ) {
    user.company.otherJoinCode = createRoleJoinCode(String(user.company.joinCode));
    await user.company.save();
  }

  const pendingQuitRequest = await JoinRequest.findOne({
    requester: userId,
    kind: { $in: ["quit-company", "quit-team"] },
    status: "pending",
  });
  insights.pendingQuit = !!pendingQuitRequest;

  if (safeRole === "employee" || safeRole === "others") {
    const history = Array.isArray(user.membershipHistory) ? user.membershipHistory : [];
    insights.employee = {
      removedCount: history.filter((item: { action?: string }) => item.action === "removed-team" || item.action === "removed-company").length,
      switchedCount: history.filter((item: { action?: string }) => item.action === "switched-team").length,
      activeTeams: Array.isArray(user.activeTeams) ? user.activeTeams.length : 0,
      history
    };
  }

  if (safeRole === "project-manager" || safeRole === "qa-tester") {
    const teams = await Team.find({ manager: user._id }).populate("employees", "name email").sort({ createdAt: -1 });
    for (const team of teams) {
      if (!team.otherJoinCode) {
        team.otherJoinCode = createRoleJoinCode(String(team.joinCode));
        await team.save();
      }
    }
    insights.manager = {
      teams: teams.map((team) => ({
        id: team._id.toString(),
        name: team.name,
        joinCode: team.joinCode,
        otherJoinCode: team.otherJoinCode,
        employeeCount: team.employees.length,
        employees: team.employees.map((employee: { _id: { toString: () => string }; name?: string; email?: string }) => ({
          id: employee._id.toString(),
          name: employee.name ?? "",
          email: employee.email ?? ""
        })),
        createdAt: team.createdAt
      })),
      totalTeams: teams.length
    };
  }

  if (safeRole === "admin" && user.company) {
    const teams = await Team.find({ company: user.company }).populate("manager", "name email").sort({ createdAt: -1 });
    const company = await Company.findById(user.company).select("name");
    insights.admin = {
      companyName: company?.name ?? "",
      totalTeams: teams.length,
      teams: teams.map((team) => ({
        id: team._id.toString(),
        name: team.name,
        owner: typeof team.manager === "object" && team.manager
          ? {
              name: (team.manager as { name?: string }).name ?? "",
              email: (team.manager as { email?: string }).email ?? ""
            }
          : { name: "", email: "" },
        employeeCount: Array.isArray(team.employees) ? team.employees.length : 0
      }))
    };
  }

  return NextResponse.json({ user: serializeDoc(user), insights });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < 8) return jsonError("New password must be at least 8 characters.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("+passwordHash");
  if (!user) return jsonError("User not found.", 404);
  if (user.authProvider !== "credentials") return jsonError("OAuth accounts do not have a local password.", 400);
  if (!user.passwordHash) return jsonError("No local password is set for this account.", 400);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return jsonError("Current password is incorrect.", 401);

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const ownedBoards = await Board.find({ owner: userId }).select("_id");
  const boardIds = ownedBoards.map((board) => board._id);

  await Promise.all([
    Task.deleteMany({ $or: [{ board: { $in: boardIds } }, { assignees: userId }] }),
    Column.deleteMany({ board: { $in: boardIds } }),
    Board.deleteMany({ owner: userId }),
    Board.updateMany({ "members.user": userId }, { $pull: { members: { user: userId } } }),
    Notification.deleteMany({ user: userId }),
    JoinRequest.deleteMany({ $or: [{ requester: userId }, { approver: userId }] }),
    User.deleteOne({ _id: userId })
  ]);

  return NextResponse.json({ ok: true });
}
