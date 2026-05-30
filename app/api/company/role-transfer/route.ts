import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { emitNotification } from "@/lib/realtime";

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

  const allowedRoles = ["project-manager", "qa-tester", "human-resource", "finance"];
  if (!allowedRoles.includes(String(user.role ?? ""))) {
    return jsonError("Only project managers, QA testers, HR, or finance can transfer role.", 403);
  }

  const existingRequest = await JoinRequest.findOne({
    requester: user._id,
    kind: "role-transfer",
    status: "pending",
  });
  if (existingRequest) return jsonError("Role transfer request already pending.", 409);

  const managedTeams = await Team.find({ manager: user._id }).select("_id name");
  if (managedTeams.length === 0) {
    return jsonError("You have no teams to transfer.", 400);
  }

  const replacementUserId = String((body as any).replacementUserId ?? "").trim();
  if (!replacementUserId) {
    return jsonError("Please select a replacement first.", 400);
  }
  if (replacementUserId === String(user._id)) {
    return jsonError("Replacement cannot be yourself.", 400);
  }

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found.", 404);

  const replacement = await User.findById(replacementUserId).select("company role companyStatus name");
  if (!replacement) return jsonError("Replacement not found.", 404);
  if (
    String(replacement.company ?? "") !== String(company._id) ||
    String(replacement.role) !== String(user.role) ||
    String(replacement.companyStatus) !== "approved"
  ) {
    return jsonError("Replacement must be an approved member with the same role.", 400);
  }

  const replacementManagedTeams = await Team.find({ manager: replacement._id }).countDocuments();
  const roleTeamLimit = String(user.role) === "human-resource" ? 2 : 5;
  const totalAfterTransfer = replacementManagedTeams + managedTeams.length;
  if (totalAfterTransfer > roleTeamLimit) {
    return jsonError(
      `Replacement can manage up to ${roleTeamLimit} teams. They currently have ${replacementManagedTeams} team${replacementManagedTeams === 1 ? "" : "s"} and cannot accept ${managedTeams.length} more.`,
      409,
    );
  }

  const admin = await User.findOne({
    company: company._id,
    role: "admin",
    companyStatus: "approved",
  }).select("_id name");
  const adminId = admin?._id ?? company.owner;
  if (!adminId) return jsonError("No admin available to review this request.", 409);

  const boardLabel = managedTeams.length > 1 ? "teams were" : "team was";
  const teamNames = managedTeams.map((t) => t.name).filter(Boolean).join(", ");

  await JoinRequest.create({
    requester: user._id,
    approver: adminId,
    company: user.company,
    kind: "role-transfer",
    replacementUser: replacementUserId,
  });

  await Notification.create({
    user: adminId,
    company: user.company,
    type: "approval",
    title: "Role Transfer Request",
    message: `${user.name}: ${user.role} is requesting to transfer their role to ${replacement.name}, the assigned ${boardLabel} ${teamNames}`,
  });
  emitNotification(String(adminId));

  await Notification.create({
    user: replacementUserId,
    company: user.company,
    type: "info",
    title: "Role Transfer Assigned",
    message: `You were assigned to take over as ${user.role} from ${user.name}. Await admin approval to complete the transfer.`,
  });
  emitNotification(String(replacementUserId));

  return NextResponse.json({ ok: true });
}
