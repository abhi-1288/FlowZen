import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

const VALID_EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];
const ALLOWED_DURATION_FIELDS: string[] = [
  "durationMonths",
  "durationDays",
  "durationHours",
  "durationYears",
];

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid member id.", 400);

  const body = await request.json().catch(() => ({}));

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [actor, member] = await Promise.all([
    User.findById(userId).select("name role company companyStatus isSeniorSecurity"),
    User.findById(id),
  ]);
  if (!actor) return jsonError("User not found.", 404);
  if (!member) return jsonError("Member not found.", 404);
  if (!String(member.company ?? "")) return jsonError("Member is not in a company.", 400);
  if (String(member.companyStatus ?? "") !== "approved") {
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
  const isSeniorSecurity =
    actorRole === "security" &&
    (actor as any).isSeniorSecurity &&
    String(actor.companyStatus) === "approved" &&
    String(actor.company ?? "") === String(member.company);

  if (!isCompanyHr && !isCompanyAdmin && !isSeniorSecurity) {
    return jsonError("Only approved HR, admins, or senior security can update members.", 403);
  }

  const employmentType = String(body.employmentType ?? "").trim();
  if (employmentType && !VALID_EMPLOYMENT_TYPES.includes(employmentType)) {
    return jsonError(`Invalid employment type. Allowed: ${VALID_EMPLOYMENT_TYPES.join(", ")}.`, 400);
  }

  member.employmentType = employmentType;

  for (const fieldName of ALLOWED_DURATION_FIELDS as string[]) {
    const value = body[fieldName];
    if (value !== undefined) {
      const num = value === null || value === "" ? null : Number(value);
      (member as any)[fieldName] = num;
    }
  }

  if (body.employmentEndDate !== undefined) {
    const endDate = body.employmentEndDate === null || body.employmentEndDate === "" ? null : new Date(String(body.employmentEndDate));
    member.employmentEndDate = endDate && !Number.isNaN(endDate.getTime()) ? endDate : null;
  }

  if (body.companyJoined !== undefined) {
    const joinDate = body.companyJoined === null || body.companyJoined === "" ? null : new Date(String(body.companyJoined));
    if (joinDate && !Number.isNaN(joinDate.getTime())) member.companyJoined = joinDate;
  }

  await member.save();

  await Notification.create({
    user: member._id,
    company: member.company,
    type: "info",
    title: "Employment type updated",
    message: `Your employment type has been set to ${employmentType || "not specified"} by ${actor.name ?? "HR/Admin"}.`,
  });
  emitNotification(String(member._id));

  return NextResponse.json({
    ok: true,
    employmentType: member.employmentType,
    employmentEndDate: member.employmentEndDate,
  });
}
