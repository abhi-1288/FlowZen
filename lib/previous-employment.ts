import { Company } from "@/models/Company";
import { effectiveRegionLabelOf } from "@/lib/company-regions";

export type PreviousEmployment = {
  companyId: string;
  companyName: string;
  region: string;
  role: string;
  employmentType: string;
  joined: string | null;
  ended: string | null;
};

type HistoryEntry = {
  action?: unknown;
  company?: unknown;
  at?: unknown;
};

type Candidate = {
  _id?: unknown;
  company?: unknown;
  companyStatus?: unknown;
  role?: unknown;
  regionLabel?: unknown;
  employmentType?: unknown;
  employmentEndDate?: unknown;
  membershipHistory?: unknown;
};

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Summarise the employment a member finished, so their profile can show real
 * history instead of the "Not set" / "none" noise the disconnect leaves behind.
 *
 * The disconnect nulls `company`, `companyJoined` and `companyStatus`, so the
 * start date has to come from the `joined-company` entry in `membershipHistory`.
 * The end date comes from `employmentEndDate` rather than the history entry,
 * because the `contract-expired` entry is stamped with the cron run time, not
 * the last working day.
 *
 * Returns null while the user is still an active approved member.
 */
export async function previousEmploymentForUser(user: Candidate | null | undefined): Promise<PreviousEmployment | null> {
  if (!user) return null;
  if (user.company && user.companyStatus === "approved") return null;

  const history: HistoryEntry[] = Array.isArray(user.membershipHistory)
    ? (user.membershipHistory as HistoryEntry[])
    : [];
  const joinedEntries = history.filter((entry) => String(entry?.action ?? "") === "joined-company");
  const lastJoin = joinedEntries[joinedEntries.length - 1];
  const companyId = lastJoin?.company ?? history[history.length - 1]?.company ?? null;
  if (!companyId) return null;

  const company = (await Company.findById(companyId as string)
    .select("name addresses")
    .lean()) as { name?: string; addresses?: unknown[] } | null;
  if (!company) return null;

  // `AddressCarrier` is module-private, so reach it through the signature.
  type CompanyArg = Parameters<typeof effectiveRegionLabelOf>[0];
  const region = effectiveRegionLabelOf(company as unknown as CompanyArg, {
    regionLabel: String(user.regionLabel ?? ""),
  });

  return {
    companyId: String(companyId),
    companyName: String(company.name ?? "Previous company"),
    region: region || "Main office",
    role: String(user.role ?? ""),
    employmentType: String(user.employmentType ?? ""),
    joined: toIso(lastJoin?.at),
    ended: toIso(user.employmentEndDate),
  };
}
