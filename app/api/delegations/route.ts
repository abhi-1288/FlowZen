import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { FeatureDelegation } from "@/models/FeatureDelegation";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { effectiveRegionApproverClause, effectiveRegionLabelOf, regionLabelsOf } from "@/lib/company-regions";
import { canDelegate, encryptDelegationPin, featuresForRole, generateDelegationPin, pinHash, sameCompany } from "@/lib/delegation";
import { emitNotification } from "@/lib/realtime";

function serialize(item: any, includePin = false) {
  const row = item.toObject ? item.toObject() : item;
  return {
    id: String(row._id ?? row.id), featureKey: row.featureKey, featureName: row.featureName,
    scope: row.scope ?? [], status: row.expiresAt && new Date(row.expiresAt) < new Date() && row.status === "active" ? "expired" : row.status,
    requiresVerification: Boolean(row.requiresVerification),
    createdAt: row.createdAt, expiresAt: row.expiresAt, reason: row.reason ?? "",
    authorizer: row.authorizer && { id: String(row.authorizer._id ?? row.authorizer), name: row.authorizer.name, role: row.authorizer.role, avatarUrl: row.authorizer.avatarUrl },
    recipient: row.recipient && { id: String(row.recipient._id ?? row.recipient), name: row.recipient.name, role: row.recipient.role, avatarUrl: row.recipient.avatarUrl },
    ...(includePin ? { pin: row.pin } : {}),
  };
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "managed";
  const me = await User.findById(userId).select("company role name email avatarUrl regionLabel isSeniorSecurity");
  if (!me?.company) return NextResponse.json({ delegations: [], features: [], metrics: { active: 0, pending: 0, expiring: 0, members: 0 } });
  // Bring pre-policy rows forward the first time their company opens the
  // delegation workspace. This prevents an old `false` value from becoming a
  // loophole after verification became mandatory for every role.
  await FeatureDelegation.updateMany(
    { company: me.company, requiresVerification: { $ne: true } },
    { $set: { requiresVerification: true } },
  );
  if (url.searchParams.get("members") === "1") {
    const q = String(url.searchParams.get("q") ?? "").trim();
    const company = await Company.findById(me.company).select("addresses address").lean();
    const currentRegion = effectiveRegionLabelOf(company as any, me);
    const regions = regionLabelsOf(company as any);
    if (q.length < 2) return NextResponse.json({ members: [], regions, currentRegion });
    const requestedRegion = String(url.searchParams.get("region") || currentRegion).trim();
    const regionClause = effectiveRegionApproverClause(company as any, requestedRegion);
    const query: Record<string, unknown> = { company: me.company, companyStatus: "approved", _id: { $ne: userId } };
    const nameOrEmail = { $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }] };
    query.$and = regionClause ? [nameOrEmail, regionClause] : [nameOrEmail];
    const members = await User.find(query).select("name email role avatarUrl regionLabel").limit(8).lean();
    return NextResponse.json({ members: members.map((member: any) => ({ id: String(member._id), name: member.name, email: member.email, role: member.role, avatarUrl: member.avatarUrl, regionLabel: member.regionLabel || requestedRegion })), regions, currentRegion, selectedRegion: requestedRegion });
  }
  const filter = view === "shared" ? { recipient: userId, company: me.company } : { authorizer: userId, company: me.company };
  const rows = await FeatureDelegation.find(filter)
    .populate("authorizer", "name role avatarUrl")
    .populate("recipient", "name role avatarUrl")
    .sort({ createdAt: -1 }).limit(100);
  const active = rows.filter((r: any) => r.status === "active" && new Date(r.expiresAt) > new Date());
  return NextResponse.json({ delegations: rows.map((r) => serialize(r)), features: featuresForRole(String(me.role), Boolean((me as any).isSeniorSecurity)), metrics: {
    active: active.length, pending: rows.filter((r: any) => r.status === "pending-approval").length,
    expiring: active.filter((r: any) => Number(r.expiresAt) - Date.now() < 7 * 86400000).length,
    members: new Set(active.map((r: any) => String(r.recipient?._id ?? r.recipient))).size,
  }, user: { id: String(me._id), name: me.name, role: me.role, company: String(me.company) } });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const body = await request.json().catch(() => ({}));
  const me = await User.findById(userId).select("company role name email isSeniorSecurity");
  if (!me?.company || !canDelegate(String(me.role), Boolean((me as any).isSeniorSecurity))) return jsonError("You are not authorized to delegate features.", 403);
  const recipientId = String(body.recipientId ?? "");
  const featureKey = String(body.featureKey ?? "");
  const recipient = await User.findById(recipientId).select("name email role company");
  const feature = featuresForRole(String(me.role), Boolean((me as any).isSeniorSecurity)).find((item) => item.key === featureKey);
  if (!recipient || !sameCompany(recipient.company, me.company)) return jsonError("Recipient must belong to your company.", 403);
  if (recipientId === userId) return jsonError("You cannot delegate a feature to yourself.");
  if (!feature) return jsonError("That feature is not within your delegation permissions.", 403);
  const expiresAt = new Date(String(body.expiresAt ?? ""));
  if (isNaN(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt > new Date(Date.now() + 366 * 86400000)) return jsonError("Choose an expiry within the next 366 days.");
  const scope = Array.isArray(body.scope) ? body.scope.filter((x: unknown) => feature.actions.includes(String(x))) : feature.actions;
  const reason = String(body.reason ?? "").trim().slice(0, 500);
  // Never trust a client-side switch for this security boundary. Every new
  // delegation, regardless of its role or feature family, is reviewed.
  const requiresVerification = true;
  let pin = ""; let delegation: any;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    pin = generateDelegationPin();
    try {
      delegation = await FeatureDelegation.create({ company: me.company, authorizer: userId, recipient: recipientId, featureKey, featureName: feature.name, scope, pinHash: await pinHash(pin), pinCiphertext: encryptDelegationPin(pin), expiresAt, reason, requiresVerification });
      break;
    } catch (error: any) {
      if (error?.code !== 11000 || attempt === 4) throw error;
    }
  }
  await Notification.create({ user: recipientId, company: me.company, type: "approval", title: "Feature shared with you", message: `${me.name} shared ${feature.name}. Verify the Temporary Green-PIN to open it.`, link: "/profile/feature-delegation?view=shared" });
  emitNotification(recipientId, { title: "Feature shared with you", body: `${me.name} shared ${feature.name}. Verify the Temporary Green-PIN to open it.`, link: "/profile/feature-delegation?view=shared" });
  await recordAudit({ action: "delegation.created", actionLabel: "Temporary feature delegation created", company: me.company, actor: { id: userId, name: me.name, role: me.role }, target: { id: recipientId, name: recipient.name, role: recipient.role }, entityType: "FeatureDelegation", entityId: String(delegation._id), metadata: { featureKey, expiresAt, scope, requiresVerification } });
  return NextResponse.json({ delegation: serialize({ ...delegation.toObject(), pin }) }, { status: 201 });
}
