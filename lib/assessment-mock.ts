import { buildAssessmentQuestions } from "@/lib/assessment";

/**
 * Mock-test mode: shared config, sampling, window maths and result gating.
 *
 * A mock test is a short practice paper drawn from the real assessment's
 * question bank, sat under the same clock and the same proctoring rules, but on
 * a completely separate track. Nothing here may write to, or read as if it were,
 * the real attempt's score, status, stage or timeline.
 *
 * ── Why sampling has to be persisted ─────────────────────────────────────────
 * Answers are keyed by *position* (`questionIndex === i`), and grading walks the
 * question list by that same position. The paper is therefore not reproducible
 * from the bank alone: if a candidate's 10% sample were recomputed at submit
 * time it would very likely come out in a different order, and every answer
 * would land against the wrong question. So the sampled indices are computed
 * once, written to the attempt, and replayed verbatim by start, autosave,
 * auto-submit, grading and the answer key. `buildServedQuestions()` is the only
 * place that turns those indices back into questions.
 *
 * Like lib/assessment-proctoring.ts this module holds no mongoose import, so the
 * `ATSAssessment.mockTest` sub-schema in models/ATSAssessment.ts takes its
 * defaults from the same constants the maths reads, and the two cannot drift.
 */

// ── Config ───────────────────────────────────────────────────────────────────

/** When a candidate is allowed to see their mock result and answer key. */
export type MockResultRelease = "immediate" | "delayed" | "never";

export type MockTestConfig = {
  enabled: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  /** Null means "inherit the job's assessment duration". */
  durationMinutes: number | null;
  questionPercent: number;
  shuffleQuestions: boolean;
  resultRelease: MockResultRelease;
  resultDelayHours: number;
  showAnswerKey: boolean;
  maxAttempts: number;
  lastInvitedAt: Date | null;
};

export const DEFAULT_MOCK_QUESTION_PERCENT = 10;
export const MIN_MOCK_QUESTION_PERCENT = 5;
export const MAX_MOCK_QUESTION_PERCENT = 100;
export const MIN_MOCK_DURATION_MINUTES = 1;
export const MAX_MOCK_DURATION_MINUTES = 600;
export const MIN_MOCK_RESULT_DELAY_HOURS = 0;
export const MAX_MOCK_RESULT_DELAY_HOURS = 720;
export const MIN_MOCK_ATTEMPTS = 1;
export const MAX_MOCK_ATTEMPTS = 5;
export const MOCK_RESULT_RELEASES: MockResultRelease[] = ["immediate", "delayed", "never"];

/**
 * Hard ceiling on how many questions one mock paper may contain.
 *
 * With the percentage bounded at 100% the arithmetic cannot produce anything
 * absurd, but the bank is not bounded, so this is the backstop that keeps a
 * single request from serving an entire ten-thousand-question bank.
 */
export const MAX_SERVED_QUESTIONS = 200;

export const DEFAULT_MOCK_TEST: MockTestConfig = {
  enabled: false,
  opensAt: null,
  closesAt: null,
  durationMinutes: null,
  questionPercent: DEFAULT_MOCK_QUESTION_PERCENT,
  shuffleQuestions: true,
  resultRelease: "immediate",
  resultDelayHours: 0,
  showAnswerKey: true,
  maxAttempts: 1,
  lastInvitedAt: null,
};

