export interface OfficeAddressLike {
  label?: string | null;
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isMain?: boolean | null;
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