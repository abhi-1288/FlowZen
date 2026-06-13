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
import { FinanceSalary } from "@/models/FinanceSalary";
import { resolveEnrollingHr, resolveJoinedByInfo } from "@/lib/enrolling-hr";
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
    (safeRole === "employee" || safeRole === "others") &&
    !user.company &&
    !user.team &&
    user.teamStatus === "none" &&
    Array.isArray(user.activeTeams) &&
    user.activeTeams.length > 0
  ) {
    await Team.updateMany(
      { _id: { $in: user.activeTeams } },
      { $pull: { employees: user._id } },
    );
    user.activeTeams = [];
    await user.save();
  }

  if (
    safeRole === "human-resource" &&
    user.company &&
    user.companyStatus === "approved"
  ) {
    const companyId = typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
    const company = await Company.findById(companyId);
    if (company) {
      company.managerJoinCode = `${company.joinCode}-MANAGER`;
      company.testerJoinCode = `${company.joinCode}-TESTER`;
      company.financeJoinCode = `${company.joinCode}-FINANCE`;
      company.employeeJoinCode = `${company.joinCode}-EMPLOYEE`;
      if (!company.otherJoinCode) {
        company.otherJoinCode = createRoleJoinCode(String(company.joinCode));
      }
      await company.save();
      user.company = company;
    }
  }

  const pendingQuitRequest = await JoinRequest.findOne({
    requester: userId,
    kind: { $in: ["quit-company", "quit-team"] },
    status: "pending",
  });
  insights.pendingQuit = !!pendingQuitRequest;
  const pendingIdentityRequest = await JoinRequest.findOne({
    requester: userId,
    kind: "identity-code",
    status: "pending",
  }).select("_id");
  insights.pendingIdentityCodeRequest = !!pendingIdentityRequest;
  const pendingSalaryRequest = await JoinRequest.findOne({
    requester: userId,
    kind: "salary",
    status: "pending",
  }).select("_id");
  insights.pendingSalaryRequest = !!pendingSalaryRequest;
  const inApprovedCompany = Boolean(user.company && user.companyStatus === "approved");
  const userCompanyId =
    typeof user.company === "object" && user.company
      ? (user.company as any)._id
      : user.company;
  let baseSalaryValue = 0;

  if (inApprovedCompany) {
    const assignedFinanceSalary = await FinanceSalary.findOne({
      employee: userId,
      company: userCompanyId,
      $or: [{ baseSalary: { $gt: 0 } }, { netSalary: { $gt: 0 } }],
    })
      .sort({ updatedAt: -1 })
      .select("baseSalary netSalary");
    const financeSalaryAmount = Math.max(
      0,
      Number(assignedFinanceSalary?.baseSalary ?? assignedFinanceSalary?.netSalary ?? 0),
    );
    baseSalaryValue = Math.max(financeSalaryAmount, Math.max(0, Number(user.baseSalary ?? 0)));
  } else if (Number(user.baseSalary ?? 0) > 0) {
    user.baseSalary = 0;
    await user.save();
  }

  insights.hasSalary = inApprovedCompany && baseSalaryValue > 0;
  insights.baseSalary = inApprovedCompany ? baseSalaryValue : 0;

  if (inApprovedCompany && !["human-resource", "admin"].includes(safeRole)) {
    insights.enrolledByHr = await resolveEnrollingHr(user);
    insights.joinedBy = await resolveJoinedByInfo(user);
  }
  if (user.company) {
    const companyDoc = await Company.findById(userCompanyId).select("noticePeriodDays");
    const noticeDays = Number(companyDoc?.noticePeriodDays ?? 0);
    insights.noticePeriodDays = noticeDays;
    if (pendingQuitRequest) {
      const elapsedDays = Math.max(
        0,
        Math.floor((Date.now() - new Date(pendingQuitRequest.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      );
      insights.pendingQuitNotice = {
        noticeDays,
        elapsedDays,
        remainingDays: Math.max(0, noticeDays - elapsedDays),
      };
    }
  }

  if (user.company && user.companyStatus === "approved") {
    const companyMembers = await User.find({ company: userCompanyId, companyStatus: "approved" })
      .select("name email role customRole")
      .sort({ role: 1, name: 1 });
    insights.companyMembers = companyMembers.map((member) => ({
      id: String(member._id),
      name: member.name ?? "",
      email: member.email ?? "",
      role: member.role ?? "employee",
      customRole: member.customRole ?? "",
    }));
  }

  if (safeRole === "employee" || safeRole === "finance" || safeRole === "others") {
    const history = Array.isArray(user.membershipHistory) ? user.membershipHistory : [];
    insights.employee = {
      removedCount: history.filter((item: { action?: string }) => item.action === "removed-team" || item.action === "removed-company").length,
      switchedCount: history.filter((item: { action?: string }) => item.action === "switched-team").length,
      activeTeams: Array.isArray(user.activeTeams) ? user.activeTeams.length : 0,
      history
    };
  }

  if (["project-manager", "qa-tester", "human-resource", "finance", "admin"].includes(safeRole)) {
    const teams = await Team.find({ manager: user._id }).populate("employees", "name email").sort({ createdAt: -1 });
    for (const team of teams) {
      if (!team.otherJoinCode) {
        team.otherJoinCode = createRoleJoinCode(String(team.joinCode));
        await team.save();
      }
    }
    const createdTeamsCount = await Team.countDocuments({ createdBy: user._id });
    insights.manager = {
      teams: teams.map((team) => ({
        id: team._id.toString(),
        name: team.name,
        createdBy: user.name,
        createdByRole: ({ "human-resource": "Human Resource", "project-manager": "Project Manager", "qa-tester": "Q-A Tester", finance: "Finance", employee: "Employee", admin: "Admin", others: "Others" } as Record<string, string>)[String(user.role ?? "")] ?? String(user.role ?? ""),
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
      totalTeams: teams.length,
      createdTeamsCount
    };
  }

  if (["human-resource", "finance", "admin"].includes(safeRole) && user.company && user.companyStatus === "approved") {
    const companyId = typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
    const [members, teams] = await Promise.all([
      User.find({ company: companyId, companyStatus: "approved" })
        .select("name email role customRole team teamStatus activeTeams membershipHistory companyJoined createdAt baseSalary")
        .populate("membershipHistory.inviter", "name role")
        .sort({ role: 1, name: 1 }),
      Team.find({ company: companyId }).select("name manager employees"),
    ]);

    const teamNamesByMember = new Map<string, string[]>();
    teams.forEach((team: any) => {
      const managerId = String(team.manager ?? "");
      if (managerId) {
        teamNamesByMember.set(managerId, [...(teamNamesByMember.get(managerId) ?? []), String(team.name)]);
      }
      (team.employees ?? []).forEach((employeeId: any) => {
        const id = String(employeeId);
        teamNamesByMember.set(id, [...(teamNamesByMember.get(id) ?? []), String(team.name)]);
      });
    });

    insights.hr = {
      totalMembers: members.length,
      roleCounts: members.reduce((counts: Record<string, number>, member: any) => {
        const role = String(member.role ?? "employee");
        counts[role] = (counts[role] ?? 0) + 1;
        return counts;
      }, {}),
      members: members.map((member: any) => {
        const teamNames = teamNamesByMember.get(String(member._id)) ?? [];
        const history = Array.isArray(member.membershipHistory) ? member.membershipHistory : [];
        const lastJoin = [...history].reverse().find((entry: any) => String(entry?.action ?? "") === "joined-company");
        const inviter =
          lastJoin && lastJoin.inviter && typeof lastJoin.inviter === "object" && "name" in lastJoin.inviter
            ? {
                name: String((lastJoin.inviter as any).name ?? ""),
                role: String((lastJoin.inviter as any).role ?? ""),
              }
            : null;
        return {
          id: String(member._id),
          name: member.name ?? "",
          email: member.email ?? "",
          role: member.role ?? "employee",
          customRole: member.customRole ?? "",
          baseSalary: Math.max(0, Number(member.baseSalary ?? 0)),
          teamStatus: member.teamStatus ?? "none",
          teams: teamNames,
          hasTeam: teamNames.length > 0,
          joinedBy: inviter,
          createdAt: member.createdAt,
          companyJoined: member.companyJoined,
        };
      }),
    };
  }

  if (safeRole === "admin" && user.company && user.companyStatus === "approved") {
    const company = await Company.findById(userCompanyId);
    if (company && !company.adminJoinCode) {
      company.adminJoinCode = createRoleJoinCode(String(company.joinCode));
      await company.save();
    }
  }

  if (safeRole === "admin" && user.company) {
    const teams = await Team.find({ company: userCompanyId }).populate("manager", "name email role").populate("employees", "name email").sort({ createdAt: -1 });
    const company = await Company.findById(userCompanyId).select("name");
    const ownerRoleMap: Record<string, string> = {
      "human-resource": "Human Resource",
      "project-manager": "Project Manager",
      "qa-tester": "Q-A Tester",
      finance: "Finance",
      employee: "Employee",
      admin: "Admin",
      others: "Others",
    };
    insights.admin = {
      companyName: company?.name ?? "",
      totalTeams: teams.length,
      teams: teams.map((team) => {
        const mgr = typeof team.manager === "object" && team.manager ? (team.manager as { _id?: unknown; name?: string; email?: string; role?: string }) : null;
        return {
          id: team._id.toString(),
          name: team.name,
          owner: mgr
            ? {
                name: mgr.name ?? "",
                email: mgr.email ?? ""
              }
            : { name: "", email: "" },
          managerId: mgr ? String((team.manager as any)._id ?? "") : "",
          createdBy: mgr?.name ?? "",
          createdByRole: mgr?.role ? (ownerRoleMap[mgr.role] ?? mgr.role) : "",
          employeeCount: Array.isArray(team.employees) ? team.employees.length : 0,
          employees: Array.isArray(team.employees) ? team.employees.map((emp: { _id: { toString: () => string }; name?: string; email?: string }) => ({
            id: emp._id.toString(),
            name: emp.name ?? "",
            email: emp.email ?? ""
          })) : []
        };
      })
    };
  }

  const serializedUser = serializeDoc(user);
  serializedUser.baseSalary = baseSalaryValue;

  return NextResponse.json({ user: serializedUser, insights });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("+passwordHash");
  if (!user) return jsonError("User not found.", 404);

  const newRole = String(body.role ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (newRole && user.role === "others") {
    if (user.authProvider !== "credentials" && !user.emailVerified) {
      return jsonError("Please verify your email with OTP before setting a role.", 400);
    }
    const validRoles = ["employee", "project-manager", "qa-tester", "human-resource", "finance", "admin"];
    if (!validRoles.includes(newRole)) return jsonError("Invalid role.", 400);
    user.role = newRole;
    if (newPassword.length >= 8) {
      user.passwordHash = await bcrypt.hash(newPassword, 12);
      user.passwordResetRequired = false;
    }
    await user.save();
    return NextResponse.json({ ok: true, role: user.role });
  }

  const currentPassword = String(body.currentPassword ?? "");
  if (newPassword.length < 8) return jsonError("New password must be at least 8 characters.");

  if (user.authProvider !== "credentials") return jsonError("OAuth accounts do not have a local password.", 400);
  if (!user.passwordHash) return jsonError("No local password is set for this account.", 400);

  if (!user.passwordResetRequired) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return jsonError("Current password is incorrect.", 401);
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetRequired = false;
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
