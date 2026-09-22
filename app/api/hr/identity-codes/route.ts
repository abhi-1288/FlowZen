import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { identityCodePrefixOf, identityCodeRegionRemaining, identityCodeRegionsOf } from "@/lib/company-identity";
import { mainOfficeLabelOf } from "@/lib/company-regions";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus");
  if (!user) return jsonError("User not found.", 404);

  const isHrAdmin =
    user.role === "admin" ||
    (user.role === "human-resource" && user.companyStatus === "approved");

  if (!isHrAdmin || !user.company) {
    return jsonError("Only HR or admin can view identity codes.", 403);
  }

  const company = await Company.findById(user.company).select(
    "name identityCodePrefix identityCodeDigits identityCodeStartRange identityCodeEndRange identityCodeNextNumber identityCodeReleased identityCodeRegions addresses address multiOffice",
  );
  if (!company) return jsonError("Company not found.", 404);

  const members = await User.find({
    company: user.company,
    companyIdentityCode: { $nin: [null, ""] },
  })
    .select("name role customRole isSeniorSecurity regionLabel companyIdentityCode")
    .lean();

  const assigned: Record<
    string,
    { name: string; role: string; customRole: string; isSeniorSecurity: boolean; regionLabel: string }
  > = {};
  for (const member of members as any[]) {
    const code = String(member.companyIdentityCode ?? "").trim();
    if (!code) continue;
    assigned[code] = {
      name: String(member.name ?? ""),
      role: String(member.role ?? "employee"),
      customRole: String(member.customRole ?? ""),
      isSeniorSecurity: Boolean((member as any).isSeniorSecurity),
      regionLabel: String(member.regionLabel ?? ""),
    };
  }

  const released = Array.isArray(company.identityCodeReleased)
    ? (company.identityCodeReleased as { code?: string; exitDate?: Date; releaseDate?: Date }[])
        .map((r) => ({
          code: String(r.code ?? ""),
          exitDate: r.exitDate ? new Date(r.exitDate).toISOString() : null,
          releaseDate: r.releaseDate ? new Date(r.releaseDate).toISOString() : null,
        }))
        .reverse()
        .slice(0, 500)
    : [];

  const digits = company.identityCodeDigits ?? null;
  const startRange = company.identityCodeStartRange ?? null;
  const endRange = company.identityCodeEndRange ?? null;
  const nextNumber = company.identityCodeNextNumber ?? null;

  const remaining =
    nextNumber != null && endRange != null ? Math.max(0, endRange - nextNumber) : null;

  const regions = identityCodeRegionsOf(company as any).map((region) => ({
    ...region,
    remaining: identityCodeRegionRemaining(region),
  }));
  const mainOfficeLabel = mainOfficeLabelOf({
    addresses: (company as any).addresses,
    address: (company as any).address,
  });

  return NextResponse.json({
    prefix: identityCodePrefixOf(company),
    customPrefix: String(company.identityCodePrefix ?? ""),
    digits,
    startRange,
    endRange,
    nextNumber,
    remaining,
    released,
    assigned,
    regions,
    mainOfficeLabel,
    addressLabels: Array.isArray((company as any).addresses)
      ? (company as any).addresses.map((a: any) => String(a?.label ?? "").trim()).filter(Boolean)
      : [],
    companyName: String(company.name ?? ""),
  });
}