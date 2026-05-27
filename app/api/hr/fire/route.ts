import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { Board } from "@/models/Board";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

async function cleanupBoardsForUser(userId: any) {
  const boards = await Board.find({ "members.user": userId });
  for (const board of boards) {
    const originalCount = board.members.length;
    board.members = (board.members as any[]).filter((member) => String(member.user) !== String(userId));
    if (board.members.length !== originalCount) {
      await board.save();
    }
  }

  await Board.updateMany(
    { "members.assignedTo": userId },
    { $set: { "members.$[m].assignedTo": null } },
    { arrayFilters: [{ "m.assignedTo": userId }] },
  );
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const memberId = String((body as any).memberId ?? "");
  if (!isObjectId(memberId)) return jsonError("Invalid member id.", 400);
  if (memberId === userId) return jsonError("You cannot fire yourself.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [hr, member] = await Promise.all([User.findById(userId), User.findById(memberId)]);
  if (!hr) return jsonError("User not found.", 404);
  if (!member) return jsonError("Member not found.", 404);

  if (!["human-resource", "admin"].includes(String(hr.role)) || hr.companyStatus !== "approved" || !hr.company) {
    return jsonError("Only approved HR or admins can fire members.", 403);
  }

  if (String(member.company ?? "") !== String(hr.company) || member.companyStatus !== "approved") {
    return jsonError("You can only fire approved members in your company.", 403);
  }

  const company = await Company.findById(hr.company);
  if (!company) return jsonError("Company not found.", 404);
  if (String(company.owner) === String(member._id)) {
    return jsonError("You cannot fire the company owner.", 403);
  }
  if (String(member.role ?? "") === "admin") {
    return jsonError("You cannot fire an admin.", 403);
  }

  // If they are a manager/tester, delete their managed teams (same rules as quit-company approval).
  if (["project-manager", "qa-tester"].includes(String(member.role))) {
    const managedTeams = await Team.find({ manager: member._id }).select("_id");
    const managedTeamIds = managedTeams.map((t) => t._id);

    if (managedTeamIds.length) {
      await User.updateMany(
        { team: { $in: managedTeamIds } },
        {
          $set: { team: null, teamStatus: "none" },
          $pull: { activeTeams: { $in: managedTeamIds } },
        },
      );
      await Team.deleteMany({ manager: member._id });
    }
  }

  // Remove from any teams (employees list) and clear board assignments/membership.
  await cleanupBoardsForUser(member._id);

  const allTeamIds = [
    ...(Array.isArray(member.activeTeams) ? member.activeTeams : []),
    ...(member.team ? [member.team] : []),
  ].filter(Boolean);

  if (allTeamIds.length) {
    await Team.updateMany({ _id: { $in: allTeamIds } }, { $pull: { employees: member._id } });
  }

  // Clear pending join requests so future joins are clean.
  await JoinRequest.deleteMany({ requester: member._id, status: "pending" });

  // Update member record.
  if (!Array.isArray(member.membershipHistory)) member.membershipHistory = [];
  member.membershipHistory.push({
    company: member.company,
    inviter: hr._id,
    action: "removed-company",
    at: new Date(),
  });

  member.team = null;
  member.activeTeams = [];
  member.teamJoined = null;
  member.teamStatus = "none";
  member.company = null;
  member.companyJoined = null;
  member.companyStatus = "none";
  member.baseSalary = 0;
  member.companyIdentityCode = undefined;
  await member.save();

  await Company.updateOne({ _id: company._id }, { $pull: { members: member._id } });

  // Notify the fired user.
  await Notification.create({
    user: member._id,
    company: company._id,
    type: "system",
    title: "Removed from company",
    message: `You were removed from ${String(company.name ?? "your company")} by ${String(hr.role) === "admin" ? "admin" : "HR"}.${String(hr.name ?? "") ? ` (${String(hr.name)})` : ""}`,
    body: `You were removed from ${String(company.name ?? "your company")} by ${String(hr.role) === "admin" ? "admin" : "HR"}.${String(hr.name ?? "") ? ` (${String(hr.name)})` : ""}`,
  });
  emitNotification(String(member._id));

  return NextResponse.json({ ok: true });
}
