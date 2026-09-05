import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { stripHrInviteSuffix } from "@/lib/join-approvers";

export async function GET(request: Request) {
  const rawCode = String(new URL(request.url).searchParams.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!rawCode) return jsonError("Join code is required.");
  const { baseCode: code } = stripHrInviteSuffix(rawCode);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const userId = await requireUserId();

  if (code.startsWith("CO-")) {
    const isSuffixedCompanyCode = /^CO-.+-\d+$/.test(code);
    const baseCode = isSuffixedCompanyCode ? code.replace(/-\d+$/, "") : code;
    const company = await Company.findOne({
      $or: [
        { joinCode: code },
        { joinCode: baseCode },
        { hrJoinCode: code },
        { managerJoinCode: code },
        { testerJoinCode: code },
        { financeJoinCode: code },
        { employeeJoinCode: code },
        { otherJoinCode: code },
        { adminJoinCode: code },
        { securityJoinCode: code },
        { juniorSecurityJoinCode: code },
        { itAdminJoinCode: code },
      ]
    }).select("name joinCode hrJoinCode managerJoinCode testerJoinCode financeJoinCode employeeJoinCode otherJoinCode adminJoinCode securityJoinCode juniorSecurityJoinCode itAdminJoinCode members");
    if (!company) return jsonError("Invalid company code.", 404);
    const joinState = userId ? await getCompanyJoinState(userId, company) : { status: "available" };
    const codeInfo = companyCodeInfo(company, code, baseCode);
    return NextResponse.json({
      kind: "company",
      fromRole: codeInfo.fromRole,
      toRole: codeInfo.toRole,
      joinState,
      company: {
        id: company._id.toString(),
        name: company.name,
        joinCode: codeInfo.joinCode
      }
    });
  }

  if (code.startsWith("TM-")) {
    const isSuffixedTeamCode = /^TM-.+-\d+$/.test(code);
    const baseCode = isSuffixedTeamCode ? code.replace(/-\d+$/, "") : code;
    const team = await Team.findOne({
      $or: [{ joinCode: code }, { joinCode: baseCode }, { otherJoinCode: code }]
    })
      .select("name joinCode otherJoinCode company manager employees")
      .populate("company", "name")
      .populate("manager", "name");
    if (!team) return jsonError("Invalid team code.", 404);
    const joinState = userId ? await getTeamJoinState(userId, team) : { status: "available" };
    const isOtherCode = isSuffixedTeamCode || String(team.otherJoinCode ?? "") === code;
    const companyName =
      typeof team.company === "object" && team.company && "name" in team.company
        ? String((team.company as { name?: string }).name ?? "")
        : "";
    const managerName =
      typeof team.manager === "object" && team.manager && "name" in team.manager
        ? String((team.manager as { name?: string }).name ?? "")
        : "";
    return NextResponse.json({
      kind: "team",
      fromRole: "manager",
      toRole: isOtherCode ? "others" : "employee",
      joinState,
      company: {
        name: companyName
      },
      fromUser: {
        name: managerName
      },
      team: {
        id: team._id.toString(),
        name: team.name,
        joinCode: isOtherCode ? team.otherJoinCode : team.joinCode
      }
    });
  }

  if (code.startsWith("IT-")) {
    const ITJoiningCode = (await import("@/models/ITJoiningCode")).ITJoiningCode;
    const joinCode = await ITJoiningCode.findOne({ code })
      .populate("createdBy", "name")
      .populate("company", "name");
    if (!joinCode) return jsonError("Invalid or expired IT joining code.", 404);
    const now = new Date();
    if (joinCode.expiresAt < now || joinCode.status !== "active" || joinCode.usedCount >= joinCode.maxUses) {
      return jsonError("Invalid or expired IT joining code.", 404);
    }
    const joinState = userId ? await getItJoinState(userId, joinCode) : { status: "available" };
    const creatorName =
      typeof joinCode.createdBy === "object" && joinCode.createdBy && "name" in joinCode.createdBy
        ? String((joinCode.createdBy as { name?: string }).name ?? "")
        : "";
    const companyName =
      typeof joinCode.company === "object" && joinCode.company && "name" in joinCode.company
        ? String((joinCode.company as { name?: string }).name ?? "")
        : "";
    return NextResponse.json({
      kind: "it-join",
      fromRole: "it-admin",
      toRole: "it-administration",
      joinState,
      code: {
        id: String(joinCode._id),
        code: joinCode.code,
        intendedRole: joinCode.intendedRole,
        organization: joinCode.organization,
        expiresAt: joinCode.expiresAt,
        maxUses: joinCode.maxUses,
        usedCount: joinCode.usedCount,
        creatorName,
      },
      company: {
        name: companyName,
      },
    });
  }

  return jsonError("Invalid join code format.", 400);
}

