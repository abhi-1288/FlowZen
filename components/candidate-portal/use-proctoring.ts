"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProctoringConfig } from "@/lib/assessment-proctoring";
import { NOISE_WARNING_COOLDOWN_MS } from "@/lib/assessment-proctoring";
import { useMicLevel } from "./use-mic-level";
import { useFocusGuard } from "./use-focus-guard";
import { useFaceWatch } from "./use-face-watch";
import { useScreenShareGuard } from "./use-screen-share-guard";

/**
 * Wires the four client-side checks to the server log and the blocking overlay.
 *
 * The four checks are deliberately different in kind:
 *
 *   focus / fullscreen  → blocks the paper and gives the time back
 *   screen sharing       → blocks, best-effort only
 *   multiple faces      → warns, because the fallback detector is a heuristic
 *   background noise    → warns a fixed number of times and then stops
 *
 * Every event is posted fire-and-forget. A failed report must never interrupt
 * the exam, so errors are swallowed deliberately — the worst case of a lost
 * report is one missing line in a log HR reads afterwards.
 */
export type ProctoringState = {
  active: boolean;
  blocked: boolean;
  blockedReason: string;
  fullscreenMissing: boolean;
  fullscreenSupported: boolean;
  violations: number;
  noiseWarnings: number;
  noiseWarningsLeft: number;
  peakDb: number | null;
  micFraction: number;
  multiFaceWarning: string;
  faceMode: "detector" | "motion" | "off";
  screenShareDetected: boolean;
  graceCapped: boolean;
  requestFullscreen: () => Promise<boolean>;
  retryCamera: () => void;
  dismissFaceWarning: () => void;
  dismissScreenShare: () => void;
};

export function useProctoring(params: {
  token: string;
  stream: MediaStream | null;
  /** True only while the candidate is actually sitting the paper. */
  running: boolean;
  config: (ProctoringConfig & { active?: boolean }) | null | undefined;
  cameraReady: boolean;
  onRetryCamera: () => void;
}): ProctoringState {
  const { token, stream, running, config, cameraReady, onRetryCamera } = params;

  const active = Boolean(running && config?.active);
  const requireFullscreen = config?.requireFullscreen !== false;
  const blockOnFocusLoss = config?.blockOnFocusLoss !== false;
  const thresholdDb = config?.noiseThresholdDb ?? -35;
  const warningLimit = config?.noiseWarningLimit ?? 3;
  const requireSingleFace = config?.requireSingleFace === true;
  const blockScreenShare = config?.blockScreenShare !== false;

  const [violations, setViolations] = useState(0);
  const [noiseWarnings, setNoiseWarnings] = useState(0);
  const [graceCapped, setGraceCapped] = useState(false);
  const [multiFaceWarning, setMultiFaceWarning] = useState("");

  const post = useCallback(
    (event: string, body?: Record<string, unknown>) => {
      void fetch(`/api/public/candidate/me/assessment/proctoring?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, ...body }),
        keepalive: true,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || data.ignored) return;
          if (typeof data.violations === "number") setViolations(data.violations);
          if (typeof data.noiseWarnings === "number") setNoiseWarnings(data.noiseWarnings);
          // A grant that did not move the total means the cap was already hit.
          if (event === "resume" && data.graceCapped) setGraceCapped(true);
        })
        .catch(() => {
          // Intentionally swallowed: a lost log line is better than a stalled exam.
        });
    },
    [token]
  );

  const focus = useFocusGuard(active, { requireFullscreen, blockOnFocusLoss });
  const mic = useMicLevel(stream, active && (config?.requireMic !== false));
  const screen = useScreenShareGuard(active, {
    block: blockScreenShare,
    onDetected: (detail) => post("screen-share", { detail }),
  });
  const face = useFaceWatch(stream, active && requireSingleFace, {
    onExtraFaces: (count) => post("face", { count }),
  });

  // ── Interruptions: pause on the way out, resume on the way back ───────────
  // A ref rather than state, because these fire in bursts (ESC also blurs the
  // window, and so does alt-tab) and a second POST for the same interruption
  // would lose the time in between.
  const pausedRef = useRef(false);
  const interruption = focus.blocked || screen.blocked;

  useEffect(() => {
    if (!active) {
      pausedRef.current = false;
      return;
    }
    if (interruption && !pausedRef.current) {
      pausedRef.current = true;
      setViolations((v) => v + 1);
      post("pause", { reason: focus.reason || "screen sharing detected" });
    } else if (!interruption && pausedRef.current) {
      pausedRef.current = false;
      post("resume");
    }
  }, [active, interruption, focus.reason, post]);

  // Leaving the exam entirely (navigating away, closing the tab) must not leave
  // the server believing the candidate is still blocked, which would strand the
  // pause stamp and swallow the next grant.
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const release = () => {
      if (pausedRef.current) {
        pausedRef.current = false;
        post("resume");
      }
    };
    window.addEventListener("pagehide", release);
    window.addEventListener("beforeunload", release);
    return () => {
      window.removeEventListener("pagehide", release);
      window.removeEventListener("beforeunload", release);
      release();
    };
  }, [active, post]);

  // Screen share is block-worthy, and `screen.blocked` already tracks the
  // guard's own state — no mirror needed, the guard is the source of truth.
  useEffect(() => {
    if (!face.warned) {
      setMultiFaceWarning("");
      return;
    }
    setMultiFaceWarning(
      face.mode === "detector"
        ? `${face.extraFaces} faces are visible. Only you should be in frame.`
        : "More than one person-sized movement was detected in frame. Only you should be in frame."
    );
  }, [face.warned, face.extraFaces, face.mode]);

  // ── Noise: warn a fixed number of times, then stay quiet ─────────────────
  const lastNoiseRef = useRef(0);
  useEffect(() => {
    if (!active || mic.db === null) return;
    if (mic.db <= thresholdDb) return;
    if (noiseWarnings >= warningLimit) return;
    const now = Date.now();
    // The cooldown is what turns "3 warnings" into three separated events
    // instead of three identical ones inside a single second of a door slam.
    if (now - lastNoiseRef.current < NOISE_WARNING_COOLDOWN_MS) return;
    lastNoiseRef.current = now;
    setNoiseWarnings((n) => n + 1);
    post("noise", { db: mic.db });
  }, [active, mic.db, thresholdDb, noiseWarnings, warningLimit, post]);

  // A camera that drops mid-exam re-opens the same paper the preflight blocked.
  useEffect(() => {
    if (!running || !active || !config) return;
    if (config.requireCamera && !cameraReady) {
      post("note", { detail: "camera stopped during the assessment" });
    }
  }, [running, active, config, cameraReady, post]);

  const blocked = active && (focus.blocked || screen.blocked);

  return {
    active,
    blocked,
    blockedReason: focus.blocked
      ? focus.reason
      : screen.blocked
        ? "Screen sharing was detected."
        : "",
    fullscreenMissing: focus.fullscreenMissing,
    fullscreenSupported: focus.fullscreenSupported,
    violations,
    noiseWarnings,
    noiseWarningsLeft: Math.max(0, warningLimit - noiseWarnings),
    peakDb: mic.db,
    micFraction: mic.fraction,
    multiFaceWarning,
    faceMode: face.mode,
    screenShareDetected: screen.detected,
    graceCapped,
    requestFullscreen: focus.requestFullscreen,
    retryCamera: onRetryCamera,
    dismissFaceWarning: () => setMultiFaceWarning(""),
    dismissScreenShare: () => screen.acknowledge(),
  };
}
