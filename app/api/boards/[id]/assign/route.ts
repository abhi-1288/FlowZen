import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitNotification } from "@/lib/realtime";
import { emitToBoard } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };

function boardRoleFromUserRole(role: string) {
  if (role === "project-manager") return "manager";
  if (role === "qa-tester") return "tester";
  if (role === "finance") return "finance";
  if (role === "human-resource") return "hr";
  if (role === "other") return "others";
  return ["admin", "employee", "others"].includes(role) ? role : "employee";
}

function userSummary(user: any) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  await connectDb();
  const [board, caller] = await Promise.all([
    Board.findOne({ _id: id, "members.user": userId }),
    User.findById(userId),
  ]);
  if (!board) return jsonError("Board not found.", 404);
  if (!caller) return jsonError("User not found.", 404);

  const isOwner = String(board.owner) === userId;
  const _callerMember = (board.members as any[]).find((member) => String(member.user) === userId);

  if (isOwner && caller.role === "admin" && caller.company) {
    const [managers, testers, finance, hr] = await Promise.all([
      User.find({ company: caller.company, companyStatus: "approved", role: "project-manager" }).sort({ name: 1 }),
      User.find({ company: caller.company, companyStatus: "approved", role: "qa-tester" }).sort({ name: 1 }),
      User.find({ company: caller.company, companyStatus: "approved", role: "finance" }).sort({ name: 1 }),
      User.find({ company: caller.company, companyStatus: "approved", role: "human-resource" }).sort({ name: 1 }),
    ]);

    const teams = await Team.find({ company: caller.company }).populate("employees", "name email role teamStatus").sort({ name: 1 });

    return NextResponse.json({
      managers: managers.map(userSummary),
      testers: testers.map(userSummary),
      finance: finance.map(userSummary),
      hr: hr.map(userSummary),
      employees: [],
      teams: teams.map((team: any) => {
        const approvedEmployees = (team.employees ?? []).filter((e: any) => e.teamStatus === "approved");
        return {
          id: String(team._id),
          name: team.name,
          employeeCount: approvedEmployees.length,
          employeeIds: approvedEmployees.map((e: any) => String(e._id)),
          employees: approvedEmployees.map((e: any) => ({
            id: String(e._id),
            name: e.name,
            email: e.email,
            role: e.role,
          })),
        };
      }),
    });
  }

  const teams = caller.company
    ? await Team.find({ company: caller.company }).populate("employees", "name email role teamStatus").sort({ name: 1 })
    : [];

  return NextResponse.json({
    managers: [],
    testers: [],
    employees: [],
    teams: teams.map((team: any) => {
      const approvedEmployees = (team.employees ?? []).filter((e: any) => e.teamStatus === "approved");
      return {
        id: String(team._id),
        name: team.name,
        employeeCount: approvedEmployees.length,
        employeeIds: approvedEmployees.map((e: any) => String(e._id)),
        employees: approvedEmployees.map((e: any) => ({
          id: String(e._id),
          name: e.name,
          email: e.email,
          role: e.role,
        })),
      };
    }),
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const memberId = String(body.memberId ?? "");
  const teamId = String(body.teamId ?? "");
  const leadId = String(body.leadId ?? "");

  await connectDb();
  const [board, caller] = await Promise.all([
    Board.findOne({ _id: id, "members.user": userId }),
    User.findById(userId),
  ]);
  if (!board) return jsonError("Board not found.", 404);
  if (!caller) return jsonError("User not found.", 404);

  const members = board.members as any[];
  const callerMember = members.find((item) => String(item.user) === userId);
  const isOwner = String(board.owner) === userId;
  const isAdminOwner = isOwner && caller.role === "admin";

  if (!isAdminOwner && !["manager", "tester"].includes(String(callerMember?.role))) {
    return jsonError("Only admins or assigned managers/testers can assign project members.", 403);
  }

  if (teamId) {
    if (!isObjectId(teamId)) return jsonError("Invalid team id.");
    const team = await Team.findOne({ _id: teamId, manager: userId }).populate("employees");
    if (!team) return jsonError("Team not found or you are not its manager.", 404);

    const newlyAssigned: string[] = [];
    for (const emp of team.employees as any[]) {
      if (emp.teamStatus !== "approved") continue;
      if (String(board.owner) === String(emp._id)) continue;

      let member = members.find((m) => String(m.user) === String(emp._id));
      if (!member) {
        members.push({
          user: emp._id,
          role: boardRoleFromUserRole(String(emp.role)),
          assignedTo: userId,
        });
      } else {
        member.assignedTo = userId;
      }
      newlyAssigned.push(String(emp._id));
    }
    await board.save();

    if (newlyAssigned.length) {
      await Promise.all(
        newlyAssigned.map((uid) =>
          Notification.create({
            user: uid,
            board: board._id,
            title: "Board assignment",
            message: `${caller.name}: ${caller.role} has assigned you to ${board.title}.`,
          })
        )
      );
      newlyAssigned.forEach((uid) => emitNotification(uid));
    }
  } else if (memberId) {
    if (!isObjectId(memberId)) return jsonError("Invalid member id.");
    if (leadId && !isObjectId(leadId)) return jsonError("Invalid lead id.");
    if (memberId === leadId) return jsonError("A member cannot be assigned to themselves.");

    const targetUser = await User.findById(memberId);
    if (!targetUser) return jsonError("Member user not found.", 404);
    if (String(board.owner) === memberId) return jsonError("The board owner cannot be assigned under another member.");

    if (isAdminOwner) {
      if (!caller.company || String(targetUser.company) !== String(caller.company) || targetUser.companyStatus !== "approved") {
        return jsonError("You can only assign approved members from your company.", 403);
      }
    } else {
      const managedTeams = await Team.find({ manager: userId, employees: targetUser._id }).select("_id");
      if (!managedTeams.length || !["employee", "others"].includes(String(targetUser.role))) {
        return jsonError("Managers and testers can only assign approved employees from their own teams.", 403);
      }
      if (targetUser.teamStatus !== "approved") return jsonError("Employee team membership is not approved.", 403);
    }

    let member = members.find((item) => String(item.user) === memberId);
    if (!member) {
      members.push({
        user: targetUser._id,
        role: boardRoleFromUserRole(String(targetUser.role)),
        assignedTo: null,
      });
      member = members[members.length - 1];
    }

    if (leadId) {
      const lead = members.find((item) => String(item.user) === leadId);
      if (!lead) return jsonError("Lead is not on this board.", 404);
      if (!["manager", "tester"].includes(String(lead.role))) {
        return jsonError("Employees can only be assigned to managers or testers.");
      }
      if (!isAdminOwner && leadId !== userId) return jsonError("You can only assign employees under yourself.", 403);
    }

    member.role = boardRoleFromUserRole(String(targetUser.role));
    member.assignedTo = leadId || (!isAdminOwner ? userId : null);
    await board.save();

    await Notification.create({
      user: targetUser._id,
      board: board._id,
      title: "Board assignment",
      message: `${caller.name}: ${caller.role} has assigned you to ${board.title}.`,
    });
    emitNotification(String(targetUser._id));
  } else {
    return jsonError("Member ID or Team ID is required.", 400);
  }

  emitToBoard(board, "board:update", { id: String(board._id) });

  const freshBoard = await Board.findById(id)
    .populate("members.user", "name email")
    .populate("members.assignedTo", "name email");
  if (!freshBoard) return jsonError("Board not found.", 404);

  return NextResponse.json({ board: serializeDoc(freshBoard) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const teamId = String(body.teamId ?? "");
  if (!teamId || !isObjectId(teamId)) return jsonError("Team ID is required.");

  await connectDb();
  const [board, caller] = await Promise.all([
    Board.findOne({ _id: id, "members.user": userId }),
    User.findById(userId),
  ]);
  if (!board) return jsonError("Board not found.", 404);
  if (!caller) return jsonError("User not found.", 404);

  const team = await Team.findOne({ _id: teamId, manager: userId }).populate("employees");
  if (!team) return jsonError("Team not found or you are not its manager.", 404);

  const employeeIds = new Set((team.employees as any[]).map((e) => String(e._id)));
  const removedIds: string[] = [];
  board.members = (board.members as any[]).filter((m) => {
    const mId = String(m.user);
    if (employeeIds.has(mId) && String(m.assignedTo) === userId) {
      removedIds.push(mId);
      return false;
    }
    return true;
  });

  await board.save();

  if (removedIds.length) {
    await Promise.all(
      removedIds.map((uid) =>
        Notification.create({
          user: uid,
          board: board._id,
          title: "Board access removed",
          message: `${caller.name}: ${caller.role} has removed you from ${board.title}.`,
        })
      )
    );
    removedIds.forEach((uid) => emitNotification(uid));
  }

  emitToBoard(board, "board:update", { id: String(board._id) });

  const freshBoard = await Board.findById(id)
    .populate("members.user", "name email")
    .populate("members.assignedTo", "name email");

  return NextResponse.json({ board: serializeDoc(freshBoard) });
}

