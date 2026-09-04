import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { ITJoiningCode } from "@/models/ITJoiningCode";
import { User } from "@/models/User";

export async function GET(request: Request) {
  const rawCode = String(new URL(request.url).searchParams.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!rawCode) return jsonError("Join code is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const joinCode = await ITJoiningCode.findOne({ code: rawCode })
    .populate("createdBy", "name email")
    .populate("company", "name");
  if (!joinCode) return jsonError("Invalid or expired IT joining code.", 404);

  const now = new Date();
  const expired = joinCode.expiresAt < now;
  const revoked = joinCode.status === "revoked";
  const consumed = joinCode.usedCount >= joinCode.maxUses;
  if (expired || revoked || consumed) {
    return jsonError("Invalid or expired IT joining code.", 404);
  }

  const userId = await requireUserId();
  let joinState: "available" | "joined" = "available";
  if (userId) {
    const user = await User.findById(userId).select("role company companyStatus");
    const isJoined =
      user?.company &&
      String(user.company) === String(joinCode.company) &&
      user.companyStatus === "approved";
    joinState = isJoined ? "joined" : "available";
  }

  const creatorName =
    typeof joinCode.createdBy === "object" && joinCode.createdBy && "name" in joinCode.createdBy
      ? String((joinCode.createdBy as { name?: string }).name ?? "")
      : "";
  const companyName =
    typeof joinCode.company === "object" && joinCode.company && "name" in joinCode.company
      ? String((joinCode.company as { name?: string }).name ?? "")
      : "";

  return NextResponse.json({
    kind: "it-join",
    fromRole: "it-admin",
    toRole: "it-administration",
    joinState,
    code: {
      id: String(joinCode._id),
      code: joinCode.code,
      intendedRole: joinCode.intendedRole,
      organization: joinCode.organization,
      expiresAt: joinCode.expiresAt,
      maxUses: joinCode.maxUses,
      usedCount: joinCode.usedCount,
      creatorName,
    },
    company: {
      name: companyName,
    },
  });
}
