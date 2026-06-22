import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSReferral } from "@/models/ATSReferral";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid referral id.");

  const body = await request.json();

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.referralBonusEligible !== undefined) updates.referralBonusEligible = Boolean(body.referralBonusEligible);

  const referral = await ATSReferral.findOneAndUpdate(
    { _id: id, company: user.company },
    { $set: updates },
    { new: true }
  )
    .populate("employee", "name email")
    .populate("candidate", "firstName lastName email");

  if (!referral) return jsonError("Referral not found.", 404);

  return NextResponse.json({ referral: serializeDoc(referral) });
}
