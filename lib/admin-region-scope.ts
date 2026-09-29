import {
  assertTargetInScope,
  canAccessTarget,
  resolveMemberScope,
  resolveRegionClause,
  type RegionScope,
} from "@/lib/region-scope";

/**
 * Regional authorization for the `admin` role.
 *
 * Admin uses the same region-membership rule as finance (see
 * `lib/region-scope.ts`), with one addition: `Company.owner` is the single
 * global super-admin and always retains full access. Company-level operations
 * that have no per-region meaning (takedown, freeze, theme, join codes, the
 * region roster itself) are owner-managed.
 *
 * Every guard here is server-side. The admin tabs' client-side role gates in
 * `components/profile/profile-hub.tsx` are UX only and must never be relied on.
 */

type CompanyLike = {
  owner?: unknown;
  addresses?: unknown;
  address?: string | null;
} | null;

type AdminActor = {
  _id?: unknown;
  role?: string | null;
  regionLabel?: string | null;
  company?: unknown;
} | null;

/** True when the actor is the company owner — the global super-admin. */
export function isCompanyOwner(company: CompanyLike, actor: AdminActor): boolean {
  if (!company?.owner || !actor?._id) return false;
  return String(company.owner) === String(actor._id);
}

/** The actor's effective region, or "" when the company has no region config. */
export async function adminRegionLabel(
  company: CompanyLike,
  actor: AdminActor,
): Promise<string> {
  const { region } = await resolveRegionClause({
    company: actor?.company,
    regionLabel: actor?.regionLabel,
  });
  return region;
}

/** Mongo "in this region" clause for the actor, or `null` when no boundary applies. */
export async function adminMemberClause(
  company: CompanyLike,
  actor: AdminActor,
): Promise<Record<string, unknown> | null> {
  const { clause } = await resolveRegionClause({
    company: actor?.company,
    regionLabel: actor?.regionLabel,
  });
  return clause;
}

export interface AdminMemberScope {
  region: string;
  /** Scoped member ids, or `null` for company-wide (no region config or empty-region fallback). */
  memberIds: string[] | null;
  /** True when the boundary was dropped because the region holds no members. */
  regionFallback: boolean;
}

/**
 * Resolve which members a regional admin may act on. Mirrors
 * `financeMemberScope` so the admin members list and the finance salary list
 * show the same population.
 */
export async function resolveAdminMemberIds(
  company: CompanyLike,
  actor: AdminActor,
): Promise<AdminMemberScope> {
  const scope: RegionScope = await resolveMemberScope({
    company: actor?.company,
    regionLabel: actor?.regionLabel,
  });
  return {
    region: scope.region,
    memberIds: scope.memberIds,
    regionFallback: scope.memberIds === null,
  };
}

/**
 * Returns an error message when `targetUserId` is outside the admin's region,
 * or `null` when the admin may act on them. The company owner always passes.
 * Call this before any admin write to a member.
 */
export async function assertAdminTargetInScope(
  company: CompanyLike,
  actor: AdminActor,
  targetUserId: string,
): Promise<string | null> {
  if (isCompanyOwner(company, actor)) return null;
  return assertTargetInScope(
    { company: actor?.company, regionLabel: actor?.regionLabel },
    targetUserId,
  );
}

/**
 * Read-side counterpart of the assert, for per-record admin endpoints that
 * take a member id. The company owner always passes; otherwise the target must
 * sit inside the admin's region.
 */
export async function canAdministerTarget(
  company: CompanyLike,
  actor: AdminActor,
  targetUserId: unknown,
): Promise<boolean> {
  if (isCompanyOwner(company, actor)) return true;
  return canAccessTarget(
    {
      company: actor?.company,
      regionLabel: actor?.regionLabel,
      _id: actor?._id,
      role: actor?.role,
    },
    targetUserId,
    new Set(["admin"]),
  );
}
