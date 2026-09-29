import { Company, CompanyPolicy, User } from "@/models";
import {
  effectiveRegionApproverClause,
  effectiveRegionLabelOf,
  type OfficeAddressLike,
} from "@/lib/company-regions";

/**
 * The regional boundary for manager-scoped records (finance salaries today, and
 * admin-managed members/approvals once admin becomes regional).
 *
 * Lives in `lib/` rather than in an API route so that non-route modules
 * (`lib/procurement.ts`, admin routes) can reuse the exact same rules without
 * importing an API route module, which would invert the layering and create an
 * import cycle.
 *
 * The rules, in one place:
 *   - a company with no `addresses[]` and no `address` has no regions, so no
 *     boundary applies and everything stays company-wide;
 *   - a member with no stored `regionLabel` belongs to the main office;
 *   - a region that holds no approved members drops the boundary rather than
 *     showing an empty screen — same fallback as `/api/users?region=mine`;
 *   - a member can always read their own records.
 *
 * Finance and admin both build on this module so the two roles can never drift
 * apart on what "same region" means.
 */

export interface RegionScope {
  /** Actor's effective region, or "" when the company has no region config. */
  region: string;
  /**
   * Approved member ids whose records the actor may manage, or `null` when no
   * regional boundary applies — either the company has no region configured,
   * or the actor's region holds no members and we fall back to company-wide.
   */
  memberIds: string[] | null;
}

export interface RegionClause {
  /** Actor's effective region, or "" when the company has no region config. */
  region: string;
  /** Mongo "in this region" clause, or `null` when no boundary applies. */
  clause: Record<string, unknown> | null;
}

type RegionActor = { company: any; regionLabel?: string | null };
type RegionActorWithIdentity = RegionActor & { _id?: unknown; role?: string | null };

/**
 * The actor's region and the matching Mongo clause. One `Company` read, no
 * member query, so the per-record guards stay cheap.
 */
export async function resolveRegionClause(actor: RegionActor): Promise<RegionClause> {
  const company = (await Company.findById(actor.company)
    .select("addresses address")
    .lean()) as { addresses?: OfficeAddressLike[] | null; address?: string | null } | null;

  const region = effectiveRegionLabelOf(company, actor);
  if (!region) return { region: "", clause: null };

  // The effective clause (not the strict one) because a member with no stored
  // `regionLabel` displays as the main office in `app/api/profile`, so the
  // strict clause would hide them from a main-office actor. The join and
  // ID-card flows need the strict variant to stay strict, so keep them separate.
  return { region, clause: effectiveRegionApproverClause(company, region) };
}

/**
 * True when the actor's region holds no approved members, in which case the
 * boundary is dropped and the actor sees the whole company — the same fallback
 * as `app/api/users/route.ts?region=mine`.
 */
async function regionIsEmpty(actor: RegionActor, clause: Record<string, unknown>) {
  const count = await User.countDocuments({
    company: actor.company,
    companyStatus: "approved",
    ...clause,
  });
  return count === 0;
}

/**
 * Resolve which members a manager actor may act on.
 *
 * Used by the read side (member picker, list endpoints), which needs the ids
 * to filter on. The per-record guards use `resolveRegionClause` directly
 * instead.
 */
export async function resolveMemberScope(actor: RegionActor): Promise<RegionScope> {
  const { region, clause } = await resolveRegionClause(actor);
  if (!clause) return { region, memberIds: null };
  if (await regionIsEmpty(actor, clause)) return { region, memberIds: null };

  const scoped = await User.find({
    company: actor.company,
    companyStatus: "approved",
    ...clause,
  }).select("_id");

  return { region, memberIds: scoped.map((member) => String(member._id)) };
}

/** Query filter restricting a `User` lookup to the actor's region. */
export function memberUserFilter(scope: RegionScope): Record<string, unknown> {
  return scope.memberIds ? { _id: { $in: scope.memberIds } } : {};
}

/** Query filter restricting a record-by-employee lookup to the actor's region. */
export function memberEmployeeFilter(
  scope: RegionScope,
  field: string = "employee",
): Record<string, unknown> {
  return scope.memberIds ? { [field]: { $in: scope.memberIds } } : {};
}

