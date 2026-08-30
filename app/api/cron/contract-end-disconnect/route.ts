import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function cleanupBoardsForUser(userId: any) {
  const boards = await Board.find({ "members.user": userId });
  for (const board of boards) {
    const originalCount = board.members.length;
    board.members = (board.members as any[]).filter(
      (member) => String(member.user) !== String(userId),
    );
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

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();

  const now = startOfDay(new Date());

  const members = await User.find({
    company: { $ne: null },
    companyStatus: "approved",
    employmentEndDate: { $ne: null, $lte: now },
  }).select(
    "name role company employmentEndDate durationMonths durationDays durationHours durationYears activeTeams team membershipHistory",
  );

  const disconnected: string[] = [];

  for (const member of members as any[]) {
    if (!member.employmentEndDate) continue;
    if (!member.company) continue;

    const byHours = Number(member.durationHours ?? 0) > 0;
    const byDays = Number(member.durationDays ?? 0) > 0;

    // Only auto-disconnect for day/hour based contracts (confirmed scope).
    if (!byHours && !byDays) continue;

    const graceDays = byHours ? 1 : 2;
    const cutoff = addDays(new Date(member.employmentEndDate), graceDays);
    if (now < cutoff) continue;

    const companyId = member.company;
    const company = await Company.findById(companyId).select("name owner");

    if (!member.membershipHistory) member.membershipHistory = [];

    // Managed teams (same rules as fire / quit-company approval).
    if (["project-manager", "qa-tester"].includes(String(member.role))) {
      const managedTeams = await Team.find({ manager: member._id }).select("_id");
      const managedTeamIds = managedTeams.map((t) => t._id);
      if (managedTeamIds.length) {
        await User.updateMany(
          { team: { $in: managedTeamIds } },
          { $set: { team: null, teamStatus: "none" }, $pull: { activeTeams: { $in: managedTeamIds } } },
        );
        await Team.deleteMany({ manager: member._id });
      }
    }

    await cleanupBoardsForUser(member._id);

    const allTeamIds = [
      ...(Array.isArray(member.activeTeams) ? member.activeTeams : []),
      ...(member.team ? [member.team] : []),
    ].filter(Boolean);
    if (allTeamIds.length) {
      await Team.updateMany({ _id: { $in: allTeamIds } }, { $pull: { employees: member._id } });
    }

    await JoinRequest.deleteMany({ requester: member._id, status: "pending" });

    member.membershipHistory.push({
      company: companyId,
      action: "contract-expired",
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
    member.hourlyRate = 0;
    member.dailyRate = 0;
    member.companyIdentityCode = undefined;
    await member.save();

    await Company.updateOne({ _id: companyId }, { $pull: { members: member._id } });

    await Notification.create({
      user: member._id,
      company: companyId,
      type: "system",
      title: "Contract ended",
      message: `Your ${byHours ? "hour" : "day"}-based contract with ${String(company?.name ?? "the company")} has ended and you have been disconnected from the company.`,
      body: `Your ${byHours ? "hour" : "day"}-based contract with ${String(company?.name ?? "the company")} has ended and you have been disconnected from the company.`,
    });
    emitNotification(String(member._id));

    disconnected.push(String(member._id));
  }

  return NextResponse.json({ ok: true, disconnected });
}
