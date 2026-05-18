import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Team } from "@/models/Team";
import { User } from "@/models/User";

export async function GET(request: Request) {
  const code = String(new URL(request.url).searchParams.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return jsonError("Join code is required.");

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
      $or: [{ joinCode: code }, { joinCode: baseCode }, { otherJoinCode: code }]
    }).select("name joinCode otherJoinCode members");
    if (!company) return jsonError("Invalid company code.", 404);
    const joinState = userId ? await getCompanyJoinState(userId, company) : { status: "available" };
    const isOtherCode = isSuffixedCompanyCode || String(company.otherJoinCode ?? "") === code;
    return NextResponse.json({
      kind: "company",
      fromRole: "admin",
      toRole: isOtherCode ? "others" : "manager",
      joinState,
      company: {
        id: company._id.toString(),
        name: company.name,
        joinCode: isOtherCode ? company.otherJoinCode : company.joinCode
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

  return jsonError("Invalid join code format.", 400);
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
