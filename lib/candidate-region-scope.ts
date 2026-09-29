import {
  effectiveRegionLabelOf,
  regionStaffIdsOf,
  type OfficeAddressLike,
} from "@/lib/company-regions";
import {
  canReachAllCandidates,
  canRunRecruitmentPipeline,
} from "@/lib/recruitment-hq";

/**
 * Which candidates a recruiter may see.
 *
 * Recruitment was company-wide before the bulk regional handoff existed: a Pune
 * HR head saw every candidate in the company, so "send this candidate to Pune"
 * had nothing to send them *into*. Once `joiningRegionLabel` is set, a candidate
 * belongs to a region, and everyone else's list has to shrink accordingly or the
 * transfer is only a label.
 *
 * Who reaches the whole company is decided in `lib/recruitment-hq.ts` — the main
 * office, the company owner, and any region head the main office has explicitly
 * delegated the pipeline to. Everyone else is bounded:
 *
 *   - the unassigned pool, because a candidate belongs to no region and is
 *     therefore everyone's. This keeps a regional recruiter's pipeline populated
 *     before the owner routes anything their way; hiding it instead would leave
 *     them staring at an empty list.
 *   - their own region, matched on `regionLabel` or on the roster slots.
 *   - anything they are on the interview panel for, via `assignedTeam.user`. This
 *     is the one deliberate leak across the boundary, and it is the price of a
 *     working interview: a Nagpur head who has been scheduled to meet a Pune
 *     candidate has to be able to open that candidate's file, or the panel is
 *     assigned people who cannot see what they are meant to be assessing.
 *
 * A viewer whose effective region matches no office sees only the unassigned pool
 * and their own interviews. That is deliberate: silently widening them to the
 * company would defeat the boundary, and an empty region is a configuration
 * problem the owner can see on the members page.
 *
 * Region membership is read from both signals, the same way
 * `isUserInEffectiveRegion` reads it — the member's own `regionLabel` *or*
 * their id appearing in that region's `hrs[]` / `admins[]` / head slots. Either
 * can be populated without the other, and a recruiter staffed into Pune but whose
 * profile never got a region set is still Pune's.
 */

type CompanyLike = {
  _id?: unknown;
  owner?: unknown;
  addresses?: OfficeAddressLike[] | null;
  address?: string | null;
} | null;

export interface CandidateScopeActor {
  _id?: unknown;
  role?: string | null;
  regionLabel?: string | null;
  company?: unknown;
}

/** The candidate field carrying the transferred office label. */
export const CANDIDATE_REGION_FIELD = "joiningRegionLabel";

/** Roles allowed to see and act on candidates at all. */
export const RECRUITMENT_ROLES = [
  "admin",
  "human-resource",
  "project-manager",
  "qa-tester",
  "finance",
] as const;

export { isRecruitmentWriter, canReachAllCandidates } from "@/lib/recruitment-hq";
export function isRecruitmentReader(actor: CandidateScopeActor | null | undefined): boolean {
  return (RECRUITMENT_ROLES as readonly string[]).includes(String(actor?.role ?? ""));
}

/**
 * Who may move candidates between regions.
 *
 * Narrower than it used to be. It was "any admin or human-resource, plus the
 * owner", which meant every region could distribute candidates to every other
 * region and a mis-routed batch was trivially reversible from either side.
 * Distribution is now the main office's call — they own the requisition and decide
 * which office the hire lands in — with the owner's override retained so they can
 * still fix a batch nobody else is able to move.
 *
 * This is permission to *send*, not permission to *see*. The candidate query is
 * still narrowed by `candidateRegionClause`, so even a delegated region can only
 * hand off the unassigned pool, their own region, and their own interviews.
 */
export function canTransferCandidates(
  company: CompanyLike,
  actor: CandidateScopeActor | null | undefined,
): boolean {
  if (!actor) return false;
  return canRunRecruitmentPipeline(company as any, actor as any);
}

