import {
  buildServedQuestionKey,
  buildServedQuestions,
  sampleIndicesByCount,
  type PoolQuestion,
} from "@/lib/assessment-mock";

/**
 * The real assessment's served paper.
 *
 * The mock paper is sized as a percentage of the bank (lib/assessment-mock.ts);
 * the real paper is sized in absolute counts: the assessment's optional
 * `questionLimit` (the whole sitting) and each domain's own `limit`. This module
 * turns those counts into the exact list of questions one candidate is served,
 * and — because answers are keyed by position — the same inputs must produce the
 * same list on every call so start, autosave, submit, auto-submit and the answer
 * key all agree.
 *
 * The rule:
 *   - the domain's own `limit` is filled first (0 = the whole domain);
 *   - when a total `questionLimit` is set, the general section takes whatever is
 *     left, so general + domain never exceeds it;
 *   - with no limits at all this returns the whole pool in order, which is
 *     exactly the behaviour the assessment had before sampling existed.
 *
 * `seed` must be stable per candidate for a given paper. It is deliberately not
 * derived from the domain limit or the bank, so two concurrent first-starts in
 * different tabs draw the same paper and whichever write lands first wins.
 */

export type ServedIndicesInput = {
  /** Number of general-bank questions. */
  generalPool: number;
  /** Number of questions in the candidate's chosen domain (0 when there are none). */
  domainPool: number;
  /** The chosen domain's `limit`; 0 means the whole domain. */
  domainLimit?: number;
  /** The assessment's total question limit; 0 means no total cap. */
  questionLimit?: number;
  /** Stable per-candidate seed, e.g. `${candidateId}:${jobId}:assessment`. */
  seed: string;
};

/** The exact count split the rule implies, exposed for the summary UI. */
export function resolveServedCounts(input: {
  generalPool: number;
  domainPool: number;
  domainLimit?: number;
  questionLimit?: number;
}): { generalCount: number; domainCount: number } {
  const generalPool = Math.max(0, Math.floor(Number(input.generalPool) || 0));
  const domainPool = Math.max(0, Math.floor(Number(input.domainPool) || 0));
  const domainLimit = Math.max(0, Math.floor(Number(input.domainLimit) || 0));
  const questionLimit = Math.max(0, Math.floor(Number(input.questionLimit) || 0));

  let domainCount = domainLimit > 0 ? Math.min(domainLimit, domainPool) : domainPool;
  let generalCount: number;
  if (questionLimit > 0) {
    if (domainCount > questionLimit) domainCount = questionLimit;
    generalCount = Math.max(0, Math.min(questionLimit - domainCount, generalPool));
  } else {
    generalCount = generalPool;
  }
  return { generalCount, domainCount };
}

/**
 * The served order as indices into `[...general, ...chosenDomain.questions]`.
 * Always explicit (never null), even in the no-limit case, so callers persist
 * one uniform shape.
 */
export function resolveServedIndices(input: ServedIndicesInput): number[] {
  const generalPool = Math.max(0, Math.floor(Number(input.generalPool) || 0));
  const { generalCount, domainCount } = resolveServedCounts(input);

  const generalPicked = sampleIndicesByCount(generalPool, generalCount, `${input.seed}:general`, {
    shuffleQuestions: false,
  });
  const domainPicked = sampleIndicesByCount(
    Math.max(0, Math.floor(Number(input.domainPool) || 0)),
    domainCount,
    `${input.seed}:domain`,
    { shuffleQuestions: false }
  ).map((i) => i + generalPool);

  return [...generalPicked, ...domainPicked];
}

/**
 * The questions a candidate actually saw, plus the grading key for exactly that
 * list. Replays persisted indices verbatim; `null`/empty means "legacy or not
 * sampled yet" and serves the whole pool in order.
 */
export function buildServedAssessmentPaper<T extends PoolQuestion>(
  general: T[],
  domainQuestions: T[],
  indices: number[] | null | undefined
) {
  const usable = Array.isArray(indices) && indices.length ? indices : null;
  const served = buildServedQuestions(general || [], domainQuestions || [], usable);
  return { served, key: buildServedQuestionKey(served) };
}
