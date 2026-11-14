import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { regionApproverClause } from "@/lib/company-regions";

/**
 * Region-scoped admins for the "Approve and forward to admin" picker in the
 * record-removal flow. Mirrors the scoping used when the request is created:
 * only admins whose region covers the member's region are offered (a short,
 * unregioned region label keeps the picker company-wide).
 */
export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch {
    return jsonError("Database unavailable", 500);
  }

  const actor: any = await User.findById(userId).select("company role regionLabel");
  if (!actor?.company) return jsonError("You must belong to an approved company.", 403);
  if (!["finance", "admin", "project-manager"].includes(String(actor.role ?? ""))) {
    return jsonError("Forbidden", 403);
  }

  const url = new URL(request.url);
  const region = String(url.searchParams.get("region") ?? "").trim();
  const exclude = String(url.searchParams.get("exclude") ?? "").trim();

  const company: any = await Company.findById(actor.company).select("addresses address").lean();
  if (!company) return jsonError("Company not found.", 404);

  const clause = region ? regionApproverClause(company, region) : null;
  const admins = await User.find({
    company: actor.company,
    role: "admin",
    companyStatus: "approved",
    ...(clause ?? {}),
  })
    .select("name email regionLabel")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({
    admins: admins
      .filter((admin: any) => String(admin._id) !== userId && String(admin._id) !== exclude)
      .map((admin: any) => ({
        id: String(admin._id),
        name: admin.name ?? "",
        email: admin.email ?? "",
        regionLabel: admin.regionLabel ?? "",
      })),
  });
}
