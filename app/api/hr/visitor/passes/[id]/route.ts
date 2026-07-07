import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

function generateIdentityCode(): string {
  return "V-" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role");
  if (!actor) return jsonError("User not found.", 404);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;
  type PassDoc = Record<string, unknown>;
  const pass = await VisitorPass.findById(id).lean() as PassDoc | null;
  if (!pass || String(pass.company) !== String(actor.company)) return jsonError("Not found.", 404);

  // Auto-expire
  if (
    String(pass.status) === "approved" &&
    pass.validUntil &&
    new Date(String(pass.validUntil)) < new Date()
  ) {
    await VisitorPass.updateOne({ _id: pass._id }, { $set: { status: "expired" } });
    pass.status = "expired";
  }

  return NextResponse.json({ pass: { ...pass, id: String(pass._id) } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("name role company");
  if (!actor) return jsonError("User not found.", 404);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;
  const body = await request.json();

  const pass = await VisitorPass.findById(id);
  if (!pass || String(pass.company) !== String(actor.company)) return jsonError("Not found.", 404);

  if (body.status === "approved") {
    pass.approver = userId;
    pass.validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
    pass.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    pass.rejectionReason = "";
    pass.status = "approved";

    const signed = Boolean(body.signed);
    if (signed) {
      pass.isSigned = true;
      pass.signedBy = actor.name ?? "Unknown";
      pass.signedRole = actor.role ?? "";
      pass.signedAt = new Date();
    }

    if (!pass.identityCode) {
      pass.identityCode = generateIdentityCode();
    }

    await pass.save();
  } else if (body.status === "rejected") {
    pass.status = "rejected";
    pass.rejectionReason = String(body.rejectionReason ?? "").trim();
    await pass.save();
  } else {
    return jsonError("Invalid status.", 400);
  }

  return NextResponse.json({ pass: { ...pass.toObject(), id: String(pass._id) } });
}
