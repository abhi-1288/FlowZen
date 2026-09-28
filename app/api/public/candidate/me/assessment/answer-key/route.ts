import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { pickDomain } from "@/lib/assessment";
import {
  resolveBestMockAttempt,
  resolveBestReleasedMockAttempt,
  resolveMockResultVisibility,
} from "@/lib/assessment-mock";
import {
  buildMockPaper,
  isMockMode,
  resolveMockDomain,
  resolveMockSitting,
} from "@/lib/assessment-mock-attempt";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const job = await ATSJob.findById(candidate.job).select("title assessmentDurationMinutes");
  if (!job) return jsonError("Job not found.", 404);

  const assessment = await ATSAssessment.findOne({ job: job._id, company: candidate.company });
  if (!assessment) return jsonError("Assessment not available.", 400);

  // ── Mock test ────────────────────────────────────────────────────────────
  // Gated by the per-attempt release rule rather than by HR publishing anything.
  // The paper is rebuilt from the attempt's persisted sample, so the key lines
  // up with the questions the candidate actually saw — rebuilding from the bank
  // here would show them the whole paper, in the wrong order, with the wrong
  // answers against their questions.
  if (isMockMode(searchParams)) {
    const sitting = resolveMockSitting(
      candidate,
      (assessment as any).mockTest,
      (job as any).assessmentDurationMinutes ?? null
    );
    if (!sitting.config.enabled) return jsonError("The mock test is not available.", 400);

    const completed = (candidate as any).mockTest?.attempts || [];
    // The same attempt the portal shows, so the paper, the score and the
    // highlight of the candidate's own selections always agree.
    const best = resolveBestReleasedMockAttempt(completed, sitting.config);
    if (!best) {
      const anyAttempt = resolveBestMockAttempt(completed);
      if (!anyAttempt) return jsonError("You have not submitted the mock test yet.", 400);
      const pending = resolveMockResultVisibility(sitting.config, anyAttempt.attempt);
      if (!pending.submitted) return jsonError("You have not submitted the mock test yet.", 400);
      if (!pending.visible) return jsonError("Your mock result has not been released yet.", 403);
      return jsonError("The answer key for this mock test is not available.", 403);
    }

    const visibility = best.visibility;
    if (!visibility.answerKeyVisible) {
      return jsonError("The answer key for this mock test is not available.", 403);
    }

    const attempt: any = best.attempt;
    const domains = ((assessment as any).domains as any[]) || [];
    const chosenDomain = resolveMockDomain(domains, attempt.domain, candidate, attempt);
    const paper = buildMockPaper(
      ((assessment as any).questions as any[]) || [],
      (chosenDomain?.questions || []) as any[],
      Array.isArray(attempt.questionIndices) ? attempt.questionIndices : null
    );

    const answers = (attempt.answers as any[]) || [];
    const questions = paper.served.map((q: any, i: number) => {
      const a = answers.find((x: any) => x.questionIndex === i);
      return {
        index: i,
        text: q?.text ?? "",
        options: Array.isArray(q?.options) ? q.options : [],
        correctIndex: q?.correctIndex ?? 0,
        marks: Math.max(0, Number(q?.marks) || 1),
        required: Boolean(q?.required),
        type: q?.type === "essay" ? "essay" : "mcq",
        answer: q?.answer ?? "",
        selectedOption: a?.selectedOption ?? null,
        textAnswer: a?.textAnswer ?? "",
      };
    });

    return NextResponse.json({
      mode: "mock",
      candidate: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
      },
      jobTitle: job.title,
      domain: attempt.domain || chosenDomain?.name || null,
      attemptNumber: attempt.attemptNumber ?? 1,
      score: attempt.score ?? null,
      rawMarks: attempt.rawMarks ?? null,
      maxMarks: attempt.maxMarks ?? null,
      passed: attempt.passed ?? null,
      passScore: (assessment as any).passScore ?? 50,
      negativeMarking: (assessment as any).negativeMarking ?? 0,
      negativeMarkingLabel: (assessment as any).negativeMarkingLabel || "",
      // The best *released* score, which is what the portal showed, so the PDF
      // and the summary the candidate already read cannot disagree.
      bestScore: attempt.score ?? null,
      startedAt: attempt.startedAt?.toISOString() ?? null,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      releasedAt: visibility.visibleAt === null ? null : new Date(visibility.visibleAt).toISOString(),
      questions,
    });
  }

  if (!(candidate as any).assessmentSubmittedAt) return jsonError("You have not submitted the assessment.", 400);
  if (!(candidate as any).assessmentResultPublishedAt) return jsonError("Your results have not been published yet.", 403);

  if (!(assessment as any).answerKeyPublished) return jsonError("Answer key has not been published yet.", 403);

  // Rebuild the exact question order the candidate received at /start.
  const domainName = (candidate as any).assessmentDomain || "";
  const chosenDomain = pickDomain((assessment.domains as any[]) || [], domainName);
  const sourceQuestions = [
    ...(assessment.questions as any[]) || [],
    ...(chosenDomain?.questions as any[]) || [],
  ];

  const questions = sourceQuestions.map((q: any, idx: number) => {
    const a = ((candidate as any).assessmentAnswers || []).find((x: any) => x.questionIndex === idx);
    return {
      index: idx,
      text: q.text ?? "",
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: q.correctIndex ?? 0,
      marks: Math.max(0, Number(q.marks) || 1),
      required: Boolean(q.required),
      type: q.type === "essay" ? "essay" : "mcq",
      answer: q.answer ?? "",
      selectedOption: a?.selectedOption ?? null,
      textAnswer: a?.textAnswer ?? "",
    };
  });

  return NextResponse.json({
    candidate: {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
    },
    jobTitle: job.title,
    domain: domainName || null,
    score: (candidate as any).assessmentScore ?? null,
    rawMarks: (candidate as any).assessmentRawMarks ?? null,
    maxMarks: (candidate as any).assessmentMaxMarks ?? null,
    passScore: (assessment as any).passScore ?? 50,
    negativeMarking: (assessment as any).negativeMarking ?? 0,
    negativeMarkingLabel: (assessment as any).negativeMarkingLabel || "",
    startedAt: (candidate as any).assessmentStartedAt?.toISOString() ?? null,
    submittedAt: (candidate as any).assessmentSubmittedAt?.toISOString() ?? null,
    publishedAt: (assessment as any).answerKeyPublishedAt?.toISOString() ?? null,
    questions,
  });
}
