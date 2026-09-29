import { effectiveRegionLabelOf, withMainOfficeSuffix, type OfficeAddressLike } from "@/lib/company-regions";
import { resolveMemberViewerScope } from "@/lib/member-viewer-scope";
import type { Variant } from "./types";

/**
 * Which slice of the company a command-center viewer sees.
 *
 * Every leader role is regional: an admin, HR lead, finance user, project
 * manager, QA, IT admin or security lead sees their own region rather than the
 * whole company. The region-membership rule is not redefined here — it is
 * `lib/region-scope.ts`, the same one `/api/finance` and `/api/procurement`
 * already enforce, so a salary, a purchase request and a dashboard tile can
 * never disagree about who belongs where.
 *
 * Three tiers sit on top of that rule:
 *   - `Company.owner` is the global super-admin and may view the whole company
 *     or any single region;
 *   - a region's HR head or Admin head may view any single region, but never
 *     the aggregate — the same `?region=` switcher the owner gets, minus the
 *     Global option, so no cross-region rollup is reachable;
 *   - every other leader is pinned to their own region and a `?region=` they
 *     pass is ignored rather than honoured.
 *
 * The `personal` variant is unaffected: it is already scoped to the viewer.
 */

export type RegionScopeKind = "global" | "region" | "personal";

export interface CommandCenterScope {
  variant: Variant;
  /** The region the numbers are scoped to. `""` means the whole company. */
  region: string;
  /** `region` as it should be shown to a human, main-office suffixed. */
  regionLabel: string;
  regionScope: RegionScopeKind;
  /**
   * True when the viewer's own region holds no approved members, so the
   * boundary was dropped and they see the whole company. Never true for an
   * explicitly requested region — see `resolveCommandCenterScope`.
   */
  regionFallback: boolean;
  /** True when a `?region=` was passed but ignored because the viewer cannot switch. */
  regionForced: boolean;
  /** True when the viewer may pick a region from the switcher. */
  canSwitchRegion: boolean;
  /** True when "Global" is one of the regions they may pick — the owner only. */
  allowGlobalRegion: boolean;
  /**
   * Regions the viewer may switch between, in `addresses[]` order.
   *
   * `value` is the label to send back as `?region=`; `label` is what to show.
   * They differ because the main office is suffixed with "(Main Office)" for
   * display, and echoing that suffix back would fail the exact match.
   */
  regionOptions: { value: string; label: string }[];
  /**
   * Approved member ids the viewer may see records for, or `null` when no
   * boundary applies. An empty array is meaningful: an explicitly requested
   * region that holds no members, which must read as zero rather than
   * silently widening to the whole company.
   */
  memberIds: string[] | null;
  /**
   * Every approved member of the company the viewer may count records for.
   *
   * Distinct from `memberIds`, which is `null` for a company-wide viewer. Some
   * models have no `company` column at all — `Attendance` is the one that
   * matters here — so "this company" can only be expressed as a set of member
   * ids. Without this, a company-wide attendance count sweeps up every other
   * tenant's present users. The `personal` variant never needs it: it filters
   * on the viewer's own id instead.
   */
  visibleMemberIds: string[];
  /** True when egion is the company's main office, which widens unset-region records. */
  isMainOffice: boolean;
}

type CompanyLike = {
  _id?: unknown;
  owner?: unknown;
  addresses?: OfficeAddressLike[] | null;
  address?: string | null;
} | null;

type Actor = {
  _id?: unknown;
  company?: unknown;
  regionLabel?: string | null;
  role?: string | null;
};

/**
 * Resolve the viewer's region and member scope.
 *
 * `requestedRegion` is advisory. It is honoured only for the owner and for a
 * region head, and it is matched against the company's real labels so an
 * unknown or misspelled value degrades to the viewer's own region rather than
 * to a region that does not exist.
 *
 * The rules themselves are `lib/member-viewer-scope.ts`, shared with the members
 * page, so a leader's region reach is identical on both. HR and finance are
 * pinned to their own region here, which is what the non-`personal` leader
 * variants are meant to show.
 */
export async function resolveCommandCenterScope(
  company: CompanyLike,
  actor: Actor,
  variant: Variant,
  requestedRegion?: string | null,
): Promise<CommandCenterScope> {
  if (variant === "personal") {
    const ownRegion = effectiveRegionLabelOf(company, actor);
    return {
      variant,
      region: ownRegion,
      regionLabel: withMainOfficeSuffix(company, ownRegion),
      regionScope: "personal",
      regionFallback: false,
      regionForced: false,
      canSwitchRegion: false,
      allowGlobalRegion: false,
      regionOptions: [],
      memberIds: null,
      visibleMemberIds: [],
      isMainOffice: false,
    };
  }

  const viewer = await resolveMemberViewerScope(company, actor, requestedRegion);

  return { variant, ...viewer };
}
