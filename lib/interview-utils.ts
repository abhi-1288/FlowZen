import { connectDb } from "@/lib/db";
import { ATSInterview } from "@/models/ATSInterview";

export async function canStartInterview(interviewId: string): Promise<{ ok: boolean; reason: string }> {
  await connectDb();

  const interview = await ATSInterview.findById(interviewId).lean();
  if (!interview) return { ok: false, reason: "Interview not found." };

  if (interview.status === "completed") return { ok: false, reason: "This interview is already completed." };
  if (interview.status === "cancelled") return { ok: false, reason: "This interview is cancelled." };
  if (interview.status === "in-progress") return { ok: false, reason: "This interview is already in progress." };

  const scheduled = new Date(interview.scheduledAt);
  const startOfDay = new Date(scheduled.getFullYear(), scheduled.getMonth(), scheduled.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(scheduled.getFullYear(), scheduled.getMonth(), scheduled.getDate(), 23, 59, 59, 999);

  const sameDayInterviews = await ATSInterview.find({
    interviewer: interview.interviewer,
    job: interview.job,
    scheduledAt: { $gte: startOfDay, $lte: endOfDay },
  })
    .sort({ scheduledAt: 1 })
    .select("_id status scheduledAt")
    .lean();

  const index = sameDayInterviews.findIndex((item: any) => String(item._id) === String(interview._id));
  for (let i = 0; i < index; i++) {
    const prev = sameDayInterviews[i] as any;
    if (prev.status !== "completed" && prev.status !== "cancelled") {
      return { ok: false, reason: "Finish the previous candidate's interview before starting the next one." };
    }
  }

  return { ok: true, reason: "" };
}