import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { computeAssessmentScore, pickDomain } from "@/lib/assessment";
import { formatMarks } from "@/lib/assessment-negative-marking";

export type AssessmentAnswerInput = {
  questionIndex: number;
  selectedOption?: number | null;
  textAnswer?: string;
};

export type FinalizeResult = {
  score: number;
  rawMarks: number;
  maxMarks: number;
  status: string;
  reason: string;
  domain: string;
  total: number;
  correct: number;
  mcqTotal: number;
  essayCount: number;
  hasEssays: boolean;
  autoSubmitted: boolean;
  submittedAt: string;
};

/**
 * Grade and persist a candidate's assessment. Shared by the manual submit
 * endpoint and the background auto-submit sweep so both produce identical
 * scores, status, reason text and timeline entries.
 *
 * `questions` must be the exact flattened order the candidate received.
 * Answers whose `selectedOption` is null count as unanswered: no credit and no
 * negative marking.
 */
export async function finalizeAssessmentSubmission({
  candidate,
  job,
  assessment,
  questions,
  answers,
  autoSubmitted,
}: {
  candidate: any;
  job: any;
  assessment: any;
  questions: Array<{ type?: string; correctIndex?: number; marks?: number; required?: boolean }>;
  answers: AssessmentAnswerInput[];
  autoSubmitted: boolean;
}): Promise<FinalizeResult> {
  const chosenDomain = pickDomain((assessment.domains as any[]) || [], candidate.assessmentDomain);

  const negativeMarking = Math.max(0, Number((assessment as any).negativeMarking) || 0);
  const graded = computeAssessmentScore(answers as any[], questions as any[], negativeMarking);
  const { score, rawMarks, maxMarks, correct, mcqTotal, essayCount, hasEssays } = graded;

  const submittedAt = new Date();

  let status: string;
  let reason: string;
  if (hasEssays) {
    status = "pending";
    reason =
      maxMarks > 0
        ? `Score: ${score}/100 (${formatMarks(rawMarks)}/${formatMarks(maxMarks)} marks, multiple-choice). Essay answers require manual review.`
        : "Essay-only assessment — answers require manual review.";
  } else {
    const threshold = assessment.passScore || 50;
    status = score! >= threshold ? "selected" : "rejected";
    const suffix = autoSubmitted ? " Auto-submitted due to time limit." : "";
    reason = `Score: ${score}/100 (${formatMarks(rawMarks)}/${formatMarks(maxMarks)} marks; ${status === "selected" ? "Passed" : "Failed"}).${suffix}`;
  }

  const domainName = chosenDomain?.name || "";

  await ATSCandidate.findByIdAndUpdate(candidate._id, {
    assessmentScore: score,
    assessmentRawMarks: rawMarks,
    assessmentMaxMarks: maxMarks,
    assessmentDomain: domainName,
    assessmentStatus: status,
    assessmentReason: reason,
    assessmentSubmittedAt: submittedAt,
    assessmentAnswers: answers.map((a) => ({
      questionIndex: a.questionIndex,
      // Preserve null for unanswered questions so the answer key and any later
      // sweep do not read an unanswered question as a chosen option 0.
      selectedOption: typeof a.selectedOption === "number" ? a.selectedOption : null,
      textAnswer: String(a.textAnswer || "").trim().slice(0, 5000),
    })),
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "assessment-submitted",
    metadata: {
      score,
      rawMarks,
      maxMarks,
      total: questions.length,
      correct,
      mcqTotal,
      essayCount,
      autoSubmitted,
      hasEssays,
      domain: domainName || null,
    },
    company: candidate.company,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "assessment-graded",
    metadata: {
      content: "Your assessment has been submitted. Results will be shared once the assessment has been reviewed.",
      status: "pending",
      passed: false,
      score,
      outcome: status,
    },
    company: candidate.company,
  });

  return {
    score,
    rawMarks,
    maxMarks,
    status,
    reason,
    domain: domainName,
    total: questions.length,
    correct,
    mcqTotal,
    essayCount,
    hasEssays,
    autoSubmitted,
    submittedAt: submittedAt.toISOString(),
  };
}

