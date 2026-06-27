import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

const VALID_ROLES = ["employee", "project-manager", "qa-tester", "human-resource", "finance", "admin", "others"];
const ROLE_LABELS = [
  "Intern",
  "Trainee",
  "Junior Employee",
  "Employee",
  "Manager",
  "Tester",
  "Junior HR",
];

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const memberId = String((body as any).memberId ?? "");
  if (!isObjectId(memberId)) return jsonError("Invalid member id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [actor, member] = await Promise.all([
    User.findById(userId).select("role company companyStatus"),
    User.findById(memberId),
  ]);
  if (!actor) return jsonError("User not found.", 404);
  if (!member) return jsonError("Member not found.", 404);
  if (!member.company || String(member.companyStatus) !== "approved") {
    return jsonError("You can only update approved members in your company.", 403);
  }

  const company = await Company.findById(member.company).select("owner");
  const actorRole = String(actor.role);
  const isCompanyHr =
    actorRole === "human-resource" &&
    String(actor.companyStatus) === "approved" &&
    String(actor.company ?? "") === String(member.company);
  const isCompanyAdmin =
    actorRole === "admin" &&
    (String(actor.company ?? "") === String(member.company) ||
      String(company?.owner ?? "") === String(actor._id));

  if (!isCompanyHr && !isCompanyAdmin) {
    return jsonError("Only approved HR or admins can update members.", 403);
  }

  if (String(actor._id) === String(member._id)) {
    return jsonError("You cannot change your own role.", 403);
  }

  const newRole = String((body as any).role ?? "").trim();
  const customRole = String((body as any).customRole ?? "").trim();

  if (customRole) {
    if (String(member.role) !== "others") {
      return jsonError("Only members with Others role can receive a custom role label.", 403);
    }
    if (customRole.length > 80) return jsonError("Role name must be 80 characters or less.", 400);
    member.customRole = customRole;
    await member.save();
    return NextResponse.json({ ok: true, options: ROLE_LABELS, customRole });
  }

  if (newRole) {
    if (!VALID_ROLES.includes(newRole)) return jsonError("Invalid role.", 400);
    const oldRole = member.role;
    if (oldRole !== newRole) {
      member.roleHistory.push({
        oldRole,
        newRole,
        changedBy: actor.name ?? "Unknown",
        changedAt: new Date(),
      });
    }
    member.role = newRole;
    member.customRole = "";
    await member.save();

    await Notification.create({
      user: member._id,
      company: member.company,
      type: "info",
      title: "Role Updated",
      message: `Your role has been changed from ${oldRole} to ${newRole} by ${actor.name ?? "HR/Admin"}.`,
    });
    emitNotification(String(member._id));

    return NextResponse.json({ ok: true, role: member.role });
  }

  return jsonError("Provide a role or customRole to update.", 400);
}
