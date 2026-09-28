import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { buildAssessmentQuestions, getCandidateDeadlineMs, pickDomain } from "@/lib/assessment";
import { finalizeAssessmentSubmission, finalizeMockSubmission, normalizeAssessmentAnswers } from "@/lib/assessment-finalize";
import { loadCandidateAssessment } from "@/lib/assessment-window";
import { buildMockPaper, resolveMockSitting } from "@/lib/assessment-mock-attempt";

/**
 * A candidate's own clock runs from `assessmentStartedAt` for
 * `assessmentDurationMinutes`. When it elapses the attempt must be closed out
 * whether or not the browser is still open — a candidate who closed the tab
 * should not keep an unclosed attempt, and the answers they had autosaved must
 * be graded rather than discarded.
 *
 * Grading goes through the same finalizer as a manual submit, so scores,
 * status and timeline entries are identical either way.
 */

type FinalizedCandidate = {
  candidateId: string;
  score: number;
  status: string;
  autoSubmitted: boolean;
  answered: number;
};

/** True when the candidate's exam clock has run out. */
function isExpired(
  candidate: any,
  durationMinutes: number | null,
  nowMs: number
): boolean {
  if (!candidate?.assessmentStartedAt || candidate?.assessmentSubmittedAt) return false;
  if (!durationMinutes || durationMinutes <= 0) return false;
  const deadline = getCandidateDeadlineMs(candidate, durationMinutes);
  return deadline !== null && nowMs >= deadline;
}

/** Finalize one candidate if their clock has run out. */
export async function finalizeCandidateIfExpired(
  candidateId: unknown,
  nowMs: number = Date.now()
): Promise<FinalizedCandidate | null> {
  const candidate = await ATSCandidate.findById(candidateId);
  if (!candidate) return null;

  const job = await ATSJob.findById(candidate.job);
  if (!job) return null;

  const durationMinutes =
    Number.isFinite(Number(job.assessmentDurationMinutes)) && Number(job.assessmentDurationMinutes) > 0
      ? Number(job.assessmentDurationMinutes)
      : null;

  if (!isExpired(candidate, durationMinutes, nowMs)) return null;

  const assessment = await loadCandidateAssessment(job._id, candidate.company);
  if (!assessment) return null;

  const chosenDomain = pickDomain((assessment.domains as any[]) || [], candidate.assessmentDomain);
  const questions = buildAssessmentQuestions(
    (assessment.questions as any[]) || [],
    (chosenDomain?.questions as any[]) || []
  );
  if (!questions.length) return null;

  // Re-check inside the write guard: another tab or a manual submit may have
  // landed between the read and here.
  const fresh = await ATSCandidate.findOne({
    _id: candidate._id,
    assessmentSubmittedAt: null,
  });
  if (!fresh) return null;

  const answers = normalizeAssessmentAnswers((fresh as any).assessmentAnswers);

  const result = await finalizeAssessmentSubmission({
    candidate: fresh,
    job,
    assessment,
    questions,
    answers,
    autoSubmitted: true,
  });

  return {
    candidateId: String(fresh._id),
    score: result.score,
    status: result.status,
    autoSubmitted: true,
    answered: answers.filter((a) => typeof a.selectedOption === "number" || String(a.textAnswer || "").trim()).length,
  };
}

/**
 * Finalize a candidate's mock attempt if their clock has run out.
 *
 * The same backstop as the real paper, for the same reason: a candidate who
 * closed the tab mid-mock has still sat the paper, and the answers they
 * autosaved deserve to be graded rather than discarded. Nothing here writes to
 * the real attempt or the timeline — a practice paper is not a recruitment
 * event.
 */
export async function finalizeMockAttemptIfExpired(
  candidateId: unknown,
  nowMs: number = Date.now()
): Promise<{ attemptIndex: number; score: number; autoSubmitted: true } | null> {
  const candidate = await ATSCandidate.findById(candidateId);
  if (!candidate) return null;

  const job = await ATSJob.findById(candidate.job).select("assessment assessmentDurationMinutes");
  if (!job) return null;

  const assessment = await ATSAssessment.findOne({ job: job._id, company: candidate.company }).lean();
  if (!assessment) return null;

  const sitting = resolveMockSitting(
    candidate,
    (assessment as any).mockTest,
    job.assessmentDurationMinutes ?? null,
    nowMs
  );
  const index = sitting.activeIndex;
  if (index === null || !sitting.active) return null;
  if (sitting.deadlineMs === null || nowMs < sitting.deadlineMs) return null;

  // Re-read before grading: a manual submit may have landed between the read
  // above and here, and grading a closed attempt would resurrect it.
  const fresh = await ATSCandidate.findOne({
    _id: candidate._id,
    [`mockTest.attempts.${index}.submittedAt`]: null,
  });
  if (!fresh) return null;

  const attempt: any = (fresh as any).mockTest?.attempts?.[index];
  if (!attempt) return null;

  const chosenDomain = pickDomain(
    ((assessment as any).domains as any[]) || [],
    attempt.domain || (candidate as any).assessmentDomain || ""
  );
  const paper = buildMockPaper(
    ((assessment as any).questions as any[]) || [],
    (chosenDomain?.questions || []) as any[],
    Array.isArray(attempt.questionIndices) ? attempt.questionIndices : null
  );
  if (!paper.key.length) return null;

  try {
    const result = await finalizeMockSubmission({
      candidate: fresh,
      assessment,
      questions: paper.key,
      answers: normalizeAssessmentAnswers(attempt.answers),
      autoSubmitted: true,
      attemptIndex: index,
    });
    return { attemptIndex: index, score: result.score, autoSubmitted: true };
  } catch {
    // The finalizer's own guard rejected the write: someone else closed it first.
    return null;
  }
}

/**
 * Sweep every expired attempt. Intended for the daily cron as a backstop for
 * candidates who never return to the portal; the hot path is the scoped
 * `finalizeCandidateIfExpired` call made on each portal load.
 */
export async function sweepExpiredAssessments(nowMs: number = Date.now()): Promise<{
  finalized: number;
  skipped: number;
}> {
  await connectDb();

  const candidates = await ATSCandidate.find({
    assessmentStartedAt: { $ne: null },
    assessmentSubmittedAt: null,
  })
    .select("job assessmentStartedAt assessmentSubmittedAt")
    .lean();

  let finalized = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      const result = await finalizeCandidateIfExpired(candidate._id, nowMs);
      if (result) finalized++;
      else skipped++;
    } catch (err) {
      skipped++;
      console.error(`Assessment auto-submit failed for ${candidate._id}:`, err);
    }
  }

  return { finalized, skipped };
}

/**
 * Sweep expired mock attempts.
 *
 * Separate from the real sweep rather than folded into it, because the two
 * select on different fields and a candidate may well have both open: someone
 * who has already sat the real exam and is practising for a retake is exactly
 * the case this feature exists for.
 */
export async function sweepExpiredMockAttempts(nowMs: number = Date.now()): Promise<{
  finalized: number;
  skipped: number;
}> {
  await connectDb();

  const candidates = await ATSCandidate.find({
    "mockTest.attempts": {
      $elemMatch: { startedAt: { $ne: null }, submittedAt: null },
    },
  })
    .select("_id")
    .lean();

  let finalized = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      const result = await finalizeMockAttemptIfExpired(candidate._id, nowMs);
      if (result) finalized++;
      else skipped++;
    } catch (err) {
      skipped++;
      console.error(`Mock auto-submit failed for ${candidate._id}:`, err);
    }
  }

  return { finalized, skipped };
}
