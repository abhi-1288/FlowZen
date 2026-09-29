import {
  assertTargetInScope,
  canAccessTarget,
  memberEmployeeFilter,
  memberUserFilter,
  resolveMemberScope,
  resolveRegionClause,
  type RegionClause,
  type RegionScope,
} from "@/lib/region-scope";

/**
 * Finance-specific names for the shared regional boundary.
 *
 * The implementation lives in `lib/region-scope.ts` so that `admin` (which
 * uses the same region-membership rule) cannot drift from finance on what
 * "same region" means. This module keeps the historical finance names that
 * `app/api/finance/*` and `lib/procurement.ts` already import.
 */

export type FinanceMemberScope = RegionScope;
export type FinanceRegionClause = RegionClause;

export async function financeRegionClause(
  actor: { company: any; regionLabel?: string | null },
): Promise<FinanceRegionClause> {
  return resolveRegionClause(actor);
}

export async function financeMemberScope(
  actor: { company: any; regionLabel?: string | null },
): Promise<FinanceMemberScope> {
  return resolveMemberScope(actor);
}

export function financeMemberUserFilter(
  scope: FinanceMemberScope,
): Record<string, unknown> {
  return memberUserFilter(scope);
}

export function financeMemberSalaryFilter(
  scope: FinanceMemberScope,
): Record<string, unknown> {
  return memberEmployeeFilter(scope, "employee");
}

export async function assertSalaryTargetInFinanceScope(
  actor: { company: any; regionLabel?: string | null },
  employeeId: string,
): Promise<string | null> {
  return assertTargetInScope(actor, employeeId);
}

export async function canAccessFinanceRecord(
  actor: { company: any; regionLabel?: string | null; _id?: unknown; role?: string | null },
  targetUserId: unknown,
  financeManagerRoles: ReadonlySet<string> = new Set(["finance", "admin"]),
): Promise<boolean> {
  return canAccessTarget(actor, targetUserId, financeManagerRoles);
}
