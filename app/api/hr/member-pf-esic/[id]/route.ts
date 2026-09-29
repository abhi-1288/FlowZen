import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { resolveEnrollingHr } from "@/lib/enrolling-hr";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { effectiveRegionLabelOf, isUserInEffectiveRegion, type OfficeAddressLike } from "@/lib/company-regions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: memberId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(memberId)) return jsonError("Invalid member id.");

  let body: { pfNumber?: string; pfDeductionAmount?: number; esicNumber?: string; esicDeductionAmount?: number; pfExempted?: boolean; esicExempted?: boolean; tdsDeductionAmount?: number; tdsExempted?: boolean };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus name regionLabel");
  if (!actor || !actor.company || actor.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const actorRole = String(actor.role ?? "");
  if (!["human-resource", "admin", "finance"].includes(actorRole)) {
    return jsonError("Only HR, admin, or finance can update PF/ESIC details.", 403);
  }

  const member = await User.findOne({
    _id: memberId,
    company: actor.company,
    companyStatus: "approved",
  }).select("name pfNumber pfDeductionAmount esicNumber esicDeductionAmount pfExempted esicExempted tdsDeductionAmount tdsExempted");
  if (!member) return jsonError("Member not found.", 404);

  if (actorRole === "human-resource") {
    const enrollingHr = await resolveEnrollingHr(member);
    if (enrollingHr?.id && enrollingHr.id !== userId) {
      return jsonError("Only the enrolling HR or admin can update this member's PF/ESIC.", 403);
    }
  }

  // Regional admins can only update PF/ESIC for members in their own region.
  // The company owner, HR and finance keep the company-wide view.
  if (actorRole === "admin") {
    const company = (await Company.findById(actor.company).select("owner addresses address").lean()) as {
      owner?: unknown;
      addresses?: OfficeAddressLike[] | null;
      address?: string | null;
    } | null;
    const ownerId = company?.owner ?? null;
    const isOwner = ownerId != null && String(ownerId) === String(actor._id);
    if (!isOwner) {
      const adminRegion = effectiveRegionLabelOf(company, actor);
      if (adminRegion && !isUserInEffectiveRegion(company, adminRegion, member)) {
        return jsonError(`This member is outside your region (${adminRegion}).`, 403);
      }
    }
  }

  if (body.pfNumber !== undefined) member.pfNumber = String(body.pfNumber).trim();
  if (body.pfDeductionAmount !== undefined) member.pfDeductionAmount = Math.max(0, Number(body.pfDeductionAmount));
  if (body.esicNumber !== undefined) member.esicNumber = String(body.esicNumber).trim();
  if (body.esicDeductionAmount !== undefined) member.esicDeductionAmount = Math.max(0, Number(body.esicDeductionAmount));
  if (body.pfExempted !== undefined) member.pfExempted = Boolean(body.pfExempted);
  if (body.esicExempted !== undefined) member.esicExempted = Boolean(body.esicExempted);
  if (body.tdsDeductionAmount !== undefined) member.tdsDeductionAmount = Math.max(0, Number(body.tdsDeductionAmount));
  if (body.tdsExempted !== undefined) member.tdsExempted = Boolean(body.tdsExempted);
  await member.save();

  return NextResponse.json({
    ok: true,
    pfNumber: member.pfNumber,
    pfDeductionAmount: member.pfDeductionAmount,
    esicNumber: member.esicNumber,
    esicDeductionAmount: member.esicDeductionAmount,
  });
}
