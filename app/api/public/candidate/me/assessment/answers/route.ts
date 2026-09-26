import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { getAssessmentDeadlineMs } from "@/lib/assessment-timing";

/**
 * Autosave for an in-progress attempt.
 *
 * The client debounces a write here as the candidate answers, so the answers
 * survive a closed tab or a crash and the background sweep has something real
 * to grade. Unanswered questions are stored with a null `selectedOption` and are
 * never coerced to a number — that distinction is what stops a blank question
 * being scored as a wrong answer.
 */
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  if (!(candidate as any).assessmentStartedAt) return jsonError("Assessment has not started.", 400);
  if ((candidate as any).assessmentSubmittedAt) return jsonError("Assessment already submitted.", 409);

  const job = await ATSJob.findById(candidate.job).select("assessmentDurationMinutes").lean();
  if (!job) return jsonError("Assessment is not available for this job.", 400);

  const durationMinutes = Number(job.assessmentDurationMinutes);
  const deadline = getAssessmentDeadlineMs(
    new Date((candidate as any).assessmentStartedAt).getTime(),
    Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : null
  );
  if (deadline !== null && Date.now() >= deadline) {
    return jsonError("Your time is up. The assessment has been closed.", 409);
  }

  const body = await request.json().catch(() => ({}));
  const raw = Array.isArray(body?.answers) ? body.answers : [];
  if (raw.length > 500) return jsonError("Too many answers.", 400);

  const answers = raw
    .map((a: any) => {
      const questionIndex = Number(a?.questionIndex);
      if (!Number.isFinite(questionIndex)) return null;
      return {
        questionIndex,
        selectedOption:
          typeof a?.selectedOption === "number" && Number.isFinite(a.selectedOption)
            ? a.selectedOption
            : null,
        textAnswer: String(a?.textAnswer || "")
          .trim()
          .slice(0, 5000),
      };
    })
    .filter(Boolean);

  // A write guard rather than a blind overwrite, so an autosave that races a
  // submit cannot resurrect a closed attempt.
  const updated = await ATSCandidate.findOneAndUpdate(
    { _id: candidate._id, assessmentSubmittedAt: null },
    { $set: { assessmentAnswers: answers } },
    { new: true }
  ).select("assessmentAnswers");

  if (!updated) return jsonError("Assessment already submitted.", 409);

  return NextResponse.json({ ok: true, saved: answers.length, endsAt: deadline ? new Date(deadline).toISOString() : null });
}
