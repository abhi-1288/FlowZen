import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { COMPANY_PALETTE } from "@/lib/theme";
import { recordAudit } from "@/lib/audit";

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (user.role !== "admin" && user.role !== "human-resource") return jsonError("Only admins and HR can update the company theme.", 403);
  if (!user.company) return jsonError("You must have a registered company.");

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const company = await Company.findById(companyId);
  if (!company) return jsonError("Company not found.", 404);

  if (body.primaryColor !== undefined) {
    const primaryColor = String(body.primaryColor ?? "").trim();
    const validHex = COMPANY_PALETTE.some((c) => c.hex === primaryColor);
    if (!validHex) return jsonError("Invalid colour. Choose from the available palette.");
    company.primaryColor = primaryColor;
  }

  if (body.supportEmail !== undefined) {
    company.supportEmail = String(body.supportEmail ?? "").trim();
  }

  if (body.website !== undefined) {
    company.website = String(body.website ?? "").trim();
  }

  await recordAudit({
    action: "company.settings.change",
    actionLabel: "Company theme updated",
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    to: {
      primaryColor: body.primaryColor !== undefined ? String(body.primaryColor ?? "").trim() : company.primaryColor,
      supportEmail: body.supportEmail !== undefined ? String(body.supportEmail ?? "").trim() : company.supportEmail,
      website: body.website !== undefined ? String(body.website ?? "").trim() : company.website,
    },
    result: "success",
    request,
  });

  await company.save();

  return NextResponse.json({
    primaryColor: company.primaryColor,
    supportEmail: company.supportEmail,
    website: company.website,
  });
}