function toMs(value: Date | string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = new Date(value as Date).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Read a persisted (possibly partial) config off a document, filling defaults.
 *
 * Mirrors resolveProctoringConfig so a document written before a field existed,
 * or hand-edited to nonsense, still yields a config the maths can trust.
 */
export function resolveMockTestConfig(source: unknown): MockTestConfig {
  const raw = (source ?? {}) as Partial<MockTestConfig>;
  const duration = Number(raw.durationMinutes);
  const release = MOCK_RESULT_RELEASES.includes(raw.resultRelease as MockResultRelease)
    ? (raw.resultRelease as MockResultRelease)
    : DEFAULT_MOCK_TEST.resultRelease;

  return {
    enabled: raw.enabled === true,
    opensAt: toMs(raw.opensAt) === null ? null : new Date(toMs(raw.opensAt) as number),
    closesAt: toMs(raw.closesAt) === null ? null : new Date(toMs(raw.closesAt) as number),
    durationMinutes:
      Number.isFinite(duration) && duration > 0
        ? clampInt(duration, MIN_MOCK_DURATION_MINUTES, MAX_MOCK_DURATION_MINUTES, 60)
        : null,
    questionPercent: clampInt(
      raw.questionPercent,
      MIN_MOCK_QUESTION_PERCENT,
      MAX_MOCK_QUESTION_PERCENT,
      DEFAULT_MOCK_QUESTION_PERCENT
    ),
    shuffleQuestions: raw.shuffleQuestions !== false,
    resultRelease: release,
    // A delay is meaningless unless the release mode is "delayed", so it is
    // zeroed here rather than left to rot and become surprising if HR later
    // switches the mode back to "delayed".
    resultDelayHours:
      release === "delayed"
        ? clampInt(raw.resultDelayHours, MIN_MOCK_RESULT_DELAY_HOURS, MAX_MOCK_RESULT_DELAY_HOURS, 0)
        : 0,
    showAnswerKey: raw.showAnswerKey !== false,
    maxAttempts: clampInt(raw.maxAttempts, MIN_MOCK_ATTEMPTS, MAX_MOCK_ATTEMPTS, 1),
    lastInvitedAt: toMs(raw.lastInvitedAt) === null ? null : new Date(toMs(raw.lastInvitedAt) as number),
  };
}

// ── Sampling ─────────────────────────────────────────────────────────────────

/** FNV-1a, 32-bit. Any stable string hash will do; it only needs to not collide. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  const text = String(input ?? "");
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, well-distributed seeded PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates over 0..count-1, driven by the supplied generator. */
export function shuffledIndices(count: number, rand: () => number): number[] {
  const out = Array.from({ length: Math.max(0, count) }, (_, i) => i);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** How many questions a paper of this size and percentage should contain. */
export function mockSampleSize(poolSize: number, questionPercent: number): number {
  const total = Math.max(0, Math.floor(Number(poolSize) || 0));
  if (total === 0) return 0;
  const pct = clampInt(
    questionPercent,
    MIN_MOCK_QUESTION_PERCENT,
    MAX_MOCK_QUESTION_PERCENT,
    DEFAULT_MOCK_QUESTION_PERCENT
  );
  const wanted = pct >= 100 ? total : Math.max(1, Math.ceil((total * pct) / 100));
  return Math.min(wanted, total, MAX_SERVED_QUESTIONS);
}

/**
 * Draw the indices for one candidate's paper.
 *
 * Deterministic for a given `seed` string, so two concurrent first-starts
 * produce the same paper and the persisted value is the one that wins either
 * way. With `shuffleQuestions` off the sample is still random but is presented
 * in source order — a random subset in natural order, rather than a biased
 * leading slice of the bank.
 */
export function sampleQuestionIndices(
  poolSize: number,
  questionPercent: number,
  seed: string,
  opts: { shuffleQuestions?: boolean } = {}
): number[] {
  const total = Math.max(0, Math.floor(Number(poolSize) || 0));
  const size = mockSampleSize(total, questionPercent);
  if (size === 0) return [];
  const picked = shuffledIndices(total, mulberry32(hashSeed(seed))).slice(0, size);
  if (opts.shuffleQuestions === false) picked.sort((a, b) => a - b);
  return picked;
}

/**
 * Draw a fixed-*count* sample rather than a percentage.
 *
 * The mock paper is sized as a percentage of the bank, but the real assessment
 * caps its paper by absolute counts (the total `questionLimit` and each domain's
 * `limit`). Shares the seeded shuffle, so a candidate's paper is stable across a
 * reload and two concurrent first-starts agree.
 */
export function sampleIndicesByCount(
  poolSize: number,
  count: number,
  seed: string,
  opts: { shuffleQuestions?: boolean } = {}
): number[] {
  const total = Math.max(0, Math.floor(Number(poolSize) || 0));
  const size = Math.min(total, Math.max(0, Math.floor(Number(count) || 0)), MAX_SERVED_QUESTIONS);
  if (size === 0) return [];
  const picked = shuffledIndices(total, mulberry32(hashSeed(seed))).slice(0, size);
  if (opts.shuffleQuestions === false) picked.sort((a, b) => a - b);
  return picked;
}

/**
 * Drop anything that cannot address the pool: non-integers, negatives, indices
 * past the end, and repeats. Keeps first occurrence, because a duplicated index
 * would otherwise be served twice and graded against the same key.
 */
export function normaliseMockIndices(
  indices: unknown,
  poolSize: number
): number[] {
  const total = Math.max(0, Math.floor(Number(poolSize) || 0));
  if (!Array.isArray(indices)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of indices) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n >= total) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= MAX_SERVED_QUESTIONS) break;
  }
  return out;
}

