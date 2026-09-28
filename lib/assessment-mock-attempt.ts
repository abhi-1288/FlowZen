import { pickDomain } from "@/lib/assessment";
import {
  buildServedQuestionKey,
  buildServedQuestions,
  flattenQuestionPool,
  resolveActiveMockAttempt,
  resolveMockTestConfig,
  resolveMockWindow,
  sampleQuestionIndices,
  type MockTestConfig,
  type ResolvedMockWindow,
} from "@/lib/assessment-mock";

/**
 * Candidate-facing helpers for a mock sitting.
 *
 * Kept apart from lib/assessment-mock.ts, which stays free of both mongoose and
 * any assumption about a document, so its maths can be read and tested on their
 * own. This module is the glue: it reads a candidate's mock block, works out
 * where they are in the window, and produces the paper they should be served.
 *
 * ── Addressing a sitting ────────────────────────────────────────────────────
 * A candidate's attempts live in an append-only array, so the attempt in
 * progress is found by index and every later write targets
 * `mockTest.attempts.<i>.*`. The index cannot shift underneath a write because
 * nothing ever reorders or removes an attempt except an explicit HR reset.
 */

/** `?mode=mock` marks a request as belonging to the practice paper. */
export function isMockMode(searchParams: URLSearchParams): boolean {
  return searchParams.get("mode") === "mock";
}

/** Mongo field prefix for one attempt, e.g. `mockTest.attempts.0`. */
export function mockPrefix(index: number): string {
  return `mockTest.attempts.${index}`;
}

type AnyAttempt = Record<string, any>;

export type MockSitting = {
  config: MockTestConfig;
  window: ResolvedMockWindow;
  /** Index of the attempt in progress, or null when none is. */
  activeIndex: number | null;
  active: AnyAttempt | null;
  /** How many attempts have been started. */
  used: number;
  maxAttempts: number;
  /** Starts still available, never negative. */
  remainingStarts: number;
  /** This candidate's own clock, when one is running. */
  deadlineMs: number | null;
};

function readAttempts(candidate: any): AnyAttempt[] {
  const attempts = candidate?.mockTest?.attempts;
  return Array.isArray(attempts) ? attempts.filter(Boolean) : [];
}

/**
 * Work out where a candidate stands: which attempt is live, whether they may
 * start another, and what their clock says.
 *
 * `rawConfig` is the assessment's `mockTest` sub-document, un-resolved — a
 * document written before the feature existed, or hand-edited, still lands on
 * sane values because resolveMockTestConfig fills the gaps.
 */
export function resolveMockSitting(
  candidate: any,
  rawConfig: unknown,
  fallbackDurationMinutes: number | null,
  nowMs: number = Date.now()
): MockSitting {
  const config = resolveMockTestConfig(rawConfig);
  const window = resolveMockWindow(config, nowMs, fallbackDurationMinutes);
  const attempts = readAttempts(candidate);
  const active = resolveActiveMockAttempt(attempts as any) as ResolvedMockAttemptShape<AnyAttempt>;
  const used = attempts.filter((a) => a && a.startedAt).length;
  const maxAttempts = config.maxAttempts;

  const deadlineMs = active
    ? (() => {
        const started = new Date(active.attempt.startedAt).getTime();
        const minutes = config.durationMinutes ?? fallbackDurationMinutes ?? null;
        if (!Number.isFinite(started) || !(Number(minutes) > 0)) return null;
        const grace = Math.max(0, Number(active.attempt.proctoring?.graceMs) || 0);
        return started + Math.round(Number(minutes)) * 60_000 + grace;
      })()
    : null;

  return {
    config,
    window,
    activeIndex: active ? active.index : null,
    active: active ? active.attempt : null,
    used,
    maxAttempts,
    remainingStarts: Math.max(0, maxAttempts - used),
    deadlineMs,
  };
}

type ResolvedMockAttemptShape<T> = { index: number; attempt: T } | null;

/**
 * The paper for one sitting.
 *
 * `indices` is the attempt's persisted sample, replayed verbatim. It is only
 * ever absent when the attempt has not started yet, in which case the caller
 * must sample and persist before serving anything.
 *
 * `served` is the full question in served order and `key` is the grading
 * projection of exactly that list, so `computeAssessmentScore` can be pointed at
 * it unchanged.
 */
export function buildMockPaper<T extends Record<string, any>>(
  general: T[],
  domainQuestions: T[] = [],
  indices: number[] | null = null
): { served: T[]; key: ReturnType<typeof buildServedQuestionKey>; poolSize: number } {
  const pool = flattenQuestionPool(general || [], domainQuestions || []);
  const served = buildServedQuestions(general || [], domainQuestions || [], indices);
  return { served, key: buildServedQuestionKey(served), poolSize: pool.length };
}

/**
 * The seed for a candidate's paper.
 *
 * Stable per candidate, job and attempt number, so two concurrent first-starts
 * draw the same paper and agree whichever write lands first. The attempt number
 * is part of it, so a retake is a genuinely different set of questions rather
 * than a rerun of the one they have already seen.
 */
export function mockSampleSeed(candidateId: string, jobId: string, attemptNumber: number): string {
  return `${candidateId}:${jobId}:${attemptNumber}`;
}

/** Draw the sample for a not-yet-started attempt. */
export function drawMockSample(
  poolSize: number,
  config: MockTestConfig,
  seed: string
): number[] {
  return sampleQuestionIndices(poolSize, config.questionPercent, seed, {
    shuffleQuestions: config.shuffleQuestions,
  });
}

/**
 * Which domain a mock paper is drawn from.
 *
 * Prefers what the candidate just asked for, then the domain they already have
 * on file from the real assessment, then their own mock attempt. Returns null
 * when the assessment has domains but none is chosen, which the caller reports
 * as "please select your domain" — the same rule as the real paper.
 */
export function resolveMockDomain(
  domains: any[] | null | undefined,
  requested: string | null | undefined,
  candidate: any,
  attempt: AnyAttempt | null
): { name: string; questions: any[] } | null {
  return pickDomain(domains || [], requested || attempt?.domain || candidate?.assessmentDomain || "");
}
