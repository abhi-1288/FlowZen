import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { Board } from "@/models/Board";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

async function cleanupQuitterBoardAssignments(userId: any) {
  const boards = await Board.find({ "members.user": userId });
  for (const board of boards) {
    const originalCount = board.members.length;
    board.members = (board.members as any[]).filter((member) => {
      return String(member.user) !== String(userId);
    });
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

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    if (!isObjectId(id)) return jsonError("Invalid approval id.");

    const body = await request.json();
    const status = body.status === "approved" ? "approved" : "rejected";
    const force = Boolean(body.force);

    await connectDb();
    const joinRequest = await JoinRequest.findById(id);
    if (!joinRequest) return jsonError("Approval request not found.", 404);
    const requester = await User.findById(joinRequest.requester);
    if (!requester) return jsonError("Requester not found.", 404);

    let canDecide = String(joinRequest.approver) === userId;
    if (!canDecide && joinRequest.kind === "quit-company" && String(requester.role) !== "human-resource") {
      const actor = await User.findById(userId).select("role company companyStatus");
      canDecide =
        !!actor &&
        String(actor.role) === "human-resource" &&
        String(actor.companyStatus) === "approved" &&
        String(actor.company ?? "") === String(joinRequest.company);
    }
    if (!canDecide && ["company", "quit-company"].includes(String(joinRequest.kind)) && String(requester.role) === "human-resource") {
      const actor = await User.findById(userId).select("role company companyStatus");
      canDecide =
        !!actor &&
        String(actor.role) === "admin" &&
        String(actor.company ?? "") === String(joinRequest.company);
    }
    if (!canDecide) return jsonError("Forbidden", 403);
    if (joinRequest.status !== "pending") return jsonError("Approval request already processed.", 409);

    if (status === "approved" && (joinRequest.kind === "quit-company" || joinRequest.kind === "quit-team") && !force) {
      const company = await Company.findById(joinRequest.company).select("noticePeriodDays");
      const noticeDays = Math.max(0, Number(company?.noticePeriodDays ?? 0));
      if (noticeDays > 0) {
        const appliedAt = new Date(joinRequest.createdAt);
        const elapsedDays = Math.floor((Date.now() - appliedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (elapsedDays < noticeDays) {
          const remaining = noticeDays - elapsedDays;
          return jsonError(
            `Notice period pending: ${remaining} day${remaining === 1 ? "" : "s"} remaining. Use force accept to approve immediately.`,
            409,
          );
        }
      }
    }

    if (!Array.isArray(requester.membershipHistory)) requester.membershipHistory = [];
    if (!Array.isArray(requester.activeTeams)) requester.activeTeams = [];

    if (joinRequest.kind === "company") {
      requester.companyStatus = status;
      if (status === "approved") {
        await cleanupQuitterBoardAssignments(requester._id);
        requester.company = joinRequest.company;
        requester.companyJoined = new Date();
        requester.membershipHistory.push({
          company: joinRequest.company,
          inviter: joinRequest.approver,
          action: "joined-company",
          at: new Date(),
        });
        await Company.updateOne({ _id: joinRequest.company }, { $addToSet: { members: requester._id } });
      } else {
        requester.company = null;
        requester.companyJoined = null;
        requester.membershipHistory.push({
          company: joinRequest.company,
          inviter: joinRequest.approver,
          action: "removed-company",
          at: new Date(),
        });
      }
    }

    if (joinRequest.kind === "team") {
      requester.teamStatus = status;
      if (status === "approved") {
        const teamId = joinRequest.team;
        if (!teamId) return jsonError("Team is missing on join request.", 400);
        await cleanupQuitterBoardAssignments(requester._id);

        const activeTeams = requester.activeTeams;
        const alreadyInTeam = activeTeams.some(
          (existingTeamId: { toString: () => string }) =>
            existingTeamId.toString() === String(teamId),
        );
        if (!alreadyInTeam && activeTeams.length >= 2) {
          return jsonError("Employee can only join up to 2 teams.", 409);
        }

        const switching = requester.team && String(requester.team) !== String(teamId);
        requester.team = teamId;
        requester.teamJoined = new Date();
        requester.activeTeams = alreadyInTeam ? activeTeams : [...activeTeams, teamId];
        requester.membershipHistory.push({
          company: joinRequest.company,
          team: teamId,
          inviter: joinRequest.approver,
          action: switching ? "switched-team" : "joined-team",
          at: new Date(),
        });
        await Team.updateOne({ _id: teamId }, { $addToSet: { employees: requester._id } });
      } else {
        requester.team = null;
        requester.teamJoined = null;
        requester.membershipHistory.push({
          company: joinRequest.company,
          team: joinRequest.team,
          inviter: joinRequest.approver,
          action: "removed-team",
          at: new Date(),
        });
      }
    }

    if (joinRequest.kind === "quit-company") {
      if (status === "approved") {
        const activeTeamIds = Array.isArray(requester.activeTeams) ? [...requester.activeTeams] : [];

        // If they are a manager/tester, transfer managed teams when replacement is provided.
        if (["project-manager", "qa-tester"].includes(String(requester.role))) {
          if (joinRequest.replacementUser) {
            await Team.updateMany(
              { manager: requester._id },
              { $set: { manager: joinRequest.replacementUser } },
            );
          } else {
          const managedTeams = await Team.find({ manager: requester._id }).select("_id");
          const managedTeamIds = managedTeams.map((t) => t._id);

          await User.updateMany(
            { team: { $in: managedTeamIds } },
            {
              $set: { team: null, teamStatus: "none" },
              $pull: { activeTeams: { $in: managedTeamIds } },
            },
          );
          await Team.deleteMany({ manager: requester._id });
          }
        }

        // Cleanup any board assignment state when a member quits the company.
        await cleanupQuitterBoardAssignments(requester._id);

        // Remove the quitter from every team they still belong to so future joins are not blocked
        // by stale active team membership.
        const teamsToLeave = [
          ...activeTeamIds,
          ...(requester.team ? [requester.team] : []),
        ].filter(Boolean);
        if (teamsToLeave.length > 0) {
          await Team.updateMany(
            { _id: { $in: teamsToLeave } },
            { $pull: { employees: requester._id } },
          );
        }

        requester.team = null;
        requester.activeTeams = [];
        requester.teamJoined = null;
        requester.teamStatus = "none";
        requester.company = null;
        requester.companyJoined = null;
        requester.companyStatus = "none";
        
        // Clear any old pending join requests so new requests can be processed cleanly
        await JoinRequest.deleteMany({
          requester: requester._id,
          status: "pending",
          kind: { $in: ["company", "team"] }
        });
        requester.membershipHistory.push({
          company: joinRequest.company,
          action: "left-company",
          at: new Date(),
        });
        await Company.updateOne({ _id: joinRequest.company }, { $pull: { members: requester._id } });
      }
    }

    if (joinRequest.kind === "quit-team") {
      if (status === "approved") {
        const teamId = joinRequest.team;
        requester.team = null;
        requester.teamStatus = "none";
        requester.activeTeams = requester.activeTeams.filter(
          (id: { toString: () => string }) => String(id) !== String(teamId),
        );
        requester.membershipHistory.push({
          company: joinRequest.company,
          team: teamId,
          action: "left-team",
          at: new Date(),
        });
        await Team.updateOne({ _id: teamId }, { $pull: { employees: requester._id } });
        await cleanupQuitterBoardAssignments(requester._id);
        
        // Clear any old pending join requests for other teams so new requests can be processed cleanly
        await JoinRequest.deleteMany({
          requester: requester._id,
          status: "pending",
          kind: "team"
        });
      }
    }

    await requester.save();
    joinRequest.status = status;
    await joinRequest.save();

    const populatedRequest = await JoinRequest.findById(id)
      .populate("company", "name")
      .populate("team", "name");

    const companyName = (populatedRequest?.company as any)?.name ?? "company";
    const teamName = (populatedRequest?.team as any)?.name ?? "team";

    let title = status === "approved" ? "Request approved" : "Request declined";
    let message = `Your ${joinRequest.kind} join request was ${status}.`;

    if (joinRequest.kind === "quit-company") {
      title = status === "approved" ? "Quit request approved" : "Quit request rejected";
      message =
        status === "approved"
          ? `Your quit approval for ${companyName} was approved`
          : `Your request for removal from ${companyName} was rejected`;
    } else if (joinRequest.kind === "quit-team") {
      title = status === "approved" ? "Quit request approved" : "Quit request rejected";
      message =
        status === "approved"
          ? `Your quit approval for ${teamName} in ${companyName} was approved`
          : `Your request for removal of ${teamName} from ${companyName} was rejected`;
    }

    await Notification.create({
      user: requester._id,
      company: joinRequest.company,
      team: joinRequest.team,
      type: "approval",
      title,
      message,
    });
    emitNotification(String(requester._id));

    return NextResponse.json({ request: serializeDoc(joinRequest) });
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
