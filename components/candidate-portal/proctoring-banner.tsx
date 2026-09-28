"use client";

import { AlertTriangle, Maximize, Users, Volume2, X } from "lucide-react";
import { formatDb } from "@/lib/assessment-proctoring";

/**
 * Non-blocking proctoring notices shown above the questions.
 *
 * Separate from ProctoringOverlay on purpose: a blocking notice hides the paper
 * and needs a click to clear, while these are the things a candidate should be
 * told about while they can still read the paper — a noisy room, a second
 * person in shot, a need to return to fullscreen on a device that supports it
 * poorly.
 */
export function ProctoringBanner({
  noiseWarnings,
  noiseWarningsLeft,
  noiseThresholdDb,
  peakDb,
  multiFaceWarning,
  faceMode,
  fullscreenMissing,
  fullscreenSupported,
  onRestore,
  onDismissFace,
}: {
  noiseWarnings: number;
  noiseWarningsLeft: number;
  noiseThresholdDb: number;
  peakDb: number | null;
  multiFaceWarning: string;
  faceMode: "detector" | "motion" | "off";
  fullscreenMissing: boolean;
  fullscreenSupported: boolean;
  onRestore: () => void;
  onDismissFace: () => void;
}) {
  const notices: Array<{ tone: "amber" | "rose"; body: React.ReactNode; onDismiss?: () => void }> = [];

  if (fullscreenMissing && fullscreenSupported) {
    notices.push({
      tone: "rose",
      body: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Maximize size={13} className="shrink-0" />
          The exam is not in fullscreen. Your questions are hidden until you return.
          <button type="button" onClick={onRestore} className="font-semibold underline">
            Return now
          </button>
        </span>
      ),
    });
  }

  if (multiFaceWarning) {
    notices.push({
      tone: "amber",
      body: (
        <span className="inline-flex items-start gap-1.5">
          <Users size={13} className="mt-0.5 shrink-0" />
          <span>
            {multiFaceWarning}
            {faceMode === "motion" && (
              <span className="block text-[10px] opacity-80">
                Your browser has no face detector, so this is based on movement and may be wrong.
              </span>
            )}
          </span>
        </span>
      ),
      onDismiss: onDismissFace,
    });
  }

  if (noiseWarnings > 0 && peakDb !== null) {
    notices.push({
      tone: "amber",
      body: (
        <span className="inline-flex items-start gap-1.5">
          <Volume2 size={13} className="mt-0.5 shrink-0" />
          <span>
            Background noise is above {formatDb(noiseThresholdDb)} (peaked at {formatDb(peakDb)}).
            {noiseWarningsLeft > 0
              ? ` ${noiseWarningsLeft} more warning${noiseWarningsLeft === 1 ? "" : "s"} will be shown.`
              : " No further noise warnings will be shown."}
          </span>
        </span>
      ),
    });
  }

  if (!notices.length) return null;

  return (
    <div className="space-y-1.5">
      {notices.map((notice, i) => (
        <div
          key={i}
          className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-xs ${
            notice.tone === "rose"
              ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
          }`}
        >
          <span className="min-w-0 flex-1">{notice.body}</span>
          {notice.onDismiss && (
            <button
              type="button"
              onClick={notice.onDismiss}
              className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      {notices.some((n) => n.tone === "rose") && (
        <p className="text-[10px] text-slate-400">
          <AlertTriangle size={10} className="mr-1 inline" />
          Interruptions are recorded and visible to the hiring team.
        </p>
      )}
    </div>
  );
}
