import { connectDb } from "@/lib/db";
import { FeatureDelegation as FeatureDelegationModel } from "@/models/FeatureDelegation";
import type { FeatureDelegationDocument } from "@/models/FeatureDelegation";
type FeatureDelegation = FeatureDelegationDocument;
import { FEATURES_BY_ROLE } from "@/lib/delegation";

/** A verified PIN is valid for this long before the recipient must re-enter it. */
export const DELEGATION_VERIFICATION_TTL_MS = 15 * 60 * 1000;

/**
 * Which role a feature "belongs" to.
 *
 * Derived from the same catalog the delegation screen offers, so a route can
 * turn an exact delegated feature into the role whose workflows it should reuse.
 * `admin` is skipped because it appears on every family and is not a useful
 * acting role.
 */
const FEATURE_OWNER_ROLE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [role, features] of Object.entries(FEATURES_BY_ROLE)) {
    if (role === "admin") continue;
    for (const feature of features) {
      if (!map[feature.key]) map[feature.key] = role;
    }
  }
  return map;
})();

export function ownerRoleForFeature(featureKey: string): string {
  return FEATURE_OWNER_ROLE[String(featureKey)] ?? "";
}

/**
 * The role a request should behave as.
 *
 * Admins keep their own role so admin-only branches stay reachable. For anyone
 * else, a verified delegation that matches one of `featureKeys` temporarily
 * confers the role that owns the feature (for example `hr-member-management`
 * acts as `human-resource`). Without a matching delegation the real role is
 * returned unchanged, so existing permission checks keep rejecting exactly as
 * before.
 *
 * Routes must still replace their role comparisons with this value; it never
 * widens the feature itself, only lets the owning family's checks run.
 */
export async function actingRoleForRequest(opts: {
  userId: string;
  request: Request;
  realRole: string;
  featureKeys: string[];
}): Promise<string> {
  const realRole = String(opts.realRole ?? "");
  if (realRole === "admin") return realRole;

  const row = await delegationForAnyFeature(
    opts.userId,
    delegationIdFromRequest(opts.request),
    opts.featureKeys,
  );
  if (!row) return realRole;

  return ownerRoleForFeature(String(row.featureKey)) || realRole;
}

/**
 * Return the delegation record when it is active, not expired, and belongs to
 * this user. Only the identity checks live here; callers decide which feature
 * the delegation must cover.
 */
export async function resolveActiveDelegation(
  userId: string,
  delegationId: string,
): Promise<FeatureDelegation | null> {
  const id = String(delegationId ?? "").trim();
  if (!id) return null;

  await connectDb();
  const row = await FeatureDelegationModel.findOne({
    _id: id,
    recipient: userId,
    status: "active",
    expiresAt: { $gt: new Date() },
  });

  return row ?? null;
}

/** True when the recipient verified the temporary PIN recently enough. */
export function isDelegationVerified(row: FeatureDelegation | null): boolean {
  if (!row?.lastVerifiedAt) return false;
  const verifiedAt = new Date(row.lastVerifiedAt).getTime();
  if (Number.isNaN(verifiedAt)) return false;
  return Date.now() - verifiedAt <= DELEGATION_VERIFICATION_TTL_MS;
}

/**
 * Resolve a delegation id from a request URL or an explicit header.
 *
 * `X-Delegation-Id` is preferred because it survives bodies and works for every
 * HTTP method, while `?delegation=` keeps direct links shareable.
 */
export function delegationIdFromRequest(request: Request): string {
  const header = request.headers.get("x-delegation-id");
  if (header) return header.trim();
  try {
    return String(new URL(request.url).searchParams.get("delegation") ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Returns the delegation when it is active, verified, and grants exactly this
 * feature. `featureKey` is never prefix-matched: sharing `finance-invoices`
 * must not also unlock salaries or budgets.
 */
export async function delegationForFeature(
  userId: string,
  delegationId: string,
  featureKey: string,
): Promise<FeatureDelegation | null> {
  const row = await resolveActiveDelegation(userId, delegationId);
  if (!row) return null;
  if (String(row.featureKey) !== String(featureKey)) return null;
  if (!isDelegationVerified(row)) return null;
  return row;
}

/**
 * Same as {@link delegationForFeature}, but accepts a set of feature keys.
 *
 * Some features are intentionally split across sibling routes (for example HR
 * member management and HR salary management both live under the members page),
 * so a route can declare every key it is willing to serve while still requiring
 * an exact match from the delegation.
 */
export async function delegationForAnyFeature(
  userId: string,
  delegationId: string,
  featureKeys: string[],
): Promise<FeatureDelegation | null> {
  const row = await resolveActiveDelegation(userId, delegationId);
  if (!row) return null;
  const key = String(row.featureKey);
  if (!featureKeys.includes(key)) return null;
  if (!isDelegationVerified(row)) return null;
  return row;
}

/** Convenience guard for routes that only need a boolean. */
export async function hasDelegatedFeature(
  userId: string,
  delegationId: string,
  featureKey: string,
): Promise<boolean> {
  return Boolean(await delegationForFeature(userId, delegationId, featureKey));
}

/** True when the delegation grants one of the supplied feature keys. */
export async function hasAnyDelegatedFeature(
  userId: string,
  request: Request,
  featureKeys: string | string[],
): Promise<boolean> {
  const keys = Array.isArray(featureKeys) ? featureKeys : [featureKeys];
  const row = await delegationForAnyFeature(userId, delegationIdFromRequest(request), keys);
  return Boolean(row);
}

/** True when the delegation grants exactly this feature. */
export async function hasDelegatedFeatureFromRequest(
  userId: string,
  request: Request,
  featureKey: string,
): Promise<boolean> {
  return Boolean(await delegationForFeature(userId, delegationIdFromRequest(request), featureKey));
}

export function delegationAllowsAction(
  row: FeatureDelegation | null,
  action?: string,
): boolean {
  if (!row) return false;
  const scope = Array.isArray((row as any).scope) ? (row as any).scope.map((entry: unknown) => String(entry)) : [];
  if (!scope.length) return true;
  if (!action) return true;
  return scope.some((entry: string) => entry.toLowerCase() === action.toLowerCase());
}
