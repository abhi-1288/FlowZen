/**
 * Assessment proctoring: shared config, limits and maths.
 *
 * ── What this can and cannot do ──────────────────────────────────────────────
 * A web page cannot stop a candidate switching tabs, alt-tabbing to another
 * application, or minimising the window. There is no API for it. What a page can
 * do is make each of those costly and visible:
 *
 *   - open fullscreen, so there is no browser chrome or tab strip to click,
 *   - detect leaving fullscreen / hiding the tab / losing window focus,
 *   - replace the paper with a blocking overlay until focus is restored,
 *   - and, because that would otherwise burn the candidate's clock, give the
 *     blocked time back on the server.
 *
 * On camera and privacy:
 *
 *   - The stream is bound to a local, muted <video> element and nothing else.
 *   - No frame is ever captured, uploaded or stored. There is no server endpoint
 *     that accepts media. Saving a frame needs canvas.drawImage(video) and
 *     uploading it needs a fetch; neither exists in this codebase by design.
 *   - Screen capture/casting needs getDisplayMedia(), which this page never
 *     calls. See use-screen-share-guard for the detection side.
 *   - The microphone is measured with an AnalyserNode for loudness only. No audio
 *     is recorded, buffered to disk, or transmitted.
 *
 * On detection reliability, stated plainly so nobody over-trusts it:
 *
 *   - Focus/fullscreen detection is reliable for the events it listens to.
 *   - Multi-face detection uses the native FaceDetector where the browser has
 *     it, and otherwise degrades to a motion-grid heuristic. The heuristic finds
 *     "more than one person-shaped region moving", not faces.
 *   - Screen-share detection is best-effort. A page cannot introspect another
 *     application's capture session, so the only signals available are this
 *     page's own getDisplayMedia being invoked, and focus/visibility loss.
 *
 * This module is deliberately free of any mongoose import. The client-side
 * proctoring hooks import it for the dB maths and constants, and pulling
 * mongoose into a "use client" bundle would be both broken and enormous. The
 * `ATSAssessment.proctoring` sub-schema lives in models/ATSAssessment.ts and
 * takes its defaults from here.
 */

/** Per-assessment proctoring configuration. */
export type ProctoringConfig = {
  enabled: boolean;
  requireCamera: boolean;
  requireMic: boolean;
  requireFullscreen: boolean;
  blockOnFocusLoss: boolean;
  /** Ambient loudness above which the candidate is warned, in dBFS. */
  noiseThresholdDb: number;
  /** How many times the noise warning may fire before it stops nagging. */
  noiseWarningLimit: number;
  requireSingleFace: boolean;
  blockScreenShare: boolean;
};

export const DEFAULT_PROCTORING: ProctoringConfig = {
  enabled: false,
  requireCamera: true,
  requireMic: true,
  requireFullscreen: true,
  blockOnFocusLoss: true,
  noiseThresholdDb: -35,
  noiseWarningLimit: 3,
  requireSingleFace: false,
  blockScreenShare: true,
};

/** How often the mic is sampled for a loudness reading. */
export const NOISE_SAMPLE_INTERVAL_MS = 500;
/** Minimum gap between two noise warnings, so 3 warnings take minutes not milliseconds. */
export const NOISE_WARNING_COOLDOWN_MS = 20_000;
/**
 * Total clock that proctoring interruptions may ever hand back. Without this a
 * candidate could simply leave the tab for the whole exam and get a clock with
 * no end. Each grant is measured server-side, so only time that genuinely
 * elapsed can be claimed, but the cap is what stops it being unbounded.
 */
export const MAX_GRACE_MS = 10 * 60 * 1000;
/** Longest single uninterrupted grant, so a laptop that slept for an hour does not. */
export const MAX_SINGLE_GRACE_MS = 5 * 60 * 1000;
/** Cap on stored log lines per candidate. */
export const MAX_PROCTORING_LOG_ENTRIES = 200;
/** Longest time extension an HR reviewer may grant. */
export const MAX_EXTENSION_MS = 30 * 60 * 1000;
/** Floor/ceiling accepted for the noise threshold, in dBFS. */
export const MIN_NOISE_THRESHOLD_DB = -90;
export const MAX_NOISE_THRESHOLD_DB = 0;

/** Log entry kinds. `detail` is the human-readable text HR sees. */
export type ProctoringLogKind =
  | "violation"
  | "noise"
  | "grace"
  | "grace-capped"
  | "face"
  | "screen-share"
  | "fullscreen-unsupported"
  | "devices"
  | "exempt";

