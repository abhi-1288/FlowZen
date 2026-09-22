import { Company } from "@/models/Company";
import { User } from "@/models/User";

export function companyCodePrefix(name: string) {
  const cleaned = String(name ?? "COMPANY")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "COMPANY";
}

export function identityCodePrefixOf(company: {
  name?: string;
  identityCodePrefix?: string | null;
} | null): string {
  const custom = String(company?.identityCodePrefix ?? "").trim();
  return custom || companyCodePrefix(String(company?.name ?? "COMPANY"));
}

export interface IdentityCodeResult {
  code: string;
  remaining: number | null;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

const REUSE_GAP_DAYS = 30;

export async function recordIdentityCodeRelease(
  companyId: unknown,
  code: string | undefined | null,
  exitDate: Date,
): Promise<void> {
  const trimmed = String(code ?? "").trim();
  if (!trimmed || !companyId) return;
  await Company.updateOne({ _id: companyId }, { $pull: { identityCodeReleased: { code: trimmed } } });
  await Company.updateOne(
    { _id: companyId },
    {
      $push: {
        identityCodeReleased: {
          code: trimmed,
          exitDate,
          releaseDate: addDays(exitDate, REUSE_GAP_DAYS),
        },
      },
    },
  );
}

export function numericPartOf(code: string): number {
  const last = String(code ?? "").trim().split("-").pop() ?? "";
  const n = Number(last);
  return Number.isFinite(n) ? n : NaN;
}

export interface IdentityCodeRegion {
  region: string;
  startRange: number;
  endRange: number;
  nextNumber: number;
}

function regionMatchKey(region: string): string {
  return String(region ?? "").trim().toLowerCase();
}

function regionContains(
  region: { startRange?: number; endRange?: number },
  number: number,
): boolean {
  return (
    region.startRange != null &&
    region.endRange != null &&
    number >= region.startRange &&
    number <= region.endRange
  );
}

export async function generateCompanyIdentityCode(
  companyId: unknown,
  opts?: { region?: string },
): Promise<IdentityCodeResult> {
  const company = await Company.findById(companyId).select(
    "name identityCodePrefix identityCodeDigits identityCodeStartRange identityCodeEndRange identityCodeNextNumber identityCodeReleased identityCodeRegions",
  );
  const prefix = identityCodePrefixOf(company);

  const digits = company?.identityCodeDigits;
  const startRange = company?.identityCodeStartRange;
  const endRange = company?.identityCodeEndRange;
  const nextNumber = company?.identityCodeNextNumber;

  const regions: IdentityCodeRegion[] = Array.isArray(company?.identityCodeRegions)
    ? (company.identityCodeRegions as IdentityCodeRegion[]).filter(
        (r) => r?.region && r.startRange != null && r.endRange != null,
      )
    : [];
  const targetRegion = String(opts?.region ?? "").trim();
  const targetMatch = regions.find(
    (r) => regionMatchKey(r.region) === regionMatchKey(targetRegion),
  );

  const now = new Date();
  const releasedPool = Array.isArray(company?.identityCodeReleased)
    ? (company.identityCodeReleased as { code?: string; exitDate?: Date; releaseDate?: Date }[])
        .filter((r) => r?.code && r.releaseDate && new Date(r.releaseDate) <= now)
        .sort((a, b) => new Date(a.exitDate ?? 0).getTime() - new Date(b.exitDate ?? 0).getTime())
    : [];
  if (releasedPool.length > 0) {
    for (const entry of releasedPool) {
      const code = String(entry.code);
      const numeric = numericPartOf(code);
      if (targetMatch) {
        if (!regionContains(targetMatch, numeric)) continue;
      } else if (regions.some((r) => regionContains(r, numeric))) {
        continue;
      }
      if (code && !(await User.exists({ companyIdentityCode: code }))) {
        await Company.updateOne({ _id: companyId }, { $pull: { identityCodeReleased: { code } } });
        return { code, remaining: null };
      }
      await Company.updateOne({ _id: companyId }, { $pull: { identityCodeReleased: { code } } });
    }
  }

  if (
    digits != null &&
    startRange != null &&
    endRange != null &&
    nextNumber != null &&
    digits >= 3 &&
    digits <= 12 &&
    endRange > startRange
  ) {
    if (targetMatch) {
      const regionNext = targetMatch.nextNumber != null ? targetMatch.nextNumber : targetMatch.startRange;
      if (regionNext > targetMatch.endRange) {
        throw new Error(
          `Identity code range for "${targetMatch.region}" is exhausted (ends at ${targetMatch.endRange}). Request an increase from the main-office HR/Admin.`,
        );
      }
      const code = `${prefix}-${String(regionNext).padStart(digits, "0")}`;
      const remaining = targetMatch.endRange - regionNext;
      await Company.updateOne(
        { _id: companyId, "identityCodeRegions.region": targetMatch.region },
        { $set: { "identityCodeRegions.$.nextNumber": regionNext + 1 } },
      );
      return { code, remaining: remaining - 1 };
    }

    let globalNext = nextNumber;
    while (regions.some((r) => regionContains(r, globalNext))) {
      const overlapping = regions
        .filter((r) => regionContains(r, globalNext))
        .reduce((max, r) => Math.max(max, r.endRange), globalNext);
      globalNext = overlapping + 1;
    }

    if (globalNext > endRange) {
      throw new Error("Identity code range exhausted. Please increase the range in settings.");
    }

    const code = `${prefix}-${String(globalNext).padStart(digits, "0")}`;
    const remaining = endRange - globalNext;

    await Company.updateOne(
      { _id: companyId },
      { $set: { identityCodeNextNumber: globalNext + 1 } },
    );

    return { code, remaining: remaining - 1 };
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomDigits = Math.floor(10_000_000 + Math.random() * 90_000_000);
    const code = `${prefix}-${randomDigits}`;
    const existing = await User.exists({ companyIdentityCode: code });
    if (!existing) return { code, remaining: null };
  }

  throw new Error("Could not generate a unique company identity code.");
}

export async function ensureCompanyIdentityCode(user: any, companyId: unknown): Promise<IdentityCodeResult> {
  if (String(user.companyIdentityCode ?? "").trim()) {
    return { code: user.companyIdentityCode, remaining: null };
  }
  const result = await generateCompanyIdentityCode(companyId, {
    region: String(user.regionLabel ?? ""),
  });
  user.companyIdentityCode = result.code;
  return result;
}

export function identityCodeRegionsOf(company: {
  identityCodeRegions?: IdentityCodeRegion[];
} | null): IdentityCodeRegion[] {
  const regions = Array.isArray(company?.identityCodeRegions)
    ? (company?.identityCodeRegions as IdentityCodeRegion[])
    : [];
  return regions
    .filter((r) => r?.region)
    .map((r) => ({
      region: String(r.region),
      startRange: Number(r.startRange ?? 0),
      endRange: Number(r.endRange ?? 0),
      nextNumber: Number(r.nextNumber ?? r.startRange ?? 0),
    }))
    .sort((a, b) => a.startRange - b.startRange);
}

export function identityCodeRegionRemaining(
  region: IdentityCodeRegion | undefined,
): number | null {
  if (!region || region.endRange == null || region.nextNumber == null) return null;
  return Math.max(0, region.endRange - region.nextNumber);
}

export async function getIdentityCodeRemaining(companyId: unknown): Promise<number | null> {
  const company = await Company.findById(companyId).select(
    "identityCodeDigits identityCodeStartRange identityCodeEndRange identityCodeNextNumber",
  );
  if (
    company?.identityCodeDigits == null ||
    company?.identityCodeStartRange == null ||
    company?.identityCodeEndRange == null ||
    company?.identityCodeNextNumber == null
  ) {
    return null;
  }
  const remaining = company.identityCodeEndRange - company.identityCodeNextNumber;
  return remaining >= 0 ? remaining : 0;
}
