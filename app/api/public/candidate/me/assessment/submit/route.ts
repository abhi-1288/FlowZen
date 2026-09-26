import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { buildAssessmentQuestions, pickDomain } from "@/lib/assessment";
import { finalizeAssessmentSubmission, normalizeAssessmentAnswers } from "@/lib/assessment-finalize";
import { getAssessmentDeadlineMs } from "@/lib/assessment-timing";
import { loadCandidateAssessment } from "@/lib/assessment-window";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  if (candidate.stage !== "assessment") return jsonError("You are not in the assessment stage.", 400);
  if ((candidate as any).assessmentSubmittedAt) return jsonError("Already submitted.", 400);
  if (!(candidate as any).assessmentStartedAt) return jsonError("You must start the assessment before submitting.", 400);

  const body = await request.json().catch(() => ({}));
  const answers = normalizeAssessmentAnswers(body?.answers);
  if (!answers.length && !(candidate as any).assessmentAnswers?.length) {
    return jsonError("No answers provided.", 400);
  }

  const job = await ATSJob.findById(candidate.job);
  if (!job) return jsonError("Job not found.", 404);

  const assessment = await loadCandidateAssessment(job._id, candidate.company);
  if (!assessment) return jsonError("Assessment not available.", 400);

  // Rebuild the exact question order the candidate received at /start.
  const chosenDomain = pickDomain((assessment.domains as any[]) || [], (candidate as any).assessmentDomain);
  const questions = buildAssessmentQuestions(
    (assessment.questions as any[]) || [],
    (chosenDomain?.questions as any[]) || []
  );
  if (!questions.length) return jsonError("Assessment not available.", 400);

  const startedAt = new Date((candidate as any).assessmentStartedAt);
  const durationMin = job.assessmentDurationMinutes || null;
  const deadline = getAssessmentDeadlineMs(startedAt.getTime(), durationMin);
  const now = new Date();
  // A submission at or after the deadline is the hard stop, not a failure: it is
  // recorded as auto-submitted rather than rejected so a closed tab or a crash
  // never throws away work the candidate had already answered.
  const autoSubmitted = deadline !== null && now.getTime() >= deadline;

  // Required questions are only enforced while there is still time. The client
  // auto-submits when its clock hits zero, and rejecting that path would leave
  // the attempt permanently unsubmittable for anyone who skipped a required
  // question.
  if (!autoSubmitted) {
    const missingRequired: number[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.required) continue;
      const a = answers.find((x) => x.questionIndex === i);
      const answered =
        q.type === "essay"
          ? Boolean(a && String(a.textAnswer || "").trim())
          : a != null && typeof a.selectedOption === "number";
      if (!answered) missingRequired.push(i + 1);
    }
    if (missingRequired.length) {
      return jsonError(
        `Please answer the required question${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.join(", ")}.`,
        400
      );
    }
  }

  // The client sends its live answers; fall back to the last autosave if the
  // payload was lost so a late submit still reflects real work.
  const effective = answers.length
    ? answers
    : normalizeAssessmentAnswers((candidate as any).assessmentAnswers);

  const result = await finalizeAssessmentSubmission({
    candidate,
    job,
    assessment,
    questions,
    answers: effective,
    autoSubmitted,
  });

  return NextResponse.json({
    ok: true,
    submittedAt: result.submittedAt,
    autoSubmitted: result.autoSubmitted,
    message: "Assessment submitted. Results will be shared once the assessment has been reviewed.",
  });
}