// ── The served paper ─────────────────────────────────────────────────────────

export type PoolQuestion = {
  type?: string;
  correctIndex?: number;
  marks?: number;
  required?: boolean;
};

/** `[...general, ...chosenDomain.questions]` — the order every index refers to. */
export function flattenQuestionPool<T>(general: T[], domainQuestions: T[] = []): T[] {
  return [...(general || []), ...(domainQuestions || [])];
}

/**
 * The questions a candidate actually saw, in the order they saw them.
 *
 * `indices === null` returns the whole pool in order, which is how the real
 * assessment calls this — so passing null reproduces today's behaviour exactly
 * and the real exam is not routed through the mock sampling at all.
 */
export function buildServedQuestions<T extends PoolQuestion>(
  general: T[],
  domainQuestions: T[] = [],
  indices: number[] | null = null
): T[] {
  const pool = flattenQuestionPool(general, domainQuestions);
  if (indices === null || indices === undefined) return pool;
  const wanted = normaliseMockIndices(indices, pool.length);
  return wanted.map((i) => pool[i]).filter(Boolean);
}

/**
 * Grading key for a served paper.
 *
 * Delegates to the existing projection rather than restating it: a served paper
 * is already flat, so it is passed as the whole "general" list. This is what
 * keeps the mock's scoring identical to the real assessment's.
 */
export function buildServedQuestionKey<T extends PoolQuestion>(served: T[]) {
  return buildAssessmentQuestions(served, []);
}

// ── Window ───────────────────────────────────────────────────────────────────

export type MockWindowPhase =
  /** HR has not switched it on. */
  | "disabled"
  /** On, but the window is misconfigured and no paper can be served. */
  | "unusable"
  /** Configured and valid, but not yet open. */
  | "scheduled"
  /** Startable now. */
  | "open"
  /** The window is still running but the last possible start has passed. */
  | "entry-closed"
  /** The window is over. */
  | "expired";

export type ResolvedMockWindow = {
  phase: MockWindowPhase;
  opensAt: number | null;
  closesAt: number | null;
  /**
   * Latest instant a candidate may press Start.
   *
   * `closesAt - duration`, so that every attempt finishes inside the window HR
   * set. Without this a candidate starting a minute before `closesAt` would sit
   * a full-length paper long after the window shut, which is not what "closes
   * at" means to anyone reading it.
   */
  lastEntryAt: number | null;
  durationMs: number | null;
  durationMinutes: number | null;
};

/**
 * Resolve the mock window against the clock.
 *
 * `fallbackDurationMinutes` is the job's assessment duration, used when the mock
 * has not set its own. Without a duration from one source or the other the
 * window cannot be honoured, hence "unusable".
 */
export function resolveMockWindow(
  config: MockTestConfig,
  nowMs: number = Date.now(),
  fallbackDurationMinutes?: number | null
): ResolvedMockWindow {
  const empty: ResolvedMockWindow = {
    phase: "disabled",
    opensAt: null,
    closesAt: null,
    lastEntryAt: null,
    durationMs: null,
    durationMinutes: null,
  };
  if (!config?.enabled) return empty;

  const opensAt = toMs(config.opensAt);
  const closesAt = toMs(config.closesAt);
  if (opensAt === null || closesAt === null || closesAt <= opensAt) {
    return { ...empty, phase: "unusable", opensAt, closesAt };
  }

  const minutes = config.durationMinutes ?? fallbackDurationMinutes ?? null;
  const durationMs =
    Number(minutes) > 0 ? Math.round(Number(minutes)) * 60_000 : null;
  if (durationMs === null) {
    return { ...empty, phase: "unusable", opensAt, closesAt };
  }

  const lastEntryAt = closesAt - durationMs;
  let phase: MockWindowPhase;
  if (nowMs < opensAt) phase = "scheduled";
  else if (nowMs >= closesAt) phase = "expired";
  else if (nowMs > lastEntryAt) phase = "entry-closed";
  else phase = "open";

  return {
    phase,
    opensAt,
    closesAt,
    lastEntryAt,
    durationMs,
    durationMinutes: Math.round(durationMs / 60_000),
  };
}