export const PROCTORING_LOG_KINDS: ProctoringLogKind[] = [
  "violation",
  "noise",
  "grace",
  "grace-capped",
  "face",
  "screen-share",
  "fullscreen-unsupported",
  "devices",
  "exempt",
];

/**
 * Root-mean-square of time-domain samples to decibels relative to full scale.
 *
 * 0 dBFS is a clipped full-scale signal, -35 dBFS is roughly 1.8% amplitude,
 * which is a normal speaking voice in a normal room. A true digital silence is
 * about -100 dB, so anything above that is real signal rather than quantisation
 * noise from an all-zero buffer.
 */
export function rmsToDb(rms: number): number {
  if (!(rms > 0)) return -100;
  return 20 * Math.log10(rms);
}

/** Peak absolute amplitude of a time-domain buffer, for clip detection. */
export function peakAmplitude(buffer: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    const value = Math.abs(buffer[i]);
    if (value > peak) peak = value;
  }
  return peak;
}

/**
 * Meter position in 0..1 for a dBFS reading, across the window between
 * `minDb` (silent, 0) and `maxDb` (loud, 1). Clamped, because a live mic can
 * legitimately report above the top of the scale.
 */
export function dbToMeterFraction(db: number, minDb = -60, maxDb = -10): number {
  if (!Number.isFinite(db)) return 0;
  if (db <= minDb) return 0;
  if (db >= maxDb) return 1;
  return (db - minDb) / (maxDb - minDb);
}

/** Reads a dBFS reading as a short label for a log line. */
export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return "n/a";
  if (db <= -100) return "-inf dB";
  return `${Math.round(db * 10) / 10} dB`;
}

/**
 * How much extra time a pause may add, given what has already been granted.
 *
 * Returns the granted amount, the new total, and whether the cap bit — so the
 * caller can log "capped" rather than quietly handing back less than the
 * candidate blocked for.
 */
export function grantGrace(
  currentGraceMs: number,
  blockedMs: number
): { granted: number; total: number; capped: boolean } {
  const current = Math.max(0, Number(currentGraceMs) || 0);
  // Ignore absurd gaps: a sleeping laptop or a clock jump is not an interruption
  // the candidate sat through.
  const requested = Math.max(0, Math.min(Number(blockedMs) || 0, MAX_SINGLE_GRACE_MS));
  const room = Math.max(0, MAX_GRACE_MS - current);
  const granted = Math.min(requested, room);
  return { granted, total: current + granted, capped: granted < requested };
}

/** Human summary of a pause, e.g. "returned after 12s (8s granted, cap reached)". */
export function describeGrace(grantedMs: number, capped: boolean): string {
  const seconds = Math.round(grantedMs / 1000);
  if (seconds < 60) return `returned after ${seconds}s, ${seconds}s added to the clock`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const added = rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  return capped
    ? `returned after ${added}, only ${Math.round(grantedMs / 1000)}s added — the ${Math.round(MAX_GRACE_MS / 60000)} minute cap was reached`
    : `returned after ${added}, ${added} added to the clock`;
}

/** Clamp a stored/logged log array to its cap, keeping the newest entries. */
export function trimProctoringLog<T>(entries: T[]): T[] {
  if (entries.length <= MAX_PROCTORING_LOG_ENTRIES) return entries;
  return entries.slice(entries.length - MAX_PROCTORING_LOG_ENTRIES);
}

/** Read a persisted (possibly partial) config off a document, filling defaults. */
export function resolveProctoringConfig(source: unknown): ProctoringConfig {
  const raw = (source ?? {}) as Partial<ProctoringConfig>;
  const threshold = Number(raw.noiseThresholdDb);
  const limit = Number(raw.noiseWarningLimit);
  return {
    enabled: raw.enabled === true,
    requireCamera: raw.requireCamera !== false,
    requireMic: raw.requireMic !== false,
    requireFullscreen: raw.requireFullscreen !== false,
    blockOnFocusLoss: raw.blockOnFocusLoss !== false,
    noiseThresholdDb: Number.isFinite(threshold)
      ? Math.min(MAX_NOISE_THRESHOLD_DB, Math.max(MIN_NOISE_THRESHOLD_DB, threshold))
      : DEFAULT_PROCTORING.noiseThresholdDb,
    noiseWarningLimit: Number.isFinite(limit)
      ? Math.min(20, Math.max(0, Math.round(limit)))
      : DEFAULT_PROCTORING.noiseWarningLimit,
    requireSingleFace: raw.requireSingleFace === true,
    blockScreenShare: raw.blockScreenShare !== false,
  };
}
