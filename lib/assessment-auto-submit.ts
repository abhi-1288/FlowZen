import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { buildAssessmentQuestions, pickDomain } from "@/lib/assessment";
import { finalizeAssessmentSubmission, normalizeAssessmentAnswers } from "@/lib/assessment-finalize";
import { getAssessmentDeadlineMs } from "@/lib/assessment-timing";
import { loadCandidateAssessment } from "@/lib/assessment-window";

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
  const deadline = getAssessmentDeadlineMs(
    new Date(candidate.assessmentStartedAt).getTime(),
    durationMinutes
  );
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
