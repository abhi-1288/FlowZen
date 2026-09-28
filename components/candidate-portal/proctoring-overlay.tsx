"use client";

import { AlertTriangle, Maximize, MonitorUp, RefreshCw } from "lucide-react";
import { formatAssessmentClock } from "@/lib/assessment-timing";

/**
 * Covers the paper while the candidate is not in a compliant state.
 *
 * Deliberate design choice: the countdown keeps running and is shown, rather than
 * being hidden. The blocked time is handed back on the server, so the clock is
 * honest, and a candidate who can see it ticking understands that staying away
 * costs them nothing but their own time.
 *
 * The restore button is a real click handler so it can re-request fullscreen,
 * which browsers only allow from a user gesture.
 */
export function ProctoringOverlay({
  reason,
  remainingMs,
  violations,
  graceCapped,
  fullscreenMissing,
  screenShareDetected,
  busy,
  onRestore,
  onRetryCamera,
  onDismissScreenShare,
  tone,
}: {
  reason: string;
  remainingMs: number | null;
  violations: number;
  graceCapped: boolean;
  fullscreenMissing: boolean;
  screenShareDetected: boolean;
  busy: boolean;
  onRestore: () => void;
  onRetryCamera: () => void;
  onDismissScreenShare: () => void;
  tone: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Assessment paused"
    >
      <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#000000] p-6 text-center shadow-2xl">
        <AlertTriangle size={30} className="mx-auto text-rose-400" />
        <h3 className="mt-3 text-base font-semibold text-white">Your assessment is paused</h3>
        <p className="mt-1.5 text-sm text-slate-300">{reason}</p>
        <p className="mt-2 text-xs text-slate-400">
          The questions are hidden until you come back. Time lost here is added back to your clock
          automatically.
        </p>

        {remainingMs !== null && (
          <p className="mt-4 font-mono text-2xl font-bold text-white">
            {formatAssessmentClock(remainingMs)}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {fullscreenMissing && (
            <button
              onClick={onRestore}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: tone }}
            >
              <Maximize size={14} /> {busy ? "Returning..." : "Return to fullscreen"}
            </button>
          )}
          {!fullscreenMissing && !screenShareDetected && (
            <button
              onClick={onRestore}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: tone }}
            >
              <RefreshCw size={14} /> Resume
            </button>
          )}
          {screenShareDetected && (
            <button
              onClick={onDismissScreenShare}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/50 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
            >
              <MonitorUp size={14} /> I stopped sharing
            </button>
          )}
          <button
            onClick={onRetryCamera}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Restart camera
          </button>
        </div>

        {graceCapped && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
            You have reached the limit on how much extra time interruptions can add. Your clock has
            stopped extending.
          </p>
        )}

        <p className="mt-3 text-[11px] text-slate-500">
          {violations === 0
            ? "This is your first interruption."
            : `${violations} interruption${violations === 1 ? "" : "s"} recorded. Your hiring team can see this.`}
        </p>
      </div>
    </div>
  );
}
