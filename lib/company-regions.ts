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