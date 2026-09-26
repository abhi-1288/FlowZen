import { ATSAssessment } from "@/models/ATSAssessment";
import { getAssessmentDeadlineMs, resolveAssessmentSlots, type ResolvedSlot } from "@/lib/assessment-timing";

export type CandidateAssessmentWindow = {
  slots: ResolvedSlot[];
  mode: "uniform" | "relief";
  durationMinutes: number | null;
  instructions: string;
  passScore: number;
  negativeMarking: number;
  domains: Array<{ name: string; limit: number; questionCount: number }>;
};

/**
 * Resolve the scheduling context for a candidate from the job plus the already
 * loaded assessment document.
 *
 * Reads the mode, slots and duration from the database rather than trusting
 * anything the client sends back, and applies the job's `assessmentDate` as the
 * fallback when no explicit slots are configured. Returns null when the
 * assessment has no usable date at all.
 *
 * Pass the lean assessment document in when the caller has already loaded it
 * (question building needs the full domain sections anyway).
 */
export function resolveCandidateAssessmentWindow(
  job: any,
  assessment: any
): CandidateAssessmentWindow | null {
  if (!job?.assessment) return null;

  const assessmentDate = job.assessmentDate ? new Date(job.assessmentDate) : null;
  if (!assessmentDate || Number.isNaN(assessmentDate.getTime())) return null;

  const mode: "uniform" | "relief" = assessment?.windowMode === "uniform" ? "uniform" : "relief";

  const durationMinutes = (() => {
    const raw = Number(job.assessmentDurationMinutes);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.min(600, Math.max(1, Math.round(raw)));
  })();

  // Mode and duration are needed here, not just for display, because they decide
  // when each slot stops accepting entries.
  const slots = resolveAssessmentSlots(assessmentDate, assessment?.timeSlots || [], {
    mode,
    durationMinutes,
  });
  if (!slots.length) return null;

  const domains = (assessment?.domains || []).map((d: any) => ({
    name: d.name,
    limit: d.limit ?? 0,
    questionCount: Array.isArray(d.questions) ? d.questions.length : 0,
  }));

  return {
    slots,
    mode,
    durationMinutes,
    instructions: String(assessment?.instructions || ""),
    passScore: assessment?.passScore ?? 50,
    negativeMarking: assessment?.negativeMarking ?? 0,
    domains,
  };
}

export async function loadCandidateAssessment(jobId: unknown, company: unknown) {
  return ATSAssessment.findOne({ job: jobId, company }).lean();
}

export { getAssessmentDeadlineMs };
