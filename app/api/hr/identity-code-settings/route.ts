import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";

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
    "name identityCodeDigits identityCodeStartRange identityCodeEndRange identityCodeNextNumber",
  );
  if (!company) return jsonError("Company not found.", 404);

  const remaining =
    company.identityCodeNextNumber != null && company.identityCodeEndRange != null
      ? Math.max(0, company.identityCodeEndRange - company.identityCodeNextNumber)
      : null;

  return NextResponse.json({
    digits: company.identityCodeDigits ?? null,
    startRange: company.identityCodeStartRange ?? null,
    endRange: company.identityCodeEndRange ?? null,
    nextNumber: company.identityCodeNextNumber ?? null,
    remaining,
    companyName: company.name,
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

  const user = await User.findById(userId).select("role company companyStatus");
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
  const hasDigits = Object.prototype.hasOwnProperty.call(body, "digits");
  const hasStartRange = Object.prototype.hasOwnProperty.call(body, "startRange");
  const hasEndRange = Object.prototype.hasOwnProperty.call(body, "endRange");
  const hasNextNumber = Object.prototype.hasOwnProperty.call(body, "nextNumber");

  const digits = hasDigits ? Number(body.digits) : company.identityCodeDigits;
  const startRange = hasStartRange ? Number(body.startRange) : company.identityCodeStartRange;
  const endRange = hasEndRange ? Number(body.endRange) : company.identityCodeEndRange;
  const nextNumber = hasNextNumber ? Number(body.nextNumber) : company.identityCodeNextNumber;

  if (hasDigits && digits != null) {
    if (!Number.isFinite(digits) || digits < 4 || digits > 12) {
      return jsonError("Digits must be between 4 and 12.", 400);
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

  const configChanged =
    (hasDigits && digits !== company.identityCodeDigits) ||
    (hasStartRange && startRange !== company.identityCodeStartRange) ||
    (hasEndRange && endRange !== company.identityCodeEndRange);

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
    digits: company.identityCodeDigits ?? null,
    startRange: company.identityCodeStartRange ?? null,
    endRange: company.identityCodeEndRange ?? null,
    nextNumber: company.identityCodeNextNumber ?? null,
    remaining,
  });
}
