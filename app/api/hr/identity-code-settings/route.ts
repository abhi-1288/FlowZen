import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { identityCodeRegionRemaining, identityCodeRegionsOf } from "@/lib/company-identity";
import { mainOfficeLabelOf } from "@/lib/company-regions";

function normalizePrefix(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  const user = await User.findById(userId).select("role company companyStatus regionLabel");
  if (!user) return jsonError("User not found.", 404);

  const isAdmin = user.role === "admin" && String(user.company ?? "").length > 0;
  const isHr = user.role === "human-resource" && user.companyStatus === "approved" && Boolean(user.company);

  if (!isAdmin && !isHr) return jsonError("Only HR or admin can view identity code settings.", 403);

  if (isAdmin && !isHr) {
    const hasHr = await User.findOne({
      company: user.company,
      role: "human-resource",
      companyStatus: "approved",
    }).select("_id");
    if (hasHr) return jsonError("HR exists. Only HR can manage identity code settings.", 403);
  }

  const company = await Company.findById(user.company).select(
    "name identityCodePrefix identityCodeDigits identityCodeStartRange identityCodeEndRange identityCodeNextNumber identityCodeRegions addresses address multiOffice",
  );
  if (!company) return jsonError("Company not found.", 404);

  const remaining =
    company.identityCodeNextNumber != null && company.identityCodeEndRange != null
      ? Math.max(0, company.identityCodeEndRange - company.identityCodeNextNumber)
      : null;

  const regions = identityCodeRegionsOf(company as any).map((region) => ({
    ...region,
    remaining: identityCodeRegionRemaining(region),
  }));
  const addressLabels = Array.isArray((company as any).addresses)
    ? (company as any).addresses.map((a: any) => String(a?.label ?? "").trim()).filter(Boolean)
    : [];
  const mainOfficeLabel = mainOfficeLabelOf({
    addresses: (company as any).addresses,
    address: (company as any).address,
  });
  const canManageRegions = isHr
    ? !mainOfficeLabel ||
      String((user as any).regionLabel ?? "").trim().toLowerCase() === mainOfficeLabel.toLowerCase()
    : true;

  return NextResponse.json({
    prefix: String(company.identityCodePrefix ?? ""),
    digits: company.identityCodeDigits ?? null,
    startRange: company.identityCodeStartRange ?? null,
    endRange: company.identityCodeEndRange ?? null,
    nextNumber: company.identityCodeNextNumber ?? null,
    remaining,
    companyName: company.name,
    regions,
    addressLabels,
    mainOfficeLabel,
    canManageRegions,
  });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus regionLabel");
  if (!user) return jsonError("User not found.", 404);

  const isAdmin = user.role === "admin" && String(user.company ?? "").length > 0;
  const isHr = user.role === "human-resource" && user.companyStatus === "approved" && Boolean(user.company);

  if (!isAdmin && !isHr) return jsonError("Only HR or admin can update identity code settings.", 403);

  if (isAdmin && !isHr) {
    const hasHr = await User.findOne({
      company: user.company,
      role: "human-resource",
      companyStatus: "approved",
    }).select("_id");
    if (hasHr) return jsonError("HR exists. Only HR can manage identity code settings.", 403);
  }

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found.", 404);

  const body = await request.json().catch(() => ({}));
  const hasPrefix = Object.prototype.hasOwnProperty.call(body, "prefix");
  const hasDigits = Object.prototype.hasOwnProperty.call(body, "digits");
  const hasStartRange = Object.prototype.hasOwnProperty.call(body, "startRange");
  const hasEndRange = Object.prototype.hasOwnProperty.call(body, "endRange");
  const hasNextNumber = Object.prototype.hasOwnProperty.call(body, "nextNumber");
  const hasRegions = Object.prototype.hasOwnProperty.call(body, "regions");

  const digits = hasDigits ? Number(body.digits) : company.identityCodeDigits;
  const startRange = hasStartRange ? Number(body.startRange) : company.identityCodeStartRange;
  const endRange = hasEndRange ? Number(body.endRange) : company.identityCodeEndRange;
  const nextNumber = hasNextNumber ? Number(body.nextNumber) : company.identityCodeNextNumber;

  if (hasDigits && digits != null) {
    if (!Number.isFinite(digits) || digits < 3 || digits > 12) {
      return jsonError("Digits must be between 3 and 12.", 400);
    }
  }

  if (hasStartRange && startRange != null && hasEndRange && endRange != null) {
    if (!Number.isFinite(startRange) || !Number.isFinite(endRange)) {
      return jsonError("Invalid range values.", 400);
    }
    if (startRange >= endRange) {
      return jsonError("Start range must be less than end range.", 400);
    }
  } else if (hasStartRange && startRange != null) {
    if (!Number.isFinite(startRange)) {
      return jsonError("Invalid start range.", 400);
    }
    if (endRange != null && startRange >= endRange) {
      return jsonError("Start range must be less than end range.", 400);
    }
  } else if (hasEndRange && endRange != null) {
    if (!Number.isFinite(endRange)) {
      return jsonError("Invalid end range.", 400);
    }
    if (startRange != null && startRange >= endRange) {
      return jsonError("Start range must be less than end range.", 400);
    }
  }

  if (hasNextNumber && nextNumber != null) {
    if (!Number.isFinite(nextNumber)) {
      return jsonError("Invalid next number.", 400);
    }
    if (startRange != null && nextNumber < startRange) {
      return jsonError("Next number cannot be less than start range.", 400);
    }
    if (endRange != null && nextNumber > endRange) {
      return jsonError("Next number cannot be greater than end range.", 400);
    }
  }

  const prefix = hasPrefix ? normalizePrefix(body.prefix) : String(company.identityCodePrefix ?? "");
  if (prefix.length > 24) {
    return jsonError("Prefix must be 24 characters or fewer.", 400);
  }

  if (hasRegions) {
    const currentMainLabel = mainOfficeLabelOf({
      addresses: (company as any).addresses,
      address: (company as any).address,
    });
    const canManage = user.role === "admin"
      ? true
      : user.role === "human-resource" &&
        (!currentMainLabel ||
          String((user as any).regionLabel ?? "").trim().toLowerCase() ===
            currentMainLabel.toLowerCase());
    if (!canManage) {
      return jsonError("Only the main-office HR or admin can manage region ranges.", 403);
    }

    if (!Array.isArray(body.regions)) return jsonError("Regions must be an array.", 400);

    const built: { region: string; startRange: number; endRange: number; nextNumber: number }[] = [];
    if (body.regions.length > 0) {
      const effDigits = digits != null ? digits : company.identityCodeDigits;
      const effStart = startRange != null ? startRange : company.identityCodeStartRange;
      const effEnd = endRange != null ? endRange : company.identityCodeEndRange;
      if (effDigits == null || effStart == null || effEnd == null) {
        return jsonError("Set a digit count and a master start/end range before partitioning by region.", 400);
      }
      const capacity = Math.pow(10, effDigits) - 1;
      const seen = new Map<string, boolean>();
      const normalized: { region: string; startRange: number; endRange: number }[] = [];
      for (const raw of body.regions as any[]) {
        const region = String(raw?.region ?? "").trim();
        const rs = Number(raw?.startRange);
        const re = Number(raw?.endRange);
        if (!region) return jsonError("Every region must have a name.", 400);
        if (!Number.isFinite(rs) || !Number.isFinite(re) || rs < 0 || re < 0) {
          return jsonError(`Invalid range for region "${region}".`, 400);
        }
        if (rs >= re) return jsonError(`Start range must be less than end range for region "${region}".`, 400);
        if (rs < effStart || re < effStart || rs > effEnd || re > effEnd) {
          return jsonError(`Region "${region}" range must be within the master range (${effStart}–${effEnd}).`, 400);
        }
        if (re > capacity) {
          return jsonError(`Region "${region}" end range exceeds the ${effDigits}-digit capacity (${capacity}).`, 400);
        }
        const key = region.toLowerCase();
        if (seen.has(key)) return jsonError(`Region "${region}" appears more than once.`, 400);
        seen.set(key, true);
        normalized.push({ region, startRange: rs, endRange: re });
      }
      const sorted = [...normalized].sort((a, b) => a.startRange - b.startRange);
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i - 1].endRange >= sorted[i].startRange) {
          return jsonError(`Region ranges for "${sorted[i - 1].region}" and "${sorted[i].region}" overlap.`, 400);
        }
      }
      const existingMap = new Map<string, { startRange: number; endRange: number; nextNumber: number }>();
      for (const region of identityCodeRegionsOf(company as any)) {
        existingMap.set(String(region.region).trim().toLowerCase(), region);
      }
      for (const item of normalized) {
        const existing = existingMap.get(item.region.toLowerCase());
        let next = Number(existing?.nextNumber ?? item.startRange);
        if (next < item.startRange || next > item.endRange) next = item.startRange;
        built.push({ region: item.region, startRange: item.startRange, endRange: item.endRange, nextNumber: next });
      }
    }
    company.identityCodeRegions = built;

    let globalNext = company.identityCodeNextNumber;
    if (globalNext != null) {
      let moved = true;
      let guard = 0;
      while (moved && guard < 20) {
        moved = false;
        for (const partition of built) {
          if (globalNext >= partition.startRange && globalNext <= partition.endRange) {
            globalNext = partition.endRange + 1;
            moved = true;
          }
        }
        guard += 1;
      }
      if (globalNext !== company.identityCodeNextNumber) company.identityCodeNextNumber = globalNext;
    }
  }

  const configChanged =
    (hasDigits && digits !== company.identityCodeDigits) ||
    (hasStartRange && startRange !== company.identityCodeStartRange) ||
    (hasEndRange && endRange !== company.identityCodeEndRange);

  if (hasPrefix) company.identityCodePrefix = prefix;
  if (hasDigits) company.identityCodeDigits = digits;
  if (hasStartRange) company.identityCodeStartRange = startRange;
  if (hasEndRange) company.identityCodeEndRange = endRange;

  if (configChanged && !hasNextNumber) {
    company.identityCodeNextNumber = startRange;
  } else if (hasNextNumber) {
    company.identityCodeNextNumber = nextNumber;
  }

  await company.save();

  const remaining =
    company.identityCodeNextNumber != null && company.identityCodeEndRange != null
      ? Math.max(0, company.identityCodeEndRange - company.identityCodeNextNumber)
      : null;

  return NextResponse.json({
    ok: true,
    prefix: String(company.identityCodePrefix ?? ""),
    digits: company.identityCodeDigits ?? null,
    startRange: company.identityCodeStartRange ?? null,
    endRange: company.identityCodeEndRange ?? null,
    nextNumber: company.identityCodeNextNumber ?? null,
    remaining,
    regions: identityCodeRegionsOf(company as any).map((region) => ({
      ...region,
      remaining: identityCodeRegionRemaining(region),
    })),
    addressLabels: Array.isArray((company as any).addresses)
      ? (company as any).addresses.map((a: any) => String(a?.label ?? "").trim()).filter(Boolean)
      : [],
    mainOfficeLabel: mainOfficeLabelOf({
      addresses: (company as any).addresses,
      address: (company as any).address,
    }),
    canManageRegions: user.role === "admin"
      ? true
      : user.role === "human-resource" &&
        (!mainOfficeLabelOf({
          addresses: (company as any).addresses,
          address: (company as any).address,
        }) ||
          String((user as any).regionLabel ?? "").trim().toLowerCase() ===
            mainOfficeLabelOf({
              addresses: (company as any).addresses,
              address: (company as any).address,
            }).toLowerCase()),
  });
}
