import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { addressLabelsOf, effectiveRegionLabelOf, isLegacyMainOfficeLabel, isUserInEffectiveRegion, regionEntryOf, type OfficeAddressLike } from "@/lib/company-regions";

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

  const actor = await User.findById(userId).select("company role companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);
  if (String(actor.companyStatus) !== "approved") return jsonError("Company not approved.", 403);

  const body = await request.json();
  const memberId = String(body.memberId ?? "").trim();
  const regionLabel = String(body.regionLabel ?? "").trim();

  if (!memberId) return jsonError("Member ID is required.", 400);

  const member = await User.findById(memberId);
  if (!member) return jsonError("Member not found.", 404);
  if (String(member.company) !== String(actor.company)) return jsonError("Member is not in your company.", 403);

  const company = (await Company.findById(actor.company)
    .select("owner addresses address")
    .lean()) as {
    owner?: unknown;
    addresses?: OfficeAddressLike[] | null;
    address?: string | null;
  } | null;

  // A `regionLabel` that matches no office silently breaks everything that
  // resolves a region by label — the org chart loses that region's HR/admin
  // head, and region-scoped finance/approval queries stop matching the member.
  // Accept only a label the company actually has, and only the legacy
  // placeholder when it is what `mainOfficeLabelOf` itself would produce.
  if (regionLabel) {
    if (regionEntryOf(company, regionLabel)) {
      // Real office, keep the caller's casing below.
    } else if (!isLegacyMainOfficeLabel(company, regionLabel)) {
      const known = addressLabelsOf(company);
      return jsonError(
        known.length
          ? `"${regionLabel}" is not an office of this company. Use one of: ${known.join(", ")}.`
          : "This company has no offices yet, so members cannot be assigned a region.",
        400,
      );
    } else {
      return jsonError(
        "That office has since been named. Pick the current region instead of the old placeholder.",
        400,
      );
    }
  }

  // Moving a member between regions changes which salary policy applies to
  // them, so it is owner-only. A regional admin may only move a member who is
  // already in their region, and only to their own region or the main office;
  // HR keeps the company-wide view.
  const actorRole = String(actor.role);
  if (actorRole === "admin") {
    const ownerId = company?.owner ?? null;
    const isOwner = ownerId != null && String(ownerId) === String(actor._id);
    if (!isOwner) {
      const adminRegion = effectiveRegionLabelOf(company, actor);
      const memberInRegion = adminRegion
        ? isUserInEffectiveRegion(company, adminRegion, member)
        : false;
      const targetIsOwnOrMain = !regionLabel || regionLabel === adminRegion;
      if (!memberInRegion || !targetIsOwnOrMain) {
        return jsonError("Moving a member between regions is owner-only.", 403);
      }
    }
  }

  member.regionLabel = regionLabel;
  await member.save();

  return NextResponse.json({ ok: true, regionLabel });
}
