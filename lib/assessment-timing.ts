/**
 * Assessment scheduling math.
 *
 * `assessmentDate` is an absolute timestamp and `timeSlots` is a list of
 * "HH:mm" start times on that same calendar day. Every calculation here is plain
 * millisecond arithmetic on absolute instants — no `setHours`/day-boundary
 * construction — so results are identical regardless of the server timezone.
 *
 * Two window modes, chosen per assessment:
 *   - "uniform": the candidate picks a slot and is bound to that slot's fixed
 *     end (slot start + duration). Everyone who picks 09:00 stops at the same
 *     wall-clock time.
 *   - "relief": the candidate may start any time once the configured start is
 *     reached (and until the end of that day), and the full duration counts
 *     from their own start.
 *
 * A shared pre-open lobby runs before the start in both modes: candidates can
 * enter early, read the notice and pick their domain, but questions are not
 * served until the start instant.
 */

export const ASSESSMENT_JOIN_EARLY_MS = 10 * 60 * 1000;

export type AssessmentWindowMode = "uniform" | "relief";

export type AssessmentTimeSlot = { start: string };

export type ResolvedSlot = {
  /** "HH:mm" as configured, used for display and round-tripping. */
  start: string;
  /** Absolute start instant (ms). */
  startMs: number;
  /**
   * Absolute end of this slot's *entry window* (ms): the slot's fixed end in
   * uniform mode (start + duration), the end of the day in relief mode.
   */
  endMs: number;
  /** Absolute end of the exam for anyone anchoring to this slot (start + duration). */
  examEndsAtMs: number;
};

export type ResolveSlotOptions = {
  mode?: AssessmentWindowMode;
  durationMinutes?: number | null;
};