function companyCodeInfo(company: any, code: string, baseCode: string) {
  if (String(company.adminJoinCode ?? "") === code) {
    return { fromRole: "admin", toRole: "admin", joinCode: company.adminJoinCode };
  }
  if (String(company.hrJoinCode ?? "") === code) {
    return { fromRole: "admin", toRole: "hr", joinCode: company.hrJoinCode };
  }
  if (String(company.testerJoinCode ?? "") === code) {
    return { fromRole: "hr", toRole: "tester", joinCode: company.testerJoinCode };
  }
  if (String(company.employeeJoinCode ?? "") === code) {
    return { fromRole: "hr", toRole: "employee", joinCode: company.employeeJoinCode };
  }
  if (String(company.financeJoinCode ?? "") === code) {
    return { fromRole: "hr", toRole: "finance", joinCode: company.financeJoinCode };
  }
  if (String(company.securityJoinCode ?? "") === code) {
    return { fromRole: "hr", toRole: "security", joinCode: company.securityJoinCode };
  }
  if (String(company.juniorSecurityJoinCode ?? "") === code) {
    return { fromRole: "security", toRole: "security", joinCode: company.juniorSecurityJoinCode };
  }
  if (String(company.itAdminJoinCode ?? "") === code) {
    return { fromRole: "hr", toRole: "it-admin", joinCode: company.itAdminJoinCode };
  }
  if (String(company.otherJoinCode ?? "") === code) {
    return { fromRole: "hr", toRole: "others", joinCode: company.otherJoinCode };
  }
  if (String(company.managerJoinCode ?? "") === code) {
    return { fromRole: "hr", toRole: "manager", joinCode: company.managerJoinCode };
  }
  if (String(company.joinCode ?? "") === code || String(company.joinCode ?? "") === baseCode) {
    return { fromRole: "admin", toRole: "hr", joinCode: company.joinCode };
  }
  return { fromRole: "company", toRole: "member", joinCode: code };
}

async function getCompanyJoinState(userId: string, company: any) {
  const [user, pendingRequest] = await Promise.all([
    User.findById(userId).select("company companyStatus"),
    JoinRequest.findOne({
      requester: userId,
      company: company._id,
      kind: "company",
      status: "pending"
    }).select("_id")
  ]);

  const isMember = company.members?.some((memberId: { toString: () => string }) => String(memberId) === userId);
  if (isMember || (String(user?.company ?? "") === String(company._id) && user?.companyStatus === "approved")) {
    return { status: "joined" };
  }
  if (pendingRequest || (String(user?.company ?? "") === String(company._id) && user?.companyStatus === "pending")) {
    return { status: "requested" };
  }
  return { status: "available" };
}

async function getTeamJoinState(userId: string, team: any) {
  const [user, pendingRequest] = await Promise.all([
    User.findById(userId).select("team activeTeams teamStatus"),
    JoinRequest.findOne({
      requester: userId,
      team: team._id,
      kind: "team",
      status: "pending"
    }).select("_id")
  ]);

  const isEmployee = team.employees?.some((employeeId: { toString: () => string }) => String(employeeId) === userId);
  const hasActiveTeam = user?.activeTeams?.some((teamId: { toString: () => string }) => String(teamId) === String(team._id));
  if (isEmployee || hasActiveTeam || (String(user?.team ?? "") === String(team._id) && user?.teamStatus === "approved")) {
    return { status: "joined" };
  }
  if (pendingRequest || (String(user?.team ?? "") === String(team._id) && user?.teamStatus === "pending")) {
    return { status: "requested" };
  }
  return { status: "available" };
}

async function getItJoinState(userId: string, joinCode: any) {
  const user = await User.findById(userId).select("company companyStatus");
  if (user?.company && String(user.company) === String(joinCode.company) && user.companyStatus === "approved") {
    return { status: "joined" };
  }
  if (user?.company && String(user.company) === String(joinCode.company) && user.companyStatus === "pending") {
    return { status: "requested" };
  }
  return { status: "available" };
}
