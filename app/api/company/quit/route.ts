import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Board } from "@/models/Board";
import { emitNotification } from "@/lib/realtime";
import { findApprovedHrUserId, listApprovedHrUserIds, resolveSeniorSecurityApprover } from "@/lib/join-approvers";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (!user.company) return jsonError("You are not in a company.", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found.", 404);
  const role = String(user.role ?? "");

  let replacementHrId: string | null = null;
  let replacementUserId: string | null = null;

  if (role === "human-resource") {
    replacementHrId = String((body as any).replacementHrId ?? "").trim();
    if (!replacementHrId) {
      return jsonError("Please select another HR as replacement.", 400);
    }
    if (replacementHrId === String(user._id)) {
      return jsonError("Replacement HR cannot be yourself.", 400);
    }
    const replacementHr = await User.findById(replacementHrId).select("company role companyStatus");
    if (!replacementHr) return jsonError("Replacement HR not found.", 404);
    if (
      String(replacementHr.company ?? "") !== String(company._id) ||
      String(replacementHr.role) !== "human-resource" ||
      String(replacementHr.companyStatus) !== "approved"
    ) {
      return jsonError("Replacement must be an approved HR from your company.", 400);
    }
  }

  const existing = await JoinRequest.findOne({
    requester: user._id,
    kind: "quit-company",
    status: "pending",
  });
  if (existing) return jsonError("Quit request already pending.", 409);

  const assignedBoards = await Board.find({
    $or: [
      { "members.assignedTo": user._id },
      {
        members: {
          $elemMatch: {
            user: user._id,
            $or: [
              { assignedTo: { $ne: null } },
              { role: { $in: ["manager", "tester"] } }
            ]
          },
        },
      },
    ],
  }, "title");
  const boardTitles = assignedBoards.map((board) => board.title).filter(Boolean);
  const assignedMessage = boardTitles.length
    ? ` and they are assigned on board${boardTitles.length > 1 ? "s" : ""} ${boardTitles.join(", ")}`
    : "";

  if (role === "human-resource") {
    const approvedAdmin = await User.findOne({
      company: company._id,
      role: "admin",
      companyStatus: "approved",
    }).select("_id");
    const approverId = approvedAdmin?._id ?? company.owner;

    await JoinRequest.create({
      requester: user._id,
      approver: approverId,
      company: user.company,
      kind: "quit-company",
      replacementHr: replacementHrId || undefined,
    });

    await Notification.create({
      user: approverId,
      company: user.company,
      type: "approval",
      title: "Quit Request",
      message: `${user.name}: ${user.role} is requesting to quit from ${company.name}${assignedMessage}${replacementHrId ? ` (replacement HR selected)` : ""}`,
    });
    emitNotification(String(approverId));
    return NextResponse.json({ ok: true });
  }

  let replacement: any = null;
  if (role === "project-manager" || role === "qa-tester") {
    replacementUserId = String((body as any).replacementUserId ?? "").trim();
    if (!replacementUserId) {
      return jsonError("Please assign another replacement first.", 400);
    }
    if (replacementUserId === String(user._id)) {
      return jsonError("Replacement cannot be yourself.", 400);
    }
    replacement = await User.findById(replacementUserId).select("company role companyStatus name");
    if (!replacement) return jsonError("Replacement user not found.", 404);
    if (
      String(replacement.company ?? "") !== String(company._id) ||
      String(replacement.role) !== role ||
      String(replacement.companyStatus) !== "approved"
    ) {
      return jsonError("Replacement must be an approved member with same role.", 400);
    }
  }

  if (role === "employee" || role === "others") {
    const hasTeam = Boolean(user.team) || (Array.isArray(user.activeTeams) && user.activeTeams.length > 0);
    if (hasTeam || String(user.teamStatus ?? "") === "approved") {
      return jsonError("Quit your team first, then request company quit.", 409);
    }
  }

  const hrIds = await listApprovedHrUserIds(company._id);
  if (hrIds.length === 0) {
    return jsonError("No approved HR available to review this quit request.", 409);
  }
  let approverId = await findApprovedHrUserId(company._id);
  if (!approverId) return jsonError("No approved HR available to review this quit request.", 409);

  // Junior security quit requests go to senior security instead of HR
  const ssApproverId = await resolveSeniorSecurityApprover(userId, String(company._id), null);
  const isJuniorSecurity = Boolean(ssApproverId);
  if (ssApproverId) {
    approverId = ssApproverId;
  }

  await JoinRequest.create({
    requester: user._id,
    approver: approverId,
    company: user.company,
    kind: "quit-company",
    replacementUser: replacementUserId || undefined,
  });

  if (isJuniorSecurity) {
    await Notification.create({
      user: approverId,
      company: user.company,
      type: "approval",
      title: "Quit Request",
      message: `${user.name}: ${user.role} is requesting to quit from ${company.name}${assignedMessage}`,
    });
    emitNotification(approverId);
  } else {
    await Notification.insertMany(
      hrIds.map((hrId) => ({
        user: hrId,
        company: user.company,
        type: "approval",
        title: "Quit Request",
        message: `${user.name}: ${user.role} is requesting to quit from ${company.name}${assignedMessage}${replacementUserId ? ` (replacement assigned)` : ""}`,
      })),
    );
    hrIds.forEach((id) => emitNotification(String(id)));
  }

  if (replacementUserId) {
    const admin = await User.findOne({
      company: company._id,
      role: "admin",
      companyStatus: "approved",
    }).select("_id name");
    const adminId = admin?._id ?? company.owner;
    if (adminId) {
      await JoinRequest.create({
        requester: user._id,
        approver: adminId,
        company: user.company,
        kind: "quit-company-board-transfer",
        replacementUser: replacementUserId,
      });

      const boardLabel = boardTitles.length > 1 ? "boards were" : "board was";
      const assignedReplacementLabel = replacement?.role
        ? `a ${replacement.role}: ${replacement.name}`
        : `a replacement: ${replacement?.name ?? "replacement"}`;

      await Notification.create({
        user: adminId,
        company: user.company,
        type: "approval",
        title: "Role transfer approval",
        message: boardTitles.length > 0 
          ? `${user.name}, ${user.role} is quitting from ${company.name}, the assigned ${boardLabel} ${boardTitles.join(", ")}, and assigned ${assignedReplacementLabel}`
          : `${user.name}, ${user.role} is quitting from ${company.name}, and assigned ${assignedReplacementLabel}`,
      });
      emitNotification(String(adminId));

      await Notification.create({
        user: replacementUserId,
        company: user.company,
        type: "info",
        title: "Role transfer assigned",
        message: boardTitles.length > 0 
          ? `You were assigned to take over ${boardLabel} ${boardTitles.join(", ")} from ${user.name} as a ${replacement?.role ?? role}. Await admin approval to complete the transfer.`
          : `You were assigned to take over as a ${replacement?.role ?? role} from ${user.name}. Await admin approval to complete the transfer.`,
      });
      emitNotification(String(replacementUserId));
    }
  }

  return NextResponse.json({ ok: true });
}