/** A candidate's own clock, mirroring getCandidateDeadlineMs() for the real exam. */
export function getMockDeadlineMs(
  attempt: { startedAt?: Date | string | null; proctoring?: { graceMs?: number | null } | null } | null | undefined,
  config: MockTestConfig,
  fallbackDurationMinutes?: number | null
): number | null {
  const started = toMs(attempt?.startedAt);
  if (started === null) return null;
  const minutes = config?.durationMinutes ?? fallbackDurationMinutes ?? null;
  if (!(Number(minutes) > 0)) return null;
  const extra = Math.max(0, Number(attempt?.proctoring?.graceMs) || 0);
  return started + Math.round(Number(minutes)) * 60_000 + extra;
}

// ── Result gating ────────────────────────────────────────────────────────────

export type MockResultVisibility = {
  /** The attempt was handed in, regardless of whether it is visible yet. */
  submitted: boolean;
  visible: boolean;
  answerKeyVisible: boolean;
  /** The instant the result becomes visible, or null if it never will. */
  visibleAt: number | null;
};

/**
 * Whether one attempt's result and answer key may be shown yet.
 *
 * Each attempt is gated on its own submission time, so with a retake limit a
 * first attempt that unlocked yesterday and a second that locked ten minutes
 * ago can be open at the same time.
 */
export function resolveMockResultVisibility(
  config: MockTestConfig,
  attempt: { submittedAt?: Date | string | null } | null | undefined,
  nowMs: number = Date.now()
): MockResultVisibility {
  const submitted = toMs(attempt?.submittedAt);
  if (submitted === null) {
    return { submitted: false, visible: false, answerKeyVisible: false, visibleAt: null };
  }
  if (config?.resultRelease === "never") {
    return { submitted: true, visible: false, answerKeyVisible: false, visibleAt: null };
  }
  const delayMs =
    config?.resultRelease === "delayed"
      ? Math.max(0, Number(config.resultDelayHours) || 0) * 3_600_000
      : 0;
  const visibleAt = submitted + delayMs;
  const visible = nowMs >= visibleAt;
  return {
    submitted: true,
    visible,
    answerKeyVisible: visible && config?.showAnswerKey !== false,
    visibleAt,
  };
}

// ── Attempts ─────────────────────────────────────────────────────────────────

export type MockAttemptLike = {
  startedAt?: Date | string | null;
  submittedAt?: Date | string | null;
  score?: number | null;
  /** The rest of an attempt (domain, questionIndices, answers, marks…) varies. */
  [key: string]: any;
};

export type ResolvedMockAttempt<T> = {
  index: number;
  attempt: T;
} | null;

/**
 * The attempt currently in progress: the first that has started and not yet
 * been handed in.
 *
 * At most one can match, which is what lets every write target a single stable
 * array index instead of a positional `$` operator.
 */
export function resolveActiveMockAttempt<T extends MockAttemptLike>(
  attempts: T[] | null | undefined
): ResolvedMockAttempt<T> {
  if (!Array.isArray(attempts)) return null;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (!attempt) continue;
    if (toMs(attempt.startedAt) === null) continue;
    if (toMs(attempt.submittedAt) !== null) continue;
    return { index: i, attempt };
  }
  return null;
}

/**
 * The best completed attempt, by percentage score. Ties go to the earlier
 * attempt, so a candidate who scores 80 twice is not shown the later one.
 */
export function resolveBestMockAttempt<T extends MockAttemptLike>(
  attempts: T[] | null | undefined
): ResolvedMockAttempt<T> {
  if (!Array.isArray(attempts)) return null;
  let best: ResolvedMockAttempt<T> = null;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (!attempt || toMs(attempt.submittedAt) === null) continue;
    const score = Number(attempt.score);
    if (!Number.isFinite(score)) continue;
    if (!best || score > Number(best.attempt.score)) best = { index: i, attempt };
  }
  return best;
}

