import { User } from "@/models";
import {
  effectiveRegionLabelOf,
  isMainOfficeLabel,
  isRegionHeadOfAny,
  regionLabelsOf,
  withMainOfficeSuffix,
  type OfficeAddressLike,
} from "@/lib/company-regions";
import { isCompanyOwner } from "@/lib/admin-region-scope";
import { resolveMemberScope } from "@/lib/region-scope";

/**
 * Which slice of a company a manager-facing list should show.
 *
 * The command center and the members page both need "which region is this
 * viewer looking at, and which members back that answer", and they must never
 * disagree — a head who sees 12 engineers on the dashboard and 9 on the members
 * page has been handed two truths about one company. So the rules live here and
 * both surfaces call in.
 *
 * The region-membership rule itself is *not* redefined: that is
 * `lib/region-scope.ts`, the same one `/api/finance` and `/api/procurement`
 * already enforce, so a salary, a purchase request and a member row can never
 * disagree about who belongs where.
 *
 * Three tiers sit on top of it:
 *   - `Company.owner` is the global super-admin: defaults to the company-wide
 *     view and may switch to any single region;
 *   - a region's HR head or Admin head may switch to any single region but never
 *     to the aggregate, so no cross-region rollup is reachable without the owner;
 *   - everyone else is pinned to their own region, and a region they pass is
 *     ignored rather than honoured.
 *
 * The members page and the command center both use these tiers unchanged, so a
 * leader's reach is the same on both.
 */

export type ViewerRegionScope = "global" | "region";

export interface MemberViewerScope {
  /** The region records are scoped to. `""` means the whole company. */
  region: string;
  /** `region` as a human should read it, main-office suffixed. */
  regionLabel: string;
  regionScope: ViewerRegionScope;
  /**
   * True when the viewer's own region holds no approved members, so the
   * boundary was dropped and they see the whole company. Never true for an
   * explicitly requested region — see `resolveMemberViewerScope`.
   */
  regionFallback: boolean;
  /** True when a region was asked for but ignored. */
  regionForced: boolean;
  /** True when the viewer may pick a region from a switcher. */
  canSwitchRegion: boolean;
  /** True when "All offices" is one of the regions they may pick — the owner only. */
  allowGlobalRegion: boolean;
  /**
   * Regions the viewer may switch between, in `addresses[]` order.
   *
   * `value` is what to send back as `?region=`; `label` is what to show. They
   * differ because the main office is suffixed with "(Main Office)" for display,
   * and echoing that suffix back would fail the exact match.
   */
  regionOptions: { value: string; label: string }[];
  /**
   * Approved member ids the viewer may see, or `null` when no boundary applies.
   * An empty array is meaningful: a region that was explicitly asked for and
   * holds nobody, which must read as zero rather than silently widening.
   */
  memberIds: string[] | null;
  /**
   * Every approved member of the company, used for tenant isolation on models
   * with no `company` column (`Attendance`). Distinct from `memberIds`, which is
   * `null` for a company-wide viewer.
   */
  visibleMemberIds: string[];
  /** True when `region` is the main office, which widens unset-region records. */
  isMainOffice: boolean;
}

type CompanyLike = {
  _id?: unknown;
  owner?: unknown;
  addresses?: OfficeAddressLike[] | null;
  address?: string | null;
} | null;

type ViewerActor = {
  _id?: unknown;
  company?: unknown;
  regionLabel?: string | null;
  role?: string | null;
};

/** Every approved member of the viewer's company. */
export async function companyMemberIds(actor: ViewerActor): Promise<string[]> {
  if (!actor?.company) return [];
  const members = await User.find({ company: actor.company, companyStatus: "approved" })
    .select("_id")
    .lean();
  return members.map((m) => String(m._id));
}

/** Resolves a requested region against the company's real labels, case-insensitively. */
function canonicalRegion(company: CompanyLike, requested: string | null | undefined): string {
  const raw = String(requested ?? "").trim();
  if (!raw) return "";
  const match = regionLabelsOf(company).find(
    (label) => label.toLowerCase() === raw.toLowerCase(),
  );
  return match ?? "";
}

const GLOBAL_VIEW: ViewerRegionScope = "global";

