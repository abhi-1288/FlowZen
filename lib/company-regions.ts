export interface OfficeAddressLike {
  label?: string | null;
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isMain?: boolean | null;
  hrs?: unknown[] | null;
  admins?: unknown[] | null;
  hrHead?: unknown | null;
  adminHead?: unknown | null;
  maxHrs?: number | null;
  maxAdmins?: number | null;
  /** HR/Admin heads the main office has authorised to run this region's pipeline. */
  pipelineManagers?: unknown[] | null;
  createdBy?: unknown | null;
}

type AddressesCarrier = { addresses?: OfficeAddressLike[] | null };
type AddressCarrier = AddressesCarrier & { address?: string | null };

function addressListOf(company: AddressesCarrier | null): OfficeAddressLike[] {
  return Array.isArray(company?.addresses) ? (company.addresses as OfficeAddressLike[]) : [];
}

export function addressLabelsOf(company: AddressesCarrier | null): string[] {
  return addressListOf(company).map((a) => String(a?.label ?? "").trim()).filter(Boolean);
}

export function mainOfficeLabelOf(company: AddressCarrier | null): string {
  const addresses = addressListOf(company);
  const main = addresses.find((a) => Boolean(a?.isMain));
  const label = String((main ?? addresses[0])?.label ?? "").trim();
  if (label) return label;
  return String(company?.address ?? "").trim() ? "Main Office" : "";
}

export function regionLabelsOf(company: AddressCarrier | null): string[] {
  const labels = addressLabelsOf(company);
  if (labels.length > 0) return labels;
  const main = mainOfficeLabelOf(company);
  return main ? [main] : [];
}

export function isMainOfficeLabel(
  company: AddressesCarrier | null,
  label: string | null | undefined
): boolean {
  const raw = String(label ?? "").trim();
  if (!raw) return false;
  const addresses = addressListOf(company);
  const entry = addresses.find(
    (a) => String(a?.label ?? "").trim().toLowerCase() === raw.toLowerCase()
  );
  if (!entry) return false;
  const hasExplicitMain = addresses.some((a) => Boolean(a?.isMain));
  return hasExplicitMain ? Boolean(entry.isMain) : addresses.indexOf(entry) === 0;
}

/**
 * The region helper is read-only: it answers "does this actor sit in the main
 * office", and says nothing about what role they hold. Call sites compose their
 * own role policy on top, because the three main-office gates legitimately differ
 * — company-wide staffing caps are an admin power, while delegating a region's
 * recruitment pipeline must exclude a regional admin so a region cannot grant
 * itself the authority the main office handed down.
 */
export function isMainOfficeRegion(
  company: AddressCarrier | null,
  actor: { regionLabel?: string | null } | null | undefined,
): boolean {
  if (!actor) return false;
  // `effectiveRegionLabelOf` falls back to the main office when the member has no
  // `regionLabel`, and a label naming a deleted office resolves to nothing. All
  // three mean "not in any region", which is the main office. Reading
  // `actor.regionLabel` raw instead — which is what this replaced — silently
  // excluded every main-office member who had never been assigned a region, so
  // the one person who most obviously outranks a regional head could not act for
  // them.
  const region = effectiveRegionLabelOf(company, actor);
  if (!region) return true;
  if (!regionEntryOf(company, region)) return true;
  return isMainOfficeLabel(company, region);
}

export function withMainOfficeSuffix(
  company: AddressesCarrier | null,
  label: string | null | undefined
): string {
  const raw = String(label ?? "").trim();
  if (!raw || raw.toLowerCase() === "main office") return raw;
  return isMainOfficeLabel(company, raw) ? `${raw} (Main Office)` : raw;
}

export function withMainOfficeSuffixByLabel(
  mainLabel: string | null | undefined,
  label: string | null | undefined
): string {
  const raw = String(label ?? "").trim();
  if (!raw || raw.toLowerCase() === "main office") return raw;
  const main = String(mainLabel ?? "").trim();
  return main && main.toLowerCase() === raw.toLowerCase() ? `${raw} (Main Office)` : raw;
}

export interface RegionManagerCaps {
  maxHrs: number;
  maxAdmins: number;
}

export function regionManagerCaps(
  company: { regionMaxHrs?: number | null; regionMaxAdmins?: number | null } | null,
  entry: OfficeAddressLike | null | undefined
): RegionManagerCaps {
  const defaultMaxHrs = Math.max(1, Number(company?.regionMaxHrs ?? 5) || 5);
  const defaultMaxAdmins = Math.max(1, Number(company?.regionMaxAdmins ?? 2) || 2);
  const maxHrs = entry?.maxHrs != null ? Math.max(1, Number(entry.maxHrs)) : defaultMaxHrs;
  const maxAdmins = entry?.maxAdmins != null ? Math.max(1, Number(entry.maxAdmins)) : defaultMaxAdmins;
  return { maxHrs, maxAdmins };
}