/**
 * The best attempt whose result the candidate is entitled to see.
 *
 * Retaking must never hide a score that has already been released: a second
 * attempt submitted today cannot un-publish the first attempt's result from
 * yesterday. So the best is chosen among *released* attempts rather than among
 * all of them, and it is re-evaluated on every load — a later, better attempt
 * simply replaces the earlier one once its own delay elapses.
 */
export function resolveBestReleasedMockAttempt<T extends MockAttemptLike>(
  attempts: T[] | null | undefined,
  config: MockTestConfig,
  nowMs: number = Date.now()
): (ResolvedMockAttempt<T> & { visibility: MockResultVisibility }) | null {
  if (!Array.isArray(attempts)) return null;
  let best: (ResolvedMockAttempt<T> & { visibility: MockResultVisibility }) | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (!attempt) continue;
    const visibility = resolveMockResultVisibility(config, attempt, nowMs);
    if (!visibility.submitted || !visibility.visible) continue;
    const score = Number(attempt.score);
    if (!Number.isFinite(score)) continue;
    if (!best || score > Number(best.attempt.score)) best = { index: i, attempt, visibility };
  }
  return best;
}

// ── Validation ───────────────────────────────────────────────────────────────

export type MockConfigValidation =
  | { ok: true; value: MockTestConfig }
  | { ok: false; error: string };

/**
 * Validate and normalise a config coming from the HR modal.
 *
 * Kept beside the maths rather than in the route so the same rules apply
 * wherever a config is written, and so the route stays a thin shell.
 */
export function validateMockTestConfig(input: unknown, fallbackDurationMinutes?: number | null): MockConfigValidation {
  const raw = (input ?? {}) as Record<string, unknown>;
  const enabled = raw.enabled === true;

  const opensAt = toMs(raw.opensAt as Date);
  const closesAt = toMs(raw.closesAt as Date);
  const duration = Number(raw.durationMinutes);
  const durationMinutes = Number.isFinite(duration) && duration > 0
    ? clampInt(duration, MIN_MOCK_DURATION_MINUTES, MAX_MOCK_DURATION_MINUTES, 60)
    : null;
  const effectiveMinutes = durationMinutes ?? fallbackDurationMinutes ?? null;

  if (enabled) {
    if (opensAt === null) return { ok: false, error: "Choose the date and time the mock test opens." };
    if (closesAt === null) return { ok: false, error: "Choose the date and time the mock test closes." };
    if (closesAt <= opensAt) return { ok: false, error: "The closing time must be after the opening time." };
    if (!(Number(effectiveMinutes) > 0)) {
      return { ok: false, error: "Set how many minutes the mock test runs for." };
    }
    if (closesAt - opensAt < Number(effectiveMinutes) * 60_000) {
      return {
        ok: false,
        error: "The window is shorter than the mock test itself. Candidates could not finish before it closes.",
      };
    }
  }

  const release = MOCK_RESULT_RELEASES.includes(raw.resultRelease as MockResultRelease)
    ? (raw.resultRelease as MockResultRelease)
    : DEFAULT_MOCK_TEST.resultRelease;
  const delay = Number(raw.resultDelayHours);
  if (release === "delayed" && (!Number.isFinite(delay) || delay < 0)) {
    return { ok: false, error: "Enter how many hours after submitting the result should appear." };
  }

  return {
    ok: true,
    value: {
      ...DEFAULT_MOCK_TEST,
      enabled,
      opensAt: opensAt === null ? null : new Date(opensAt),
      closesAt: closesAt === null ? null : new Date(closesAt),
      durationMinutes,
      questionPercent: clampInt(
        raw.questionPercent,
        MIN_MOCK_QUESTION_PERCENT,
        MAX_MOCK_QUESTION_PERCENT,
        DEFAULT_MOCK_QUESTION_PERCENT
      ),
      shuffleQuestions: raw.shuffleQuestions !== false,
      resultRelease: release,
      resultDelayHours:
        release === "delayed"
          ? clampInt(delay, MIN_MOCK_RESULT_DELAY_HOURS, MAX_MOCK_RESULT_DELAY_HOURS, 0)
          : 0,
      showAnswerKey: raw.showAnswerKey !== false,
      maxAttempts: clampInt(raw.maxAttempts, MIN_MOCK_ATTEMPTS, MAX_MOCK_ATTEMPTS, 1),
    },
  };
}