/** Normalise loose answer payloads coming from the client or the database. */
export function normalizeAssessmentAnswers(raw: unknown): AssessmentAnswerInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any) => ({
      questionIndex: Number(a?.questionIndex),
      selectedOption:
        typeof a?.selectedOption === "number" && Number.isFinite(a.selectedOption)
          ? a.selectedOption
          : null,
      textAnswer: a?.textAnswer,
    }))
    .filter((a) => Number.isFinite(a.questionIndex))
    .map((a) => ({ ...a, questionIndex: a.questionIndex }));
}

export type MockFinalizeResult = {
  score: number;
  rawMarks: number;
  maxMarks: number;
  /** Null when the paper contained essays, which are not auto-marked. */
  passed: boolean | null;
  total: number;
  correct: number;
  mcqTotal: number;
  essayCount: number;
  hasEssays: boolean;
  autoSubmitted: boolean;
  submittedAt: string;
  attemptIndex: number;
};

/**
 * Grade and persist one mock attempt.
 *
 * Deliberately narrower than finalizeAssessmentSubmission above. The scoring is
 * the same code, but the writes stop at the attempt: no `assessmentScore`, no
 * `assessmentStatus`, no stage change, and — most importantly — no timeline
 * entry. A practice paper is not a recruitment event, and a candidate who
 * answers it perfectly must not appear as an assessment result to anyone
 * downstream, least of all to themselves.
 *
 * `questions` must be the sampled paper in the order it was served, which is
 * why the caller replays the attempt's persisted `questionIndices` rather than
 * rebuilding the list from the bank.
 */
export async function finalizeMockSubmission({
  candidate,
  assessment,
  questions,
  answers,
  autoSubmitted,
  attemptIndex,
}: {
  candidate: any;
  assessment: any;
  questions: Array<{ type?: string; correctIndex?: number; marks?: number; required?: boolean }>;
  answers: AssessmentAnswerInput[];
  autoSubmitted: boolean;
  attemptIndex: number;
}): Promise<MockFinalizeResult> {
  const negativeMarking = Math.max(0, Number((assessment as any)?.negativeMarking) || 0);
  const graded = computeAssessmentScore(answers as any[], questions as any[], negativeMarking);
  const { score, rawMarks, maxMarks, correct, mcqTotal, essayCount, hasEssays } = graded;

  const threshold = Number((assessment as any)?.passScore) || 50;
  const passed = hasEssays ? null : score >= threshold;
  const submittedAt = new Date();
  const prefix = `mockTest.attempts.${attemptIndex}`;

  // Guarded so a submit that races the background sweep cannot double-write or
  // reopen a closed attempt. Returns null when the attempt was already closed,
  // which the caller reports as "already submitted" rather than a server error.
  const written = await ATSCandidate.findOneAndUpdate(
    { _id: candidate._id, [`${prefix}.submittedAt`]: null },
    {
      $set: {
        [`${prefix}.score`]: score,
        [`${prefix}.rawMarks`]: rawMarks,
        [`${prefix}.maxMarks`]: maxMarks,
        [`${prefix}.passed`]: passed,
        [`${prefix}.submittedAt`]: submittedAt,
        [`${prefix}.autoSubmitted`]: autoSubmitted,
        [`${prefix}.answers`]: answers.map((a) => ({
          questionIndex: a.questionIndex,
          // Preserve null for unanswered questions so the answer key does not
          // read a blank as a chosen option 0.
          selectedOption: typeof a.selectedOption === "number" ? a.selectedOption : null,
          textAnswer: String(a.textAnswer || "").trim().slice(0, 5000),
        })),
        "mockTest.lastSubmittedAt": submittedAt,
      },
      // $max only writes when the incoming value is greater, so the cohort's
      // best mock result survives a lower-scoring retake without a read first.
      $max: { "mockTest.bestScore": score },
    },
    { new: true }
  ).select(`mockTest.attempts.${attemptIndex}`);

  if (!written) throw new Error("Mock attempt already submitted.");

  return {
    score,
    rawMarks,
    maxMarks,
    passed,
    total: questions.length,
    correct,
    mcqTotal,
    essayCount,
    hasEssays,
    autoSubmitted,
    submittedAt: submittedAt.toISOString(),
    attemptIndex,
  };
}
