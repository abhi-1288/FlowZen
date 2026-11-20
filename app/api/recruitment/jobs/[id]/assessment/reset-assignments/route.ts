import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

/** Clear all slot assignments. HR decides separately whether to re-assign and re-invite. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const user = await User.findById(userId).select("company").lean();
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!(user as any)?.company) return jsonError("No company found.", 400);

  await connectDb();
  const result = await ATSCandidate.updateMany(
    { job: id, company: (user as any).company },
    { $set: { assessmentSlotStart: null } },
  );

  return NextResponse.json({ ok: true, reset: result.modifiedCount });
}
