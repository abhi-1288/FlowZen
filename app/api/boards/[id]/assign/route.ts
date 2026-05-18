import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

function boardRoleFromUserRole(role: string) {
  if (role === "project-manager") return "manager";
  if (role === "qa-tester") return "tester";
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
  if (isOwner && caller.role === "admin" && caller.company) {
    const [managers, testers] = await Promise.all([
      User.find({ company: caller.company, companyStatus: "approved", role: "project-manager" }).sort({ name: 1 }),
      User.find({ company: caller.company, companyStatus: "approved", role: "qa-tester" }).sort({ name: 1 }),
    ]);

    return NextResponse.json({
      managers: managers.map(userSummary),
      testers: testers.map(userSummary),
      employees: [],
      teams: [],
    });
  }

  const callerMember = (board.members as any[]).find((member) => String(member.user) === userId);
  if (!["manager", "tester"].includes(String(callerMember?.role))) {
    return NextResponse.json({ managers: [], testers: [], employees: [], teams: [] });
  }

  const teams = await Team.find({ manager: userId }).populate("employees", "name email role teamStatus").sort({ name: 1 });
  
  return NextResponse.json({
    managers: [],
    testers: [],
    employees: [],
    teams: teams.map((team: any) => ({
      id: String(team._id),
      name: team.name,
      employeeCount: (team.employees ?? []).filter((e: any) => e.teamStatus === "approved").length,
      employeeIds: (team.employees ?? []).filter((e: any) => e.teamStatus === "approved").map((e: any) => String(e._id)),
    })),
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

    const at = new Date();
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
    }
    await board.save();
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
  } else {
    return jsonError("Member ID or Team ID is required.", 400);
  }

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
  const board = await Board.findOne({ _id: id, "members.user": userId });
  if (!board) return jsonError("Board not found.", 404);

  const team = await Team.findOne({ _id: teamId, manager: userId }).populate("employees");
  if (!team) return jsonError("Team not found or you are not its manager.", 404);

  const employeeIds = new Set((team.employees as any[]).map((e) => String(e._id)));
  board.members = (board.members as any[]).filter((m) => {
    const mId = String(m.user);
    // Remove if user is in team AND was assigned under this caller
    if (employeeIds.has(mId) && String(m.assignedTo) === userId) return false;
    return true;
  });

  await board.save();

  const freshBoard = await Board.findById(id)
    .populate("members.user", "name email")
    .populate("members.assignedTo", "name email");

  return NextResponse.json({ board: serializeDoc(freshBoard) });
}

