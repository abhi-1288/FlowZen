import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { FeatureDelegation } from "@/models/FeatureDelegation";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(); if (!userId) return jsonError("Unauthorized", 401);
  await connectDb(); const { id } = await params; const body = await request.json().catch(() => ({}));
  const row: any = await FeatureDelegation.findOne({ _id: id, authorizer: userId }).populate("recipient", "name role");
  if (!row) return jsonError("Delegation not found.", 404);
  if (row.status === "revoked") return jsonError("Revoked delegations cannot be reactivated.", 409);
  const expiresAt = new Date(String(body.expiresAt ?? ""));
  if (isNaN(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt > new Date(Date.now() + 366 * 86400000)) return jsonError("Choose a valid expiry within 366 days.");
  const oldExpiry = row.expiresAt; row.expiresAt = expiresAt; row.status = "active"; await row.save();
  await Notification.create({ user: row.recipient._id, company: row.company, type: "deadline", title: "Delegation extended", message: `${row.featureName} now expires on ${expiresAt.toLocaleDateString()}.`, link: "/profile/feature-delegation?view=shared" });
  emitNotification(String(row.recipient._id), { title: "Delegation extended", body: `${row.featureName} now expires on ${expiresAt.toLocaleDateString()}.`, link: "/profile/feature-delegation?view=shared" });
  await recordAudit({ action: "delegation.extended", actionLabel: "Temporary delegation extended", company: row.company, actor: userId, target: String(row.recipient._id), entityType: "FeatureDelegation", entityId: id, from: { expiresAt: oldExpiry }, to: { expiresAt } });
  return NextResponse.json({ ok: true, expiresAt });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(); if (!userId) return jsonError("Unauthorized", 401);
  await connectDb(); const { id } = await params;
  const row: any = await FeatureDelegation.findOneAndUpdate({ _id: id, authorizer: userId, status: { $ne: "revoked" } }, { $set: { status: "revoked", revokedBy: userId, lastRevokedAt: new Date() } }, { new: true }).populate("recipient", "name role");
  if (!row) return jsonError("Delegation not found or already revoked.", 404);
  await Notification.create({ user: row.recipient._id, company: row.company, type: "system", title: "Delegated access revoked", message: `${row.featureName} is no longer available to you.`, link: "/profile/feature-delegation?view=shared" });
  emitNotification(String(row.recipient._id), { title: "Delegated access revoked", body: `${row.featureName} is no longer available to you.`, link: "/profile/feature-delegation?view=shared" });
  await recordAudit({ action: "delegation.revoked", actionLabel: "Temporary delegation revoked", company: row.company, actor: userId, target: String(row.recipient._id), entityType: "FeatureDelegation", entityId: id });
  return NextResponse.json({ ok: true });
}