export function regionStaffingOf(entry: OfficeAddressLike | null | undefined): {
  hrs: string[];
  admins: string[];
  hrHead: string;
  adminHead: string;
} {
  const ids = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((v) => String(v ?? "")).filter(Boolean) : [];
  return {
    hrs: ids(entry?.hrs),
    admins: ids(entry?.admins),
    hrHead: entry?.hrHead ? String(entry.hrHead) : "",
    adminHead: entry?.adminHead ? String(entry.adminHead) : "",
  };
}

export function isRegionStaffed(entry: OfficeAddressLike | null | undefined): boolean {
  const staffing = regionStaffingOf(entry);
  return Boolean(staffing.hrHead && staffing.adminHead);
}

/**
 * Users the main office has delegated this region's recruitment pipeline to.
 *
 * Kept separate from `hrs[]` / `admins[]` on purpose. Staffing answers "who works
 * here"; this answers "who may raise requisitions and run assessments for this
 * region", which the main office grants deliberately and revokes by emptying the
 * list. Folding it into the roster would make a delegation impossible to withdraw
 * without also un-staffing the person and breaking the org chart.
 */
export function regionPipelineManagerIdsOf(entry: OfficeAddressLike | null | undefined): string[] {
  return Array.isArray(entry?.pipelineManagers)
    ? entry!.pipelineManagers!.map((v) => String(v ?? "")).filter(Boolean)
    : [];
}

/**
 * Roles that may be assigned as the approver of a document letter / ID card
 * request. Kept here so the picker, the request endpoints and the auto-assign
 * fallback never drift apart.
 */
export const DOCUMENT_LETTER_APPROVER_ROLES = [
  "human-resource",
  "finance",
  "admin",
  "project-manager",
  "qa-tester",
  "it-admin",
] as const;

export type DocumentLetterApproverRole = (typeof DOCUMENT_LETTER_APPROVER_ROLES)[number];

type RegionLabelCarrier = { regionLabel?: string | null };

/**
 * A member's effective region: their own `regionLabel`, falling back to the
 * main office when unset. Mirrors the read-side fallback in
 * `app/api/profile/route.ts` so pickers and queries agree on the region.
 */
export function effectiveRegionLabelOf(
  company: AddressCarrier | null,
  user: RegionLabelCarrier | null | undefined,
): string {
  const own = String(user?.regionLabel ?? "").trim();
  if (own) return own;
  return mainOfficeLabelOf(company);
}

/** The `addresses[]` entry for a region label (case-insensitive). */
export function regionEntryOf(
  company: AddressesCarrier | null,
  label: string | null | undefined,
): OfficeAddressLike | null {
  const raw = String(label ?? "").trim();
  if (!raw) return null;
  return (
    addressListOf(company).find(
      (a) => String(a?.label ?? "").trim().toLowerCase() === raw.toLowerCase(),
    ) ?? null
  );
}

/**
 * The literal string `mainOfficeLabelOf` returns for a company that predates
 * `addresses[]` and only carries the legacy `address` string. Members assigned
 * a region while their company was in that state got this stored as their
 * `regionLabel`, so it has to be read as a placeholder rather than as the name
 * of a real office.
 */
export const LEGACY_MAIN_OFFICE_LABEL = "main office";

/**
 * True when `label` is that legacy placeholder rather than a real office name —
 * it reads "Main Office" while the company actually has a differently labelled
 * address.
 *
 * Deliberately narrow. A company whose office genuinely is called "Main Office"
 * is not a placeholder, and neither is a company with no labelled address at
 * all, where `mainOfficeLabelOf` returns the same string anyway and the two
 * readings agree.
 */
export function isLegacyMainOfficeLabel(
  company: AddressesCarrier | null,
  label: string | null | undefined,
): boolean {
  const raw = String(label ?? "").trim();
  if (raw.toLowerCase() !== LEGACY_MAIN_OFFICE_LABEL) return false;
  const actual = mainOfficeLabelOf(company as AddressCarrier | null);
  return Boolean(actual) && actual.toLowerCase() !== raw.toLowerCase();
}

/**
 * The `addresses[]` entry backing a member's region.
 *
 * `effectiveRegionLabelOf` hands back the member's stored `regionLabel`
 * whenever it is set, so a label left over from before the office was named
 * resolves to nothing at all — the org chart then silently loses that region's
 * HR and admin head. This resolves the placeholder to the main office instead.
 *
 * A genuinely unknown label still resolves to `null` rather than to the main
 * office: guessing there would show the wrong region's heads, which is worse
 * than showing none.
 */
export function regionEntryForMember(
  company: AddressesCarrier | null,
  user: RegionLabelCarrier | null | undefined,
): OfficeAddressLike | null {
  const own = String(user?.regionLabel ?? "").trim();
  if (own) {
    const match = regionEntryOf(company, own);
    if (match) return match;
    if (isLegacyMainOfficeLabel(company, own)) {
      return regionEntryOf(company, mainOfficeLabelOf(company as AddressCarrier | null));
    }
    return null;
  }
  return regionEntryOf(company, mainOfficeLabelOf(company as AddressCarrier | null));
}

/**
 * Every user id explicitly staffed in a region: its HR head, HR staff, admin
 * head and admin staff. Union of the two region signals — this roster plus
 * `User.regionLabel` — is what "same region" means elsewhere, because either
 * can be populated without the other.
 */