/**
 * Returns an error message when `targetId` is outside the actor's region, or
 * `null` when the target may be managed. Call this before any write.
 */
export async function assertTargetInScope(
  actor: RegionActor,
  targetId: string,
): Promise<string | null> {
  const id = String(targetId ?? "");
  if (!id) return "Member is required.";

  const { region, clause } = await resolveRegionClause(actor);
  if (!clause) return null;

  const inRegion = await User.findOne({
    _id: id,
    company: actor.company,
    companyStatus: "approved",
    ...clause,
  }).select("_id");
  if (inRegion) return null;
  if (await regionIsEmpty(actor, clause)) return null;

  const exists = await User.findOne({
    _id: id,
    company: actor.company,
    companyStatus: "approved",
  }).select("_id");
  if (!exists) return "Member not found in this company.";

  return `This member is outside your region (${region}). You can only manage members in your own region.`;
}

/**
 * Snapshot of the actor's effective region, with the main-office fallback.
 *
 * Use this to stamp `regionLabel` onto a record at creation time, so the record
 * can be displayed and attributed without a member lookup later. The snapshot
 * is display-only: reads that can resolve the member live should still scope
 * against live members, so re-homing someone does not leave stale records
 * behind. (`ProcurementRequest.regionLabel` and `ExpenseRequest.regionLabel`
 * both document this contract.)
 */
export async function effectiveRegionOf(actor: RegionActor): Promise<string> {
  const company = (await Company.findById(actor.company)
    .select("addresses address")
    .lean()) as { addresses?: OfficeAddressLike[] | null; address?: string | null } | null;
  return effectiveRegionLabelOf(company, actor);
}

/**
 * Resolve the `CompanyPolicy` that applies to a subject.
 *
 * Looks up the subject's own regional policy first — their `regionLabel` with
 * the main-office fallback — then falls back to the global policy
 * (`region: ""`) when that region has no policy of its own.
 *
 * Never use the *actor's* region here: a salary is computed under the
 * employee's policy, not the policy of the person running the calculation.
 * Subjects with no `User` (candidates, public offer letters) pass no
 * `subjectRegionLabel` and resolve to the global policy.
 */
export async function resolveRegionPolicy(
  companyId: any,
  subjectRegionLabel?: string | null,
): Promise<any> {
  const companyDoc = (await Company.findById(companyId)
    .select("addresses address")
    .lean()) as { addresses?: OfficeAddressLike[] | null; address?: string | null } | null;

  const region = effectiveRegionLabelOf(companyDoc, { regionLabel: subjectRegionLabel });

  const regional = await CompanyPolicy.findOne({ company: companyId, region }).lean();
  if (regional) return regional;

  if (region !== "") {
    const global = await CompanyPolicy.findOne({ company: companyId, region: "" }).lean();
    if (global) return global;
  }

  return null;
}

/**
 * Read-side counterpart of the assert, for per-record endpoints that take an
 * id rather than a member list.
 *
 * True when the target is the actor, the actor is not a manager role (so
 * non-manager roles keep their existing company-wide view), or the target sits
 * inside the actor's region. Without this the region scoping on the list is
 * bypassable by calling a detail endpoint with a guessed id.
 */
export async function canAccessTarget(
  actor: RegionActorWithIdentity,
  targetUserId: unknown,
  managerRoles: ReadonlySet<string> = new Set(["finance", "admin"]),
): Promise<boolean> {
  const target = String(targetUserId ?? "");
  if (!target) return false;
  if (target === String(actor._id ?? "")) return true;
  if (!managerRoles.has(String(actor.role ?? ""))) return true;

  const { clause } = await resolveRegionClause(actor);
  if (!clause) return true;

  const inRegion = await User.findOne({
    _id: target,
    company: actor.company,
    companyStatus: "approved",
    ...clause,
  }).select("_id");
  if (inRegion) return true;
  if (await regionIsEmpty(actor, clause)) return true;

  return false;
}