export type AssessmentPhase = "closed" | "lobby" | "open" | "expired";

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function parseHhMm(value: string): number | null {
  const match = HHMM.exec((value || "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 * 60 * 1000 + Number(match[2]) * 60 * 1000;
}

/** Midnight UTC of the day `reference` falls on, in ms. */
function startOfUtcDayMs(reference: number): number {
  return Math.floor(reference / 86_400_000) * 86_400_000;
}

function endOfUtcDayMs(reference: number): number {
  return startOfUtcDayMs(reference) + 86_400_000 - 1;
}

function durationMsOf(durationMinutes: number | null | undefined): number {
  const raw = Number(durationMinutes);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(600, Math.max(1, Math.round(raw))) * 60 * 1000;
}

/**
 * Turn the configured slots into absolute instants sorted earliest-first.
 * With no slots (or none valid) this falls back to a single slot taken from
 * `assessmentDate` itself, so single-slot assessments need no new data.
 *
 * `durationMinutes` and `mode` decide when each slot stops accepting entries:
 * uniform slots close at start + duration, while relief entries stay open to the
 * end of the day. They are optional so legacy single-slot callers that only need
 * the start instants keep working (defaults to relief with no fixed end).
 */
export function resolveAssessmentSlots(
  assessmentDate: string | Date | null | undefined,
  timeSlots?: AssessmentTimeSlot[] | null,
  options: ResolveSlotOptions = {}
): ResolvedSlot[] {
  const base = assessmentDate ? new Date(assessmentDate).getTime() : NaN;
  if (!Number.isFinite(base)) return [];

  const dayStart = startOfUtcDayMs(base);
  const dayEnd = endOfUtcDayMs(base);
  const durationMs = durationMsOf(options.durationMinutes);
  const mode: AssessmentWindowMode = options.mode === "uniform" ? "uniform" : "relief";

  const build = (startMs: number, label: string): ResolvedSlot => {
    const examEndsAtMs = durationMs > 0 ? startMs + durationMs : Number.POSITIVE_INFINITY;
    return {
      start: label,
      startMs,
      // Uniform slots are fixed: they close at their own end, not at midnight.
      endMs: mode === "uniform" ? examEndsAtMs : dayEnd,
      examEndsAtMs,
    };
  };

  const offsets = (timeSlots || [])
    .map((slot) => parseHhMm(slot?.start || ""))
    .filter((ms): ms is number => ms !== null);

  if (!offsets.length) {
    const fallbackOffset = Math.max(0, base - dayStart);
    return [build(dayStart + fallbackOffset, formatHhMm(fallbackOffset))];
  }

  const unique = Array.from(new Set(offsets)).sort((a, b) => a - b);
  return unique.map((offset) => build(dayStart + offset, formatHhMm(offset)));
}

function formatHhMm(offsetMs: number): string {
  const clamped = Math.max(0, Math.min(86_399_999, Math.round(offsetMs)));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** When the waiting room opens for a slot: ten minutes before it starts. */
export function getAssessmentLobbyOpensAt(slot: ResolvedSlot): number {
  return slot.startMs - ASSESSMENT_JOIN_EARLY_MS;
}

/**
 * Last instant at which a candidate may still *enter*. `resolveAssessmentSlots`
 * has already made this mode-aware: the last slot's own end for uniform (its
 * fixed start + duration) and the end of the day for relief.
 */
export function getAssessmentLastEntryAt(slots: ResolvedSlot[]): number {
  if (!slots.length) return 0;
  return slots[slots.length - 1].endMs;
}

/**
 * The anchored start instant for a candidate — what the exam clock counts
 * from. Uniform mode pins this to the slot's fixed start so a skewed client
 * clock cannot hand out extra time; relief mode pins it to the real start.
 */
export function getAssessmentAnchorMs(
  slot: ResolvedSlot,
  mode: AssessmentWindowMode,
  actualStartMs: number = Date.now()
): number {
  return mode === "uniform" ? slot.startMs : actualStartMs;
}

/** The hard deadline for a candidate's exam. */
export function getAssessmentDeadlineMs(
  anchorMs: number,
  durationMinutes: number | null | undefined
): number | null {
  if (!durationMinutes || durationMinutes <= 0) return null;
  return anchorMs + durationMinutes * 60 * 1000;
}

/** The slot a candidate should land on, given an optional explicit choice. */
export function selectAssessmentSlot(
  slots: ResolvedSlot[],
  chosenStartMs?: number | null,
  now: number = Date.now()
): ResolvedSlot | null {
  if (!slots.length) return null;

  if (Number.isFinite(chosenStartMs as number)) {
    const match = slots.find((slot) => slot.startMs === chosenStartMs);
    if (match) return match;
  }

  // Prefer a slot that has not finished yet, then the next one up.
  const upcoming = slots.filter((slot) => slot.endMs >= now);
  return upcoming[0] || slots[slots.length - 1];
}

export type AssessmentPhaseInfo = {
  phase: AssessmentPhase;
  slot: ResolvedSlot | null;
  /** Absolute lobby-open instant for the selected slot. */
  lobbyOpensAt: number;
  /** Absolute start instant for the selected slot. */
  startsAt: number;
  /** Absolute last-entry instant. */
  lastEntryAt: number;
  /** Milliseconds until the lobby opens (0 when already open or too late). */
  untilLobbyMs: number;
  /** Milliseconds until the exam starts (0 once started). */
  untilStartMs: number;
};

export function getAssessmentPhase(
  slots: ResolvedSlot[],
  mode: AssessmentWindowMode,
  chosenStartMs?: number | null,
  now: number = Date.now()
): AssessmentPhaseInfo {
  const slot = selectAssessmentSlot(slots, chosenStartMs, now);
  if (!slot) {
    return {
      phase: "closed",
      slot: null,
      lobbyOpensAt: now,
      startsAt: now,
      lastEntryAt: now,
      untilLobbyMs: 0,
      untilStartMs: 0,
    };
  }

  const lobbyOpensAt = getAssessmentLobbyOpensAt(slot);
  const lastEntryAt = getAssessmentLastEntryAt(slots);

  // Phases, evaluated in order. "expired" has to cover both modes: in uniform
  // mode the last slot's fixed end has passed, and in relief mode the day is
  // over and nobody may enter. Leaving it as a uniform-only check let relief
  // assessments report themselves as "open" forever after midnight.
  let phase: AssessmentPhase;
  if (now >= lastEntryAt) phase = "expired";
  else if (now < lobbyOpensAt) phase = "closed";
  else if (now < slot.startMs) phase = "lobby";
  else phase = "open";

  return {
    phase,
    slot,
    lobbyOpensAt,
    startsAt: slot.startMs,
    lastEntryAt,
    untilLobbyMs: Math.max(0, lobbyOpensAt - now),
    untilStartMs: Math.max(0, slot.startMs - now),
  };
}

/** "1m 24s" / "1h 2m 3s" — shared with the interview countdown. */
export function formatAssessmentCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/** Zero-padded "HH:MM:SS" for the exam/stop clock. */
export function formatAssessmentClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