/**
 * The Mongo clause restricting a candidate query to what `actor` may see.
 *
 * Returns `{}` for a company-wide viewer, which is a deliberate no-op rather
 * than a special case: callers spread it into a filter and never branch on it.
 *
 * Uses a case-insensitive regex on the candidate's own region, mirroring
 * `regionApproverClause` in `lib/company-regions.ts`. An exact match would be
 * cheaper, but office labels are user-typed free text (`app/api/company/address`)
 * and a transfer that stopped matching after a case change would hide a candidate
 * from the very region that owns them.
 */
export function candidateRegionClause(
  company: CompanyLike,
  actor: CandidateScopeActor | null | undefined,
): Record<string, unknown> {
  if (canReachAllCandidates(company, actor)) return {};

  const region = effectiveRegionLabelOf(company as any, actor as any);
  const own: Record<string, unknown>[] = [
    { [CANDIDATE_REGION_FIELD]: "" },
    { [CANDIDATE_REGION_FIELD]: null },
    { [CANDIDATE_REGION_FIELD]: { $exists: false } },
  ];
  if (!region) return { $or: [interviewPanelBranch(actor), ...own] };

  const escaped = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  own.push({ [CANDIDATE_REGION_FIELD]: { $regex: `^${escaped}$`, $options: "i" } });
  own.push(interviewPanelBranch(actor));

  // A recruiter staffed into the region but never given a `regionLabel` of their
  // own is still that region's. That half of the test needs the *candidate's*
  // region to evaluate, so it cannot live in a query clause — it belongs in
  // `canAccessCandidate`, which sees the document.
  return { $or: own };
}

/**
 * Candidates the actor is on the interview panel for, regardless of region.
 *
 * The one intentional cross-boundary read. A regional head scheduled to meet a
 * candidate owned by another region has to be able to open that candidate: they
 * are being asked to assess them, and the panel is populated before the candidate
 * is ever distributed. Denying it would mean assigning interviews to people who
 * cannot see the file they are meant to grade.
 */
function interviewPanelBranch(
  actor: CandidateScopeActor | null | undefined,
): Record<string, unknown> {
  const id = String(actor?._id ?? "");
  return id ? { "assignedTeam.user": id } : { "assignedTeam.user": { $exists: false } };
}

/**
 * True when `actor` may act on this specific candidate.
 *
 * The list clause is not sufficient on its own: candidate ids are sequential
 * ObjectIds, so a regional recruiter who never sees another's row in a list can
 * still reach it by walking the detail endpoint. Every route that reads or writes
 * one candidate has to call this. `lib/region-scope.ts` warns about the same
 * bypass for documents.
 */
export function canAccessCandidate(
  company: CompanyLike,
  actor: CandidateScopeActor | null | undefined,
  candidate: {
    joiningRegionLabel?: string | null;
    assignedTeam?: Array<{ user?: unknown }> | null;
  } | null | undefined,
): boolean {
  if (!actor || !candidate) return false;
  if (canReachAllCandidates(company, actor)) return true;

  // Mirrors the `interviewPanelBranch` of the list clause, for the same reason:
  // being on the panel is a legitimate reason to reach the row.
  const actorId = String(actor._id ?? "");
  if (
    actorId &&
    Array.isArray(candidate.assignedTeam) &&
    candidate.assignedTeam.some((m) => String((m as any)?.user ?? "") === actorId)
  ) {
    return true;
  }

  const candidateRegion = String(candidate.joiningRegionLabel ?? "").trim();
  // Unassigned candidates are everyone's, mirroring the list clause.
  if (!candidateRegion) return true;

  const region = effectiveRegionLabelOf(company as any, actor as any);
  if (region && region.toLowerCase() === candidateRegion.toLowerCase()) return true;

  // The roster half: staffed into the candidate's region even without a region
  // of their own on their profile.
  return regionStaffIdsOf(company, candidateRegion).includes(String(actor._id ?? ""));
}
