import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITJoiningCode } from "@/models/ITJoiningCode";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid code id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("role company companyStatus name isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to revoke IT joining codes.", 403);
  }
  const isItAdmin =
    String(actor.role) === "it-admin" ||
    String(actor.role) === "admin" ||
    (String(actor.role) === "human-resource" && Boolean(actor.isSeniorSecurity));
  if (!isItAdmin) {
    return jsonError("Only IT admins can revoke IT joining codes.", 403);
  }

  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;

  const joinCode = await ITJoiningCode.findOne({ _id: id, company: companyId });
  if (!joinCode) return jsonError("Joining code not found.", 404);

  if (joinCode.status !== "revoked") {
    joinCode.status = "revoked";
    joinCode.revokedAt = new Date();
    await joinCode.save();

    await Notification.create({
      user: userId,
      company: companyId,
      type: "info",
      title: "IT joining code revoked",
      message: `Revoked IT joining code ${joinCode.code}.`,
    });
  }

  return NextResponse.json({ code: serializeDoc(joinCode) });
}
