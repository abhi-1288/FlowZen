import { NextResponse } from "next/server";
import { jsonError, requireUserId } from "@/lib/api";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { sendAssessmentReminderEmails } from "@/lib/assessment-day-emails";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const user = await User.findById(userId).select("company role").lean();
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;

  const result = await sendAssessmentReminderEmails(id);
  return NextResponse.json({ ok: true, emailed: result.emailed });
}
