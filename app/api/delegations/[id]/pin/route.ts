import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { decryptDelegationPin } from "@/lib/delegation";
import { FeatureDelegation } from "@/models/FeatureDelegation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(); if (!userId) return jsonError("Unauthorized", 401);
  await connectDb(); const { id } = await params;
  const row: any = await FeatureDelegation.findOne({ _id: id, $or: [{ authorizer: userId }, { recipient: userId }] }).select("+pinCiphertext status expiresAt");
  if (!row) return jsonError("Delegation not found.", 404);
  if (row.status === "revoked" || new Date(row.expiresAt) <= new Date()) return jsonError("This delegation is no longer active.", 410);
  return NextResponse.json({ pin: decryptDelegationPin(row.pinCiphertext) });
}