/**
 * Resolve the viewer's region and member scope for a manager-facing list.
 *
 * `requestedRegion` is advisory. It is honoured only for the owner and for a
 * region head, and is matched against the company's real labels so an unknown
 * or misspelled value degrades to the viewer's own region rather than to a
 * region that does not exist.
 *
 * `globalOnlyRoles` exists for a role whose reach must stay company-wide
 * wherever it is used. It is currently passed by no caller: the command center
 * and the members page both pass nothing, so both pin every leader to their own
 * region and treat the company owner and a region's HR/Admin head — who are
 * identified by the company rather than by their role — as the only switchers.
 * Keeping the parameter means a surface that genuinely needs a company-wide
 * default does not have to reimplement the exemption.
 */
export async function resolveMemberViewerScope(
  company: CompanyLike,
  actor: ViewerActor,
  requestedRegion?: string | null,
  globalOnlyRoles: readonly string[] = [],
): Promise<MemberViewerScope> {
  const allRegionLabels = regionLabelsOf(company);
  const ownRegion = effectiveRegionLabelOf(company, actor);
  // The value sent back as `?region=` is the bare label; only the display label
  // carries the "(Main Office)" suffix.
  const options = allRegionLabels.map((value) => ({
    value,
    label: withMainOfficeSuffix(company, value),
  }));

  const globalScope = (
    rest: Partial<MemberViewerScope> = {},
  ): MemberViewerScope => ({
    region: "",
    regionLabel: "All offices",
    regionScope: GLOBAL_VIEW,
    regionFallback: false,
    regionForced: false,
    canSwitchRegion: false,
    allowGlobalRegion: false,
    regionOptions: [],
    memberIds: null,
    visibleMemberIds: [],
    isMainOffice: false,
    ...rest,
  });

  // No `addresses[]` and no legacy `address` means the company has no regions at
  // all. Every rule below would be a no-op, so short-circuit to company-wide and
  // keep this a pure performance change for those companies.
  if (allRegionLabels.length === 0) {
    return globalScope({ visibleMemberIds: await companyMemberIds(actor) });
  }

  const isOwner = isCompanyOwner(company, actor);
  const isHead = isRegionHeadOfAny(company, actor?._id);
  const role = String(actor?.role ?? "");

  // A region head is identified by the company, not by their role: the HR head
  // of Pune has the role `human-resource`, the same role as an HR lead with no
  // region of their own. So the company-wide exception below must never swallow
  // a head, or the one role this page exists for would lose its switcher.
  const maySwitch = isOwner || isHead;
  const asksForCompanyWide = !maySwitch && globalOnlyRoles.includes(role);

  const canSwitchRegion = maySwitch;
  const allowGlobalRegion = isOwner;

  const requested = canonicalRegion(company, requestedRegion);
  const canUseRequested = canSwitchRegion && requested !== "";
  const regionForced = !canSwitchRegion && String(requestedRegion ?? "").trim() !== "";

  // Owner: the whole company until they ask for a region. Head: their own region
  // unless they picked another. `globalOnlyRoles`: always the whole company.
  // Everyone else: their own region, always.
  const region = asksForCompanyWide
    ? ""
    : isOwner
      ? canUseRequested
        ? requested
        : ""
      : canUseRequested
        ? requested
        : ownRegion;

  if (region === "") {
    return globalScope({
      regionForced,
      canSwitchRegion,
      allowGlobalRegion,
      regionOptions: options,
      visibleMemberIds: await companyMemberIds(actor),
    });
  }

  // `resolveMemberScope` collapses "no region config" and "region holds no
  // members" into the same `null`, and widens the latter to company-wide. That
  // widening is right for someone's own region — an empty screen reads as a
  // broken page — but wrong when the region was chosen explicitly from the
  // switcher: a head who picked Pune asked for Pune, and handing them the whole
  // company instead would be a worse surprise than a page of zeroes.
  const explicit = canUseRequested;
  const scoped = await resolveMemberScope({ company: actor?.company, regionLabel: region });
  const memberIds = explicit ? (scoped.memberIds ?? []) : scoped.memberIds;

  return {
    region,
    regionLabel: withMainOfficeSuffix(company, region),
    // Deliberately the resolved `memberIds`, not `scoped.memberIds`: an
    // explicitly picked region with no members is still a region query, and
    // reporting "global" there would label a page of zeroes as a company-wide
    // rollup. An empty array is truthy, so `[]` lands on "region" and the
    // implicit fallback's `null` lands on "global".
    regionScope: memberIds ? "region" : GLOBAL_VIEW,
    regionFallback: !explicit && scoped.memberIds === null,
    regionForced,
    canSwitchRegion,
    allowGlobalRegion,
    regionOptions: options,
    memberIds,
    visibleMemberIds: memberIds ?? (await companyMemberIds(actor)),
    isMainOffice: isMainOfficeLabel(company, region),
  };
}
