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

  const allowedRoles = ["project-manager", "qa-tester", "human-resource", "finance", "admin"];
  if (!allowedRoles.includes(String(user.role ?? ""))) {
    return jsonError("Only project managers, QA testers, HR, finance, or admins can transfer role.", 403);
  }

  const existingRequest = await JoinRequest.findOne({
    requester: user._id,
    kind: "role-transfer",
    status: "pending",
  });
  if (existingRequest) return jsonError("Role transfer request already pending.", 409);

  const replacementUserId = String((body as any).replacementUserId ?? "").trim();
  if (!replacementUserId) {
    return jsonError("Please select a replacement first.", 400);
  }
  if (replacementUserId === String(user._id)) {
    return jsonError("Replacement cannot be yourself.", 400);
  }

  const rawTeamIds = Array.isArray((body as any).teamIds) ? (body as any).teamIds : [];
  const teamIds = rawTeamIds.filter((id: string) => String(id).trim()).map((id: string) => String(id).trim());
  if (teamIds.length === 0) {
    return jsonError("Please select at least one team to transfer.", 400);
  }

  const allManagedTeams = await Team.find({ manager: user._id }).select("_id name");
  if (allManagedTeams.length === 0) {
    return jsonError("You have no teams to transfer.", 400);
  }

  const managedTeams = allManagedTeams.filter((t) => teamIds.includes(String(t._id)));
  if (managedTeams.length === 0) {
    return jsonError("Selected teams not found or not owned by you.", 400);
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

  if (managedTeams.length > 5) {
    return jsonError(`You can transfer up to 5 teams at a time. Selected ${managedTeams.length}.`, 400);
  }

  const isSelfAdmin = String(user.role) === "admin";
  let approverId: string | undefined;

  if (isSelfAdmin && String(replacement.role) === "admin" && replacementUserId !== String(user._id)) {
    approverId = replacementUserId;
  } else {
    const otherAdmin = await User.findOne({
      company: company._id,
      role: "admin",
      companyStatus: "approved",
      _id: { $ne: user._id },
    }).select("_id");
    approverId = String(otherAdmin?._id ?? "");
  }

  if (!approverId) {
    const owner = company.owner ? String(company.owner) : "";
    if (owner && owner !== String(user._id)) {
      approverId = owner;
    }
  }

  if (!approverId) return jsonError("No admin available to review this request.", 409);

  const boardLabel = managedTeams.length > 1 ? "teams were" : "team was";
  const teamNames = managedTeams.map((t) => t.name).filter(Boolean).join(", ");

  await JoinRequest.create({
    requester: user._id,
    approver: approverId,
    company: user.company,
    kind: "role-transfer",
    replacementUser: replacementUserId,
    metadata: { teamIds: managedTeams.map((t) => String(t._id)) },
  });

  await Notification.create({
    user: approverId,
    company: user.company,
    type: "approval",
    title: "Role Transfer Request",
    message: `${user.name}: ${user.role} is requesting to transfer their role to ${replacement.name}, the assigned ${boardLabel} ${teamNames}`,
  });
  emitNotification(String(approverId));

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