export function regionStaffIdsOf(company: AddressesCarrier | null, label: string | null | undefined): string[] {
  const entry = regionEntryOf(company, label);
  if (!entry) return [];
  const staffing = regionStaffingOf(entry);
  return Array.from(new Set([...staffing.hrs, ...staffing.admins, staffing.hrHead, staffing.adminHead].filter(Boolean)));
}

/**
 * Every user's id who heads a region — its `hrHead` or `adminHead` — across
 * all of the company's regions.
 *
 * Narrower than `regionStaffIdsOf`: that one also returns the wider `hrs[]` /
 * `admins[]` rosters, which is right for deciding who belongs to a region but
 * too broad for granting cross-region reach. A staff member administers one
 * region; a head is the one accountable for it, so only the heads get to look
 * past their own boundary.
 */
export function regionHeadIdsOf(company: AddressesCarrier | null): string[] {
  const heads: string[] = [];
  for (const entry of addressListOf(company)) {
    const staffing = regionStaffingOf(entry);
    if (staffing.hrHead) heads.push(staffing.hrHead);
    if (staffing.adminHead) heads.push(staffing.adminHead);
  }
  return Array.from(new Set(heads));
}

/** True when `userId` heads any region of the company. */
export function isRegionHeadOfAny(
  company: AddressesCarrier | null,
  userId: unknown,
): boolean {
  const id = String(userId ?? "");
  if (!id) return false;
  return regionHeadIdsOf(company).includes(id);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mongo clause matching "in this region": the member's own `regionLabel`
 * equals the region (case-insensitive, using the same escaped-regex idiom as
 * `app/api/hr/identity-code-range/route.ts`), OR they are staffed in the
 * region's `addresses[]` entry.
 */
export function regionApproverClause(
  company: AddressesCarrier | null,
  label: string | null | undefined,
): Record<string, unknown> | null {
  const raw = String(label ?? "").trim();
  if (!raw) return null;

  const or: Record<string, unknown>[] = [
    { regionLabel: { $regex: `^${escapeRegex(raw)}$`, $options: "i" } },
  ];
  const staffIds = regionStaffIdsOf(company, raw);
  if (staffIds.length > 0) or.push({ _id: { $in: staffIds } });

  return or.length === 1 ? or[0] : { $or: or };
}

/**
 * `regionApproverClause` widened with the main-office fallback, for
 * document-letter co-approvers.
 *
 * `app/api/profile` already displays the main office for a member with no
 * stored `regionLabel`, so treating such a member as region-less made the
 * profile and the letter validator disagree. When the region *is* the main
 * office, an unset `regionLabel` now counts as a match.
 *
 * The widening is applied only when the label equals `mainOfficeLabelOf` —
 * exactly the value `effectiveRegionLabelOf` substitutes — so this stays
 * symmetric with `isUserInEffectiveRegion`, which is what the validator uses.
 * That symmetry is the whole point: a picker that offers someone the
 * validator then rejects is the bug this fixes.
 *
 * Deliberately not folded into `regionApproverClause`: the join and ID-card
 * flows depend on that one staying strict.
 */
export function effectiveRegionApproverClause(
  company: AddressesCarrier | null,
  label: string | null | undefined,
): Record<string, unknown> | null {
  const raw = String(label ?? "").trim();
  if (!raw) return null;
  const base = regionApproverClause(company, raw);
  if (!base) return null;

  const main = mainOfficeLabelOf(company as AddressCarrier | null);
  if (!main || main.toLowerCase() !== raw.toLowerCase()) return base;

  const or: Record<string, unknown>[] = Array.isArray(base.$or) ? [...base.$or] : [base];
  or.push({ regionLabel: { $in: ["", null] } });
  or.push({ regionLabel: { $exists: false } });
  return { $or: or };
}

/** True when `user` belongs to `regionLabel` by either signal. */
export function isUserInRegion(
  company: AddressesCarrier | null,
  regionLabel: string | null | undefined,
  user: (RegionLabelCarrier & { _id?: unknown }) | null | undefined,
): boolean {
  const raw = String(regionLabel ?? "").trim();
  if (!raw || !user) return false;
  if (String(user.regionLabel ?? "").trim().toLowerCase() === raw.toLowerCase()) return true;
  return regionStaffIdsOf(company, raw).includes(String(user._id ?? ""));
}

/**
 * `isUserInRegion` with the caller's own empty-`regionLabel` resolved to the
 * main office first. Use this when judging a *requester*'s region (e.g. scoping
 * the approvals inbox) so members without a region are not silently hidden.
 * Keep the strict variant for judging *approvers*, where an unset region should
 * not count as a match.
 */
export function isUserInEffectiveRegion(
  company: AddressesCarrier | null,
  regionLabel: string | null | undefined,
  user: (RegionLabelCarrier & { _id?: unknown }) | null | undefined,
): boolean {
  if (!user) return false;
  return isUserInRegion(company, regionLabel, {
    _id: user._id,
    regionLabel: effectiveRegionLabelOf(company as AddressCarrier | null, user),
  });
}
