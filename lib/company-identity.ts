import { Company } from "@/models/Company";
import { User } from "@/models/User";

function companyCodePrefix(name: string) {
  const cleaned = String(name ?? "COMPANY")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "COMPANY";
}

export async function generateCompanyIdentityCode(companyId: unknown) {
  const company = await Company.findById(companyId).select("name");
  const prefix = companyCodePrefix(String(company?.name ?? "COMPANY"));

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const digits = Math.floor(10_000_000 + Math.random() * 90_000_000);
    const code = `${prefix}-${digits}`;
    const existing = await User.exists({ companyIdentityCode: code });
    if (!existing) return code;
  }

  throw new Error("Could not generate a unique company identity code.");
}

export async function ensureCompanyIdentityCode(user: any, companyId: unknown) {
  if (String(user.companyIdentityCode ?? "").trim()) return user.companyIdentityCode;
  user.companyIdentityCode = await generateCompanyIdentityCode(companyId);
  return user.companyIdentityCode;
}
