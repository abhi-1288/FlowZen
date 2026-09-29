import { NextResponse } from "next/server";
import {
  effectiveRegionLabelOf,
  isMainOfficeLabel,
  regionEntryOf,
  regionPipelineManagerIdsOf,
  type OfficeAddressLike,
} from "@/lib/company-regions";
import { isCompanyOwner } from "@/lib/admin-region-scope";
import { jsonError } from "@/lib/api";
import { Company } from "@/models/Company";

/**
 * Who runs the recruitment pipeline, and who can see the whole of it.
 *
 * Recruitment was previously ungated by region: every `admin` / `human-resource`
 * in any office could raise a requisition, score it, run an assessment and
 * schedule interviews, and `canReachAllCandidates` gave every region head the
 * entire company. That made the regional handoff a label rather than a boundary —
 * "send this candidate to Pune" meant nothing if a Nagpur HR head was already
 * looking at the same row.
 *
 * The division of labour is now:
 *
 *   - The main office (first office created, or whichever carries `isMain`) raises
 *     requisitions for every location — PAN, Remote, or a named office — and runs
 *     the whole pipeline through to offer.
 *   - A region picks a candidate up only once HQ distributes them to it, and from
 *     then on owns the offer, the join approval and the office the joiner is filed
 *     under.
 *
 * The main office can delegate a region's pipeline to that region's HR or Admin
 * head via `addresses[].pipelineManagers` (see `regionPipelineManagerIdsOf`).
 * Delegation is per-region, not company-wide: granting it to the Pune head grants
 * nothing in Nagpur, which is the behaviour that keeps "who raised this" a
 * meaningful question when auditing a requisition.
 *
 * Authority is read from the company, never from the role string alone. The
 * company owner's own role can be anything, and a regional head and a regional HR
 * lead both carry `human-resource` — only the former is accountable for a region.
 *
 * A member with no `regionLabel` resolves to the main office
 * (`effectiveRegionLabelOf`), so they are treated as HQ. So is a member whose
 * stored region names an office that no longer exists. That is deliberate: it
 * keeps single-region companies and anyone mid-onboarding working, and it fails
 * open rather than locking a company out of its own recruitment the day this
 * ships. The alternative — requiring every user to sit in a real office before
 * they can do anything — breaks silently the first time an office is renamed,
 * and office labels are free text any admin can edit.
 */

type CompanyLike = {
  _id?: unknown;
  owner?: unknown;
  addresses?: OfficeAddressLike[] | null;
  address?: string | null;
} | null;

export interface RecruitmentScopeActor {
  _id?: unknown;
  role?: string | null;
  regionLabel?: string | null;
  company?: unknown;
}

/** Roles allowed to run the recruitment pipeline at all. */
export const RECRUITMENT_WRITE_ROLES = ["admin", "human-resource"] as const;

export function isRecruitmentWriter(actor: RecruitmentScopeActor | null | undefined): boolean {
  return (RECRUITMENT_WRITE_ROLES as readonly string[]).includes(String(actor?.role ?? ""));
}

/** The region whose pipeline the actor would be acting in, "" when none. */
export function recruitmentRegionOf(
  company: CompanyLike,
  actor: RecruitmentScopeActor | null | undefined,
): string {
  return effectiveRegionLabelOf(company as any, actor as any);
}

/**
 * True when the actor may raise requisitions and run ATS / assessment / interviews.
 *
 * Company owner always. Otherwise an `admin` / `human-resource` who is either the
 * main office, unassigned (resolves to the main office), or explicitly delegated
 * by the main office for their own region.
 */
export function canRunRecruitmentPipeline(
  company: CompanyLike,
  actor: RecruitmentScopeActor | null | undefined,
): boolean {
  if (!actor) return false;
  if (isCompanyOwner(company as any, actor as any)) return true;
  if (!isRecruitmentWriter(actor)) return false;

  const region = recruitmentRegionOf(company, actor);
  // The actor's effective region resolves to no office, which covers three cases
  // that all mean the same thing: the company never configured offices, the
  // member has no region of their own, or their stored `regionLabel` names an
  // office that no longer exists. All three are "unassigned", and unassigned is
  // the main office. Failing closed here instead would mean a company that
  // deletes or renames its office list has nobody left who can raise a
  // requisition — and offices get renamed, since the label is free text.
  const entry = regionEntryOf(company as any, region);
  if (!entry) return true;
  if (isMainOfficeLabel(company as any, region)) return true;

  return regionPipelineManagerIdsOf(entry).includes(String(actor._id ?? ""));
}

/**
 * True when the actor sees every candidate in the company.
 *
 * Narrower than it used to be. It previously granted this to any region head, on
 * the reasoning that a head is company-wide by nature — but that made the region
 * boundary cosmetic, and a head only needs the whole company when they are the one
 * running the pipeline. Head-of-a-region without a delegation now sees the
 * unassigned pool, their own region, and anything they are interviewing.
 */
export function canReachAllCandidates(
  company: CompanyLike,
  actor: RecruitmentScopeActor | null | undefined,
): boolean {
  if (!actor) return false;
  return canRunRecruitmentPipeline(company, actor);
}

/**
 * One refusal for every pipeline action, so the UI and the API agree on why.
 *
 * A region head who is refused at five different endpoints with five different
 * 403 bodies has no way to work out that the common cause is a missing delegation
 * they cannot grant themselves. The remedy is named explicitly instead.
 */
export const PIPELINE_DENIED_MESSAGE =
  "Only the main office can run this. Ask your main office HR or admin to raise it, or to delegate your region's recruitment pipeline to you.";

/**
 * Enforces `canRunRecruitmentPipeline` for a route, loading the company itself.
 *
 * Assumes `connectDb()` has already run, which every caller does before its own
 * role check. Returns the loaded company on success so routes that need the
 * region data do not pay for a second query.
 */
export async function requireRecruitmentHQ(
  actor: RecruitmentScopeActor | null | undefined,
): Promise<
  | { ok: true; company: any }
  | { ok: false; response: NextResponse }
> {
  if (!actor?.company) {
    return { ok: false, response: jsonError("No company found.", 400) };
  }
  const company = await Company.findById(actor.company)
    .select("owner addresses address")
    .lean();
  if (!company) {
    return { ok: false, response: jsonError("No company found.", 400) };
  }
  if (!canRunRecruitmentPipeline(company as any, actor as any)) {
    return { ok: false, response: jsonError(PIPELINE_DENIED_MESSAGE, 403) };
  }
  return { ok: true, company };
}
