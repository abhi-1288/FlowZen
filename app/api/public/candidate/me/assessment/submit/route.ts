import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { buildAssessmentQuestions, getCandidateDeadlineMs, pickDomain } from "@/lib/assessment";
import {
  finalizeAssessmentSubmission,
  finalizeMockSubmission,
  normalizeAssessmentAnswers,
} from "@/lib/assessment-finalize";
import { loadCandidateAssessment } from "@/lib/assessment-window";
import { buildMockPaper, isMockMode, resolveMockDomain, resolveMockSitting } from "@/lib/assessment-mock-attempt";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const body = await request.json().catch(() => ({}));
  const answers = normalizeAssessmentAnswers(body?.answers);

  const job = await ATSJob.findById(candidate.job);
  if (!job) return jsonError("Job not found.", 404);

  // ── Mock test ────────────────────────────────────────────────────────────
  // No stage requirement and no "already submitted the assessment" guard: a
  // candidate who has already sat — or already been moved past — the real exam
  // is exactly who a practice paper is for. Only the mock attempt's own state
  // decides whether it can be handed in.
  if (isMockMode(searchParams)) {
    const assessment = await loadCandidateAssessment(job._id, candidate.company);
    if (!assessment) return jsonError("Mock test not available.", 400);

    const sitting = resolveMockSitting(
      candidate,
      (assessment as any).mockTest,
      job.assessmentDurationMinutes ?? null
    );
    if (sitting.activeIndex === null || !sitting.active) {
      return jsonError("You must start the mock test before submitting.", 400);
    }

    const autosaved = (sitting.active.answers as any[]) || [];
    if (!answers.length && !autosaved.length) return jsonError("No answers provided.", 400);

    const domains = ((assessment as any).domains as any[]) || [];
    const chosenDomain = resolveMockDomain(domains, "", candidate, sitting.active);
    const paper = buildMockPaper(
      ((assessment as any).questions as any[]) || [],
      (chosenDomain?.questions || []) as any[],
      Array.isArray(sitting.active.questionIndices) ? sitting.active.questionIndices : null
    );
    if (!paper.key.length) return jsonError("Mock test not available.", 400);

    // Same rule as the real paper: a submission at or after the deadline is the
    // hard stop, not a failure, so work already done is never thrown away.
    const autoSubmitted = sitting.deadlineMs !== null && Date.now() >= sitting.deadlineMs;

    // Required questions are only enforced while there is still time, or the
    // client's own zero-clock auto-submit would become permanently unusable.
    if (!autoSubmitted) {
      const missingRequired: number[] = [];
      for (let i = 0; i < paper.key.length; i++) {
        const q = paper.key[i];
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

    const effective = answers.length ? answers : normalizeAssessmentAnswers(autosaved);

    try {
      const result = await finalizeMockSubmission({
        candidate,
        assessment,
        questions: paper.key,
        answers: effective,
        autoSubmitted,
        attemptIndex: sitting.activeIndex as number,
      });
      return NextResponse.json({
        ok: true,
        mode: "mock",
        submittedAt: result.submittedAt,
        autoSubmitted: result.autoSubmitted,
        attemptIndex: result.attemptIndex,
        message: "Mock test submitted.",
      });
    } catch {
      return jsonError("Already submitted.", 409);
    }
  }

  if (candidate.stage !== "assessment") return jsonError("You are not in the assessment stage.", 400);
  if ((candidate as any).assessmentSubmittedAt) return jsonError("Already submitted.", 400);
  if (!(candidate as any).assessmentStartedAt) return jsonError("You must start the assessment before submitting.", 400);

  if (!answers.length && !(candidate as any).assessmentAnswers?.length) {
    return jsonError("No answers provided.", 400);
  }

  const assessment = await loadCandidateAssessment(job._id, candidate.company);
  if (!assessment) return jsonError("Assessment not available.", 400);

  // Rebuild the exact question order the candidate received at /start.
  const chosenDomain = pickDomain((assessment.domains as any[]) || [], (candidate as any).assessmentDomain);
  const questions = buildAssessmentQuestions(
    (assessment.questions as any[]) || [],
    (chosenDomain?.questions as any[]) || []
  );
  if (!questions.length) return jsonError("Assessment not available.", 400);

  const durationMin = job.assessmentDurationMinutes || null;
  const deadline = getCandidateDeadlineMs(candidate, durationMin);
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
