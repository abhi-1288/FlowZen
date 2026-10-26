import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { safePinShape, verifyPin } from "@/lib/delegation";
import { FeatureDelegation } from "@/models/FeatureDelegation";
import { recordAudit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(); if (!userId) return jsonError("Unauthorized", 401);
  await connectDb(); const { id } = await params; const body = await request.json().catch(() => ({})); const pin = String(body.pin ?? "");
  const row: any = await FeatureDelegation.findOne({ _id: id, recipient: userId }).select("+pinHash");
  if (!row) return jsonError("Delegation not found.", 404);
  if (row.status !== "active" || new Date(row.expiresAt) <= new Date()) return jsonError("This delegation has expired or is unavailable.", 410);
  if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) return jsonError("Too many incorrect attempts. Try again later.", 429);
  const valid = safePinShape(pin) && await verifyPin(pin, row.pinHash);
  if (!valid) {
    const attempts = Number(row.failedAttempts ?? 0) + 1; row.failedAttempts = attempts;
    if (attempts >= 5) row.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await row.save(); await recordAudit({ action: "delegation.pin.failed", actionLabel: "Delegation PIN verification failed", company: row.company, actor: userId, entityType: "FeatureDelegation", entityId: id, result: "failed", metadata: { attempts } });
    return jsonError(attempts >= 5 ? "Too many incorrect attempts. Try again later." : "Incorrect Temporary Green-PIN.", attempts >= 5 ? 429 : 400);
  }
  row.failedAttempts = 0; row.lockedUntil = null; row.lastVerifiedAt = new Date(); await row.save();
  await recordAudit({ action: "delegation.pin.verified", actionLabel: "Delegation PIN verified", company: row.company, actor: userId, entityType: "FeatureDelegation", entityId: id });
  return NextResponse.json({ ok: true, featureKey: row.featureKey, scope: row.scope, verifiedUntil: new Date(Date.now() + 15 * 60 * 1000) });
}
