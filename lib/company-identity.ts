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

export interface IdentityCodeResult {
  code: string;
  remaining: number | null;
}

export async function generateCompanyIdentityCode(companyId: unknown): Promise<IdentityCodeResult> {
  const company = await Company.findById(companyId).select(
    "name identityCodeDigits identityCodeStartRange identityCodeEndRange identityCodeNextNumber",
  );
  const prefix = companyCodePrefix(String(company?.name ?? "COMPANY"));

  const digits = company?.identityCodeDigits;
  const startRange = company?.identityCodeStartRange;
  const endRange = company?.identityCodeEndRange;
  const nextNumber = company?.identityCodeNextNumber;

  if (
    digits != null &&
    startRange != null &&
    endRange != null &&
    nextNumber != null &&
    digits >= 4 &&
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
