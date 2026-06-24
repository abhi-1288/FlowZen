import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { Board } from "@/models/Board";
import { User } from "@/models/User";
import { Task } from "@/models/Task";
import { emitNotification } from "@/lib/realtime";
import { ensureCompanyIdentityCode } from "@/lib/company-identity";

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

async function transferQuitterBoardAssignments(userId: any, replacementUserId: any) {
  const assignedBoards = await Board.find({
    $or: [
      { "members.assignedTo": userId },
      {
        members: {
          $elemMatch: {
            user: userId,
            $or: [
              { assignedTo: { $ne: null } },
              { role: { $in: ["manager", "tester"] } }
            ]
          },
        },
      },
    ],
  });

  for (const board of assignedBoards) {
    let changed = false;

    if (String(board.owner) === String(userId)) {
      board.owner = replacementUserId;
      changed = true;
    }

    board.members.forEach((m: any) => {
      if (String(m.assignedTo) === String(userId)) {
        m.assignedTo = replacementUserId;
        changed = true;
      }
    });

    const memberIndex = board.members.findIndex((m: any) => String(m.user) === String(userId));
    if (memberIndex !== -1) {
      const existingReplacementIndex = board.members.findIndex((m: any) => String(m.user) === String(replacementUserId));
      
      if (existingReplacementIndex !== -1 && existingReplacementIndex !== memberIndex) {
        board.members.splice(existingReplacementIndex, 1);
        const updatedMemberIndex = board.members.findIndex((m: any) => String(m.user) === String(userId));
        if (updatedMemberIndex !== -1) {
          board.members[updatedMemberIndex].user = replacementUserId;
        }
      } else {
        board.members[memberIndex].user = replacementUserId;
      }
      changed = true;
    }

    if (changed) {
      board.markModified("members");
      board.markModified("owner");
      await board.save();
    }
  }

  const tasks = await Task.find({
    $or: [
      { assignees: userId },
      { takenBy: userId },
      { takenLead: userId }
    ]
  });

  for (const task of tasks) {
    let taskChanged = false;
    
    if (task.assignees && task.assignees.some((id: any) => String(id) === String(userId))) {
      task.assignees = task.assignees.map((id: any) => String(id) === String(userId) ? replacementUserId : id);
      taskChanged = true;
    }
    
    if (String(task.takenBy) === String(userId)) {
      task.takenBy = replacementUserId;
      const replacement = await User.findById(replacementUserId).select("name");
      if (replacement) task.takenByName = replacement.name;
      taskChanged = true;
    }
    
    if (String(task.takenLead) === String(userId)) {
      task.takenLead = replacementUserId;
      const replacement = await User.findById(replacementUserId).select("name");
      if (replacement) task.takenLeadName = replacement.name;
      taskChanged = true;
    }

    if (taskChanged) {
      await task.save();
    }
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    if (!isObjectId(id)) return jsonError("Invalid approval id.");

    const body = await request.json();
    const validStatuses = ["approved", "hr-approved", "rejected"];
    let status = validStatuses.includes(body.status) ? body.status : "rejected";
    const force = Boolean(body.force);
    const rejectionReason = String(body.reason ?? "").trim();

    await connectDb();
    const joinRequest = await JoinRequest.findById(id);
    if (!joinRequest) return jsonError("Approval request not found.", 404);
    
    // Auto-map frontend 'approved' to 'hr-approved' for the first step of salary-increment
    if (status === "approved" && joinRequest.kind === "salary-increment" && joinRequest.status === "pending") {
      status = "hr-approved";
    }
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
    if (!canDecide && joinRequest.kind === "company" && String(requester.role) === "admin") {
      const actor = await User.findById(userId).select("role company companyStatus");
      canDecide =
        !!actor &&
        String(actor.role) === "admin" &&
        String(actor.company ?? "") === String(joinRequest.company);
    }
    if (!canDecide) return jsonError("Forbidden", 403);
    if (!["pending", "hr-approved"].includes(joinRequest.status)) return jsonError("Approval request already processed.", 409);

    if (status !== "rejected" && joinRequest.company) {
      const frozenCheck = await Company.findById(joinRequest.company).select("status");
      if (frozenCheck?.status === "frozen") {
        return jsonError("Company is frozen. No approvals can be processed.", 409);
      }
    }

    if (status === "approved" && joinRequest.kind === "quit-company") {
      if (["project-manager", "qa-tester"].includes(String(requester.role ?? "")) && joinRequest.replacementUser) {
        const pendingBoardTransfer = await JoinRequest.findOne({
          requester: joinRequest.requester,
          company: joinRequest.company,
          kind: "quit-company-board-transfer",
          status: "pending",
        });
        if (pendingBoardTransfer) {
          return jsonError("Board transfer approval is still pending from admin.", 409);
        }
      }
    }

    if (status === "approved" && joinRequest.kind === "quit-company" && !force) {
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
        const salaryAmount = Math.max(0, Number(body.salaryAmount ?? 0));
        await cleanupQuitterBoardAssignments(requester._id);
        requester.company = joinRequest.company;
        requester.companyJoined = new Date();
        requester.baseSalary = salaryAmount;
        if (salaryAmount > 0) {
          if (!Array.isArray(requester.salaryHistory)) requester.salaryHistory = [];
          requester.salaryHistory.push({
            amount: salaryAmount,
            date: new Date(),
            type: "increment",
          });
        }
        await ensureCompanyIdentityCode(requester, joinRequest.company);
        const approver = await User.findById(joinRequest.approver).select("role");
        const meta = (joinRequest.metadata ?? {}) as { enrollingHrId?: unknown };
        let historyInviterId = joinRequest.approver;
        if (meta.enrollingHrId) {
          const enrollingHr = await User.findOne({
            _id: meta.enrollingHrId,
            company: joinRequest.company,
            role: "human-resource",
            companyStatus: "approved",
          }).select("_id");
          if (enrollingHr) historyInviterId = enrollingHr._id;
        } else {
          const approverDoc = await User.findById(joinRequest.approver).select("role");
          if (String(approverDoc?.role ?? "") !== "human-resource") {
            const fallbackHr = await User.findOne({
              company: joinRequest.company,
              role: "human-resource",
              companyStatus: "approved",
            })
              .select("_id")
              .sort({ createdAt: 1 });
            if (fallbackHr) historyInviterId = fallbackHr._id;
          }
        }
        requester.membershipHistory.push({
          company: joinRequest.company,
          inviter: historyInviterId,
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

    if (joinRequest.kind === "identity-code") {
      if (status === "approved") {
        if (String(requester.company ?? "") !== String(joinRequest.company)) {
          return jsonError("Requester is not in this company.", 409);
        }
        await ensureCompanyIdentityCode(requester, joinRequest.company);
      }
    }

    if (joinRequest.kind === "salary") {
      if (status === "approved") {
        const salaryAmount = Math.max(0, Number(body.salaryAmount ?? 0));
        requester.baseSalary = salaryAmount;
        if (salaryAmount > 0) {
          if (!Array.isArray(requester.salaryHistory)) requester.salaryHistory = [];
          requester.salaryHistory.push({
            amount: salaryAmount,
            date: new Date(),
            type: "increment",
          });
        }
      }
    }

    if (joinRequest.kind === "salary-increment") {
      if (status === "hr-approved") {
        const admin = await User.findOne({ company: joinRequest.company, role: "admin", companyStatus: "approved" }).select("_id");
        if (!admin) {
          return jsonError("No admin available to provide final approval.", 404);
        }
        joinRequest.approver = admin._id;
        
        await Notification.create({
          user: admin._id,
          company: joinRequest.company,
          type: "approval",
          title: "Salary Update Approval Required",
          message: `HR has approved the salary update for ${joinRequest.metadata?.targetUserName || "a member"}. Admin approval required.`,
        });
        emitNotification(String(admin._id));

        const meta = joinRequest.metadata || {};
        const targetUserId = meta.targetUser;
        if (targetUserId) {
          const oldSalary = Number(meta.oldBaseSalary) || 0;
          const newSalary = Number(meta.newBaseSalary) || 0;
          await Notification.create({
            user: targetUserId,
            company: joinRequest.company,
            type: "info",
            title: "Salary Updated",
            message: `your salary has been ${newSalary >= oldSalary ? "incremented" : "decremented"} by ${Math.abs(newSalary - oldSalary)}. Your current salary is ${newSalary}`,
          });
          emitNotification(String(targetUserId));
        }
      } else if (status === "approved") {
        const metadata = joinRequest.metadata || {};
        const targetUser = await User.findById(metadata.targetUser);
        if (targetUser) {
          const oldSalary = targetUser.baseSalary || 0;
          const newSalary = Number(metadata.newBaseSalary) || 0;
          
          targetUser.baseSalary = newSalary;
          if (!Array.isArray(targetUser.salaryHistory)) targetUser.salaryHistory = [];
          targetUser.salaryHistory.push({
            amount: newSalary,
            date: new Date(),
            type: newSalary >= oldSalary ? "increment" : "decrement"
          });
          await targetUser.save();
          
          await Notification.create({
            user: targetUser._id,
            company: joinRequest.company,
            type: "info",
            title: "Salary Updated",
            message: `your salary has been ${newSalary >= oldSalary ? "incremented" : "decremented"} by ${Math.abs(newSalary - oldSalary)}. Your current salary is ${newSalary}`
          });
          emitNotification(String(targetUser._id));
        }
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
        requester.companyIdentityCode = undefined;
        requester.baseSalary = 0;
        
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
      if (status === "rejected") {
        await JoinRequest.updateMany(
          {
            requester: requester._id,
            company: joinRequest.company,
            kind: "quit-company-board-transfer",
            status: "pending",
          },
          { $set: { status: "rejected" } },
        );
      }
    }

    if (joinRequest.kind === "quit-company-board-transfer") {
      if (status === "approved") {
        if (!joinRequest.replacementUser) {
          return jsonError("Replacement user is required for board transfer approval.", 400);
        }
        await transferQuitterBoardAssignments(requester._id, joinRequest.replacementUser);
      }
    }

    if (joinRequest.kind === "role-transfer") {
      if (status === "approved") {
        if (!joinRequest.replacementUser) {
          return jsonError("Replacement user is required for role transfer approval.", 400);
        }

        const selectedTeamIds: string[] = Array.isArray((joinRequest.metadata as any)?.teamIds)
          ? (joinRequest.metadata as any).teamIds
          : [];
        if (selectedTeamIds.length === 0) {
          return jsonError("No teams specified for transfer.", 400);
        }

        const teamsToTransfer = await Team.find({ _id: { $in: selectedTeamIds }, manager: requester._id }).select("_id name");
        if (teamsToTransfer.length !== selectedTeamIds.length) {
          return jsonError("Some selected teams were not found or are not managed by you.", 400);
        }

        if (teamsToTransfer.length > 5) {
          return jsonError("Cannot transfer more than 5 teams at a time.", 400);
        }

        await Team.updateMany(
          { _id: { $in: selectedTeamIds }, manager: requester._id },
          { $set: { manager: joinRequest.replacementUser } },
        );

        await transferQuitterBoardAssignments(requester._id, joinRequest.replacementUser);
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

    if (joinRequest.kind === "document-letter") {
      const metadata = (joinRequest.metadata ?? {}) as Record<string, unknown>;
      if (status === "approved") {
        metadata.approvedAt = new Date().toISOString();
        metadata.requesterName = requester.name;
        metadata.requesterRole = requester.role;
        
        if (body.letterContent !== undefined) {
          metadata.letterContent = String(body.letterContent).trim();
        }

        if (String(metadata.letterType ?? "") === "resignation") {
          const existingQuit = await JoinRequest.findOne({
            requester: requester._id,
            kind: "quit-company",
            status: "pending",
          });
          if (!existingQuit) {
            await JoinRequest.create({
              requester: requester._id,
              approver: joinRequest.approver,
              company: joinRequest.company,
              kind: "quit-company",
              status: "pending",
            });
            const resolvedHr =
              joinRequest.approver && String(joinRequest.approver).length > 0
                ? joinRequest.approver
                : null;
            const fallbackHr = await User.findOne({
              company: joinRequest.company,
              role: "human-resource",
              companyStatus: "approved",
            })
              .select("_id")
              .sort({ createdAt: 1 })
              .lean();
            const quitApproverId =
              resolvedHr ?? (fallbackHr ? String((fallbackHr as any)._id) : null);
            if (quitApproverId) {
              const notifyBody = `${String(requester.name ?? "A member")} has submitted a resignation. Their quit request is pending and will be processed after the notice period ends.`;
              await Notification.create({
                user: quitApproverId,
                company: joinRequest.company,
                type: "approval",
                title: "Resignation quit request",
                message: notifyBody,
              });
              emitNotification(String(quitApproverId));
            }
          }
        }
      } else if (status === "rejected" && rejectionReason) {
        metadata.rejectionReason = rejectionReason;
      }
      joinRequest.metadata = metadata;
    }

    if (joinRequest.kind !== "salary-increment" || status === "approved" || status === "rejected") {
      await requester.save();
    }
    joinRequest.status = status;
    await joinRequest.save();
    
    if (joinRequest.kind === "salary-increment" && status === "hr-approved") {
      return NextResponse.json({ request: serializeDoc(joinRequest) });
    }

    const populatedRequest = await JoinRequest.findById(id)
      .populate("company", "name")
      .populate("team", "name");

    const companyName = (populatedRequest?.company as any)?.name ?? "company";
    const teamName = (populatedRequest?.team as any)?.name ?? "team";

    let title = status === "approved" ? "Request approved" : "Request declined";
    let message = `Your ${joinRequest.kind} join request was ${status}.`;

    if (joinRequest.kind === "quit-company-board-transfer") {
      title = status === "approved" ? "Board transfer approved" : "Board transfer rejected";
      message =
        status === "approved"
          ? `Your board transfer approval for ${companyName} was approved`
          : `Your board transfer request for ${companyName} was rejected`;
    } else if (joinRequest.kind === "quit-company") {
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
    } else if (joinRequest.kind === "identity-code") {
      title = status === "approved" ? "Unique identity issued" : "Unique identity request rejected";
      message =
        status === "approved"
          ? `Your company identity code is ${String(requester.companyIdentityCode ?? "")}.`
          : `Your request for a company identity code was rejected.`;
    } else if (joinRequest.kind === "salary") {
      title = status === "approved" ? "Salary assigned" : "Salary request rejected";
      message =
        status === "approved"
          ? `Your salary of ₹${Number(body.salaryAmount ?? 0).toLocaleString("en-IN")} has been assigned. Finance will process it shortly.`
          : "Your salary assignment request was rejected.";
    } else if (joinRequest.kind === "salary-increment") {
      title = status === "approved" ? "Salary update approved" : "Salary update rejected";
      message =
        status === "approved"
          ? `The salary update request for ${joinRequest.metadata?.targetUserName || "a member"} was approved by the admin.`
          : `The salary update request for ${joinRequest.metadata?.targetUserName || "a member"} was rejected.`;
    } else if (joinRequest.kind === "role-transfer") {
      title = status === "approved" ? "Role transfer approved" : "Role transfer rejected";
      message =
        status === "approved"
          ? `Your role transfer approval for ${companyName} was approved`
          : `Your role transfer request for ${companyName} was rejected`;
    } else if (joinRequest.kind === "document-letter") {
      const letterType = String((joinRequest.metadata as any)?.letterType ?? "").replace("-", " ");
      title = status === "approved" ? "Document letter approved" : "Document letter rejected";
      message =
        status === "approved"
          ? `Your ${letterType} request has been approved. View it here.`
          : `Your ${letterType} request was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`;
    }

    const notificationLink =
      joinRequest.kind === "document-letter" && status === "approved"
        ? `/letter/${id}`
        : "";

    await Notification.create({
      user: requester._id,
      company: joinRequest.company,
      team: joinRequest.team,
      type: "approval",
      title,
      message,
      link: notificationLink,
    });
    emitNotification(String(requester._id));

    if (joinRequest.kind === "quit-company-board-transfer" && joinRequest.replacementUser) {
      await Notification.create({
        user: joinRequest.replacementUser,
        company: joinRequest.company,
        team: joinRequest.team,
        type: "info",
        title: status === "approved" ? "Board transfer completed" : "Board transfer rejected",
        message:
          status === "approved"
            ? `You have been assigned to the board transfer from ${requester.name}. The transfer is now complete.`
            : `The board transfer assignment from ${requester.name} was not approved.`,
      });
      emitNotification(String(joinRequest.replacementUser));
    }

    if (joinRequest.kind === "role-transfer" && joinRequest.replacementUser) {
      await Notification.create({
        user: joinRequest.replacementUser,
        company: joinRequest.company,
        team: joinRequest.team,
        type: "info",
        title: status === "approved" ? "Role transfer completed" : "Role transfer rejected",
        message:
          status === "approved"
            ? `You have been assigned to take over the role from ${requester.name}. The transfer is now complete.`
            : `The role transfer assignment from ${requester.name} was not approved.`,
      });
      emitNotification(String(joinRequest.replacementUser));
    }

    return NextResponse.json({ request: serializeDoc(joinRequest) });
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
