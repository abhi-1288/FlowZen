/**
 * What a candidate is allowed to see about their own application.
 *
 * The candidate endpoints used to `serializeDoc` whole documents, which shipped
 * everything the schema happened to store. That included interview feedback
 * (the verdict, all four 1-5 ratings and up to 2000 characters of private
 * interviewer notes), the AI screening score together with the model's reasoning
 * for rejecting them, the internal recruiter rating, current CTC, and the
 * internal notes array — none of which the portal renders, so it was all invisible
 * leakage sitting in the network payload.
 *
 * These are allowlists rather than denylists on purpose. A denylist has to be
 * updated every time a field is added to a schema, and the failure mode is silent:
 * a new `salaryReviewNotes` field would simply start shipping. An allowlist fails
 * safe, because anything not named here is withheld until someone decides
 * otherwise.
 *
 * Anything withheld but still needed by the portal must be added deliberately
 * here — not worked around at the call site.
 */

/**
 * Timeline actions a candidate may see. Everything else is internal.
 *
 * Deliberately excluded:
 *   - `note-added`      HR's notes. The ATS scorer writes "ATS Score: 42/100
 *                       (rejected). <the model's reason>" into one of these, so a
 *                       candidate would see the score *and* why they were filtered.
 *   - `assessment-graded` Someone has made a pass/fail determination. That is a
 *                       hiring decision, not a status update. The candidate still
 *                       sees `assessment-submitted`, and their score is released
 *                       separately through `assessment.score` once the employer
 *                       publishes results.
 *   - `offer-recalled`  An offer being withdrawn is not the candidate's news.
 */
export const CANDIDATE_VISIBLE_TIMELINE_ACTIONS = [
  "applied",
  "resume-uploaded",
  "interview-scheduled",
  "interview-completed",
  "stage-changed",
  "offer-generated",
  "offer-accepted",
  "offer-rejected",
  "joined",
  "rejected",
  "assessment-started",
  "assessment-submitted",
  "application-updated",
] as const;

/**
 * Which metadata keys each visible action may carry. Anything a writer puts in
 * `metadata` that is not listed here is dropped before the entry is returned.
 *
 * The important exclusions:
 *   - `interview-completed` drops `recommendation`, which is the verdict.
 *   - `stage-changed` drops `reason`. The ATS rejection flow writes
 *     `reason: "ats-rejection"`, which the portal used to print verbatim.
 */
export const CANDIDATE_TIMELINE_METADATA: Record<string, readonly string[]> = {
  applied: ["source", "resumeUrl"],
  "resume-uploaded": ["fileName"],
  "interview-scheduled": ["roundType", "scheduledAt", "newDate", "rescheduled", "assignedTo", "location", "interviewerId"],
  // No `recommendation` — the candidate learns a round finished, not what it scored.
  "interview-completed": ["roundType"],
  // No `reason`, and entries landing on an internal-only stage are dropped below.
  "stage-changed": ["from", "to"],
  "offer-generated": ["offeredCTC", "offerId"],
  "offer-accepted": ["offeredCTC", "offerId"],
  "offer-rejected": [],
  joined: ["joinedDate", "employeeId"],
  rejected: ["from", "to"],
  "assessment-started": ["jobTitle"],
  // The candidate's own auto-graded marks, minus `correct`, which would let them
  // reconstruct the answer key for anything the grader has not published.
  "assessment-submitted": ["score", "total", "autoSubmitted"],
  "application-updated": ["fields"],
};

/**
 * Internal-only pipeline stages. A `stage-changed` entry moving into one of these
 * would render as "moved to ats rejected" and reveals that automated screening
 * rejected them. The candidate already gets a proper `rejected` entry instead.
 */
const INTERNAL_ONLY_STAGES = new Set(["ats-rejected", "assessment-rejected"]);

/**
 * Candidate-facing fields of the candidate document.
 *
 * Covers everything `CandidateData` in the portal and the application edit modal
 * read. Deliberately withheld: `atsScore`, `atsScoredAt`, `atsStatus`,
 * `atsReason`, `atsRejectionNote`, `rating`, `notes`, `currentCTC`,
 * `currentCompany`, `expectedCTC`, `stageChangeRequest`, `assignedRecruiter`,
 * `assignedTeam`, `regionLabel`, `assessmentAnswers`, `assessmentReason`,
 * `assessmentRejectionNote`, and the `portal*` / `magic*` token fields.
 *
 * `assessmentScore` is intentionally absent: it is already released, correctly,
 * through `assessment.score` behind the `resultPublished` gate in the endpoint.
 * Copying it onto the candidate would bypass that gate.
 */
export const CANDIDATE_VISIBLE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "portfolioUrl",
  "linkedInUrl",
  "resumeUrl",
  "stage",
  "createdAt",
  "updatedAt",
  "job",
  "company",
] as const;

/**
 * Candidate-facing fields of an interview. `feedback` is the important omission:
 * it carries the verdict, the four ratings and the interviewer's private notes.
 */
export const CANDIDATE_VISIBLE_INTERVIEW_FIELDS = [
  "roundType",
  "scheduledAt",
  "meetingLink",
  "meetingType",
  "videoProvider",
  "meetingPassword",
  "location",
  "status",
  "passCode",
  "interviewer",
] as const;

function pick(source: Record<string, unknown>, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** Narrow a serialized candidate document to the fields a candidate may see. */
export function publicCandidateProjection<T extends Record<string, unknown>>(doc: T) {
  return pick(doc, CANDIDATE_VISIBLE_FIELDS);
}

/** Narrow a serialized interview document, dropping `feedback`. */
export function publicInterviewProjection<T extends Record<string, unknown>>(doc: T) {
  return pick(doc, CANDIDATE_VISIBLE_INTERVIEW_FIELDS);
}

export type TimelineEntryLike = {
  action: string;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

/**
 * Trim one entry's metadata to the keys its action is allowed to carry.
 * Returns null when the entry itself must be withheld.
 */
export function sanitizeTimelineEntry(
  entry: TimelineEntryLike
): (TimelineEntryLike & { metadata: Record<string, unknown> }) | null {
  const allowedActions = CANDIDATE_VISIBLE_TIMELINE_ACTIONS as readonly string[];
  if (!allowedActions.includes(entry.action)) return null;

  // A stage change into an internal-only stage would read as "moved to ats
  // rejected" and disclose that automated screening filtered the candidate.
  if (entry.action === "stage-changed") {
    const to = String(entry.metadata?.to ?? "");
    if (INTERNAL_ONLY_STAGES.has(to)) return null;
  }

  const keys = CANDIDATE_TIMELINE_METADATA[entry.action] ?? [];
  return { ...entry, metadata: pick(entry.metadata ?? {}, keys) };
}
