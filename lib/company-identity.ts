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

export async function generateCompanyIdentityCode(companyId: unknown): Promise<IdentityCodeResult> {
  const company = await Company.findById(companyId).select(
    "name identityCodePrefix identityCodeDigits identityCodeStartRange identityCodeEndRange identityCodeNextNumber identityCodeReleased",
  );
  const prefix = identityCodePrefixOf(company);

  const digits = company?.identityCodeDigits;
  const startRange = company?.identityCodeStartRange;
  const endRange = company?.identityCodeEndRange;
  const nextNumber = company?.identityCodeNextNumber;

  const now = new Date();
  const released = Array.isArray(company?.identityCodeReleased)
    ? (company.identityCodeReleased as { code?: string; exitDate?: Date; releaseDate?: Date }[])
        .filter((r) => r?.code && r.releaseDate && new Date(r.releaseDate) <= now)
        .sort((a, b) => new Date(a.exitDate ?? 0).getTime() - new Date(b.exitDate ?? 0).getTime())
    : [];
  if (released.length > 0) {
    for (const entry of released) {
      const code = String(entry.code);
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
    if (nextNumber > endRange) {
      throw new Error("Identity code range exhausted. Please increase the range in settings.");
    }

    const code = `${prefix}-${String(nextNumber).padStart(digits, "0")}`;
    const remaining = endRange - nextNumber;

    await Company.updateOne(
      { _id: companyId },
      { $set: { identityCodeNextNumber: nextNumber + 1 } },
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
  const result = await generateCompanyIdentityCode(companyId);
  user.companyIdentityCode = result.code;
  return result;
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
