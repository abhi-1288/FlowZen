import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITJoiningCode } from "@/models/ITJoiningCode";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const rawCode = String(body.code ?? "").trim().toUpperCase();
  if (!rawCode) return jsonError("IT joining code is required.");
  if (!rawCode.startsWith("IT-")) return jsonError("Invalid IT joining code.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, joinCode] = await Promise.all([
    User.findById(userId),
    ITJoiningCode.findOne({ code: rawCode }).populate("createdBy", "name email"),
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!joinCode) return jsonError("Invalid or expired IT joining code.", 404);

  // Validate the code.
  if (joinCode.status !== "active") return jsonError("This IT joining code is no longer active.", 403);
  if (joinCode.expiresAt < new Date()) return jsonError("This IT joining code has expired.", 403);
  if (joinCode.usedCount >= joinCode.maxUses) {
    return jsonError("This IT joining code has already been used.", 403);
  }

  // Derive the intended role from the code — never from the request body. IT codes
  // can only ever produce the subordinate IT_ADMINISTRATION role, not IT_ADMIN.
  if (joinCode.intendedRole !== "it-administration") {
    return jsonError("This IT joining code is not authorized for the requested role.", 403);
  }

  // Prevent privilege escalation: an IT_ADMIN can never join with their own subordinate code,
  // and an existing user cannot use this code to become an IT_ADMIN.
  if (String(user.role) === "it-admin") {
    return jsonError("IT admins cannot join with an IT Administration code.", 403);
  }

  const company = await Company.findById(joinCode.company);

  // If the user is already an approved member of this company, disallow.
  if (
    user.company &&
    String(user.company) === String(joinCode.company) &&
    user.companyStatus === "approved"
  ) {
    return NextResponse.json({ status: "joined" });
  }

  // The requesting user's role is forced to the code's intended role (subordinate).
  user.role = "it-administration";
  user.company = joinCode.company;
  user.companyStatus = "pending";
  await user.save();

  const creatorId = String((joinCode.createdBy as any)?._id ?? joinCode.createdBy);
  const creatorName =
    typeof joinCode.createdBy === "object" && joinCode.createdBy && "name" in joinCode.createdBy
      ? String((joinCode.createdBy as { name?: string }).name ?? "")
      : "";

  const joinRequest = await JoinRequest.findOneAndUpdate(
    { requester: userId, company: joinCode.company, kind: "company", status: "pending" },
    {
      $set: {
        approver: creatorId,
        metadata: {
          enrollingHrId: creatorId,
          itJoinCode: rawCode,
          itJoinIntendedRole: "it-administration",
        },
      },
      $setOnInsert: {
        requester: userId,
        company: joinCode.company,
        kind: "company",
      },
    },
    { new: true, upsert: true },
  );

  // Consume one use of the code.
  joinCode.usedCount += 1;
  joinCode.usedBy.push({ user: userId, usedAt: new Date() });
  if (joinCode.usedCount >= joinCode.maxUses) {
    joinCode.status = "expired";
  }
  await joinCode.save();

  await Notification.create({
    user: creatorId,
    company: joinCode.company,
    type: "approval",
    title: "IT Administration join request",
    message: `${user.name} requested to join ${company?.name ?? ""} as IT Administration using your joining code.`,
  });
  emitNotification(creatorId);

  return NextResponse.json(
    {
      request: serializeDoc(joinRequest),
      status: "requested",
      creatorId,
      creatorName,
      intendedRole: "it-administration",
    },
    { status: 201 },
  );
}
