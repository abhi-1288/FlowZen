import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    if (!isObjectId(id)) return jsonError("Invalid approval id.");

    const body = await request.json();
    const status = body.status === "approved" ? "approved" : "rejected";

    await connectDb();
    const joinRequest = await JoinRequest.findById(id);
    if (!joinRequest) return jsonError("Approval request not found.", 404);
    if (String(joinRequest.approver) !== userId) return jsonError("Forbidden", 403);
    if (joinRequest.status !== "pending") return jsonError("Approval request already processed.", 409);

    const requester = await User.findById(joinRequest.requester);
    if (!requester) return jsonError("Requester not found.", 404);
    if (!Array.isArray(requester.membershipHistory)) requester.membershipHistory = [];
    if (!Array.isArray(requester.activeTeams)) requester.activeTeams = [];

    if (joinRequest.kind === "company") {
      requester.companyStatus = status;
      if (status === "approved") {
        requester.company = joinRequest.company;
        requester.companyJoined = new Date();
        requester.membershipHistory.push({
          company: joinRequest.company,
          action: "joined-company",
          at: new Date(),
        });
        await Company.updateOne({ _id: joinRequest.company }, { $addToSet: { members: requester._id } });
      } else {
        requester.company = null;
        requester.companyJoined = null;
        requester.membershipHistory.push({
          company: joinRequest.company,
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
          action: "removed-team",
          at: new Date(),
        });
      }
    }

    if (joinRequest.kind === "quit-company") {
      if (status === "approved") {
        // If they are a manager/tester, delete their managed teams (as in original api/company/quit)
        if (["project-manager", "qa-tester"].includes(String(requester.role))) {
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

        // Remove from team if any
        if (requester.team) {
          await Team.updateOne({ _id: requester.team }, { $pull: { employees: requester._id } });
        }
        requester.team = null;
        requester.teamStatus = "none";
        requester.company = null;
        requester.companyStatus = "none";
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
