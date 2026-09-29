import type { RegionScopeKind } from "./region";
import type { Period, Variant } from "./types";

export interface CommandCenterContext {
  userId: string;
  role: string;
  isSeniorSecurity: boolean;
  companyId: string | null;
  userName: string;
  companyName: string;
  companyColor: string;
  variant: Variant;
  period: Period;
  now: Date;

  /**
   * The region every builder aggregates against.
   *
   * `""` means the whole company, which is what `memberIds: null` and a `null`
   * `boardIds` mean throughout the builders. Rather than each builder
   * re-deriving the boundary, they read the resolved ids off the context and
   * spread the matching `{}` / `{field: {$in: ids}}` filter.
   */
  region: string;
  regionLabel: string;
  regionScope: RegionScopeKind;
  regionFallback: boolean;
  regionForced: boolean;
  canSwitchRegion: boolean;
  allowGlobalRegion: boolean;
  /** Bare label to send as `?region=`, paired with the label to display. */
  regionOptions: { value: string; label: string }[];
  /** Approved member ids in scope, `null` when no boundary applies, `[]` for an empty region. */
  memberIds: string[] | null;
  /**
   * Every approved member of the company, for models with no `company` column
   * of their own — `Attendance` being the one that matters. Distinct from
   * `memberIds`, which is `null` for a company-wide viewer.
   */
  visibleMemberIds: string[];
  /** True when `region` is the main office, which widens records with no region set. */
  isMainOffice: boolean;
  /**
   * Boards in scope, resolved once. `null` is every board in the company, which
   * keeps the builders reading the same shape as `memberIds` instead of
   * re-querying the company→members→boards chain at each call site.
   */
  boardIds: string[] | null;
}
