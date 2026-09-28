"use client";

import { AlertTriangle, Camera, CheckCircle2, Loader2, Mic, RefreshCw, ShieldCheck } from "lucide-react";
import { VideoSurface } from "@/components/recruitment/interview-room/video-surface";
import { dbToMeterFraction, formatDb } from "@/lib/assessment-proctoring";

/**
 * Device check the candidate must pass before the paper is served.
 *
 * The "Begin assessment" button exists for a specific technical reason, not
 * decoration. In the normal flow the portal opens the exam with `window.open`,
 * and the new document inherits no user gesture — so `requestFullscreen()`
 * called there would be rejected by the browser. A real click here is the only
 * way to get both the fullscreen request and the start POST in the same
 * gesture. `getUserMedia` needs no gesture, which is why the preview is already
 * live before they press it.
 */
export function ProctoringPreflight({
  stream,
  micDb,
  micSupported,
  requireCamera,
  requireMic,
  requireFullscreen,
  fullscreenSupported,
  noiseThresholdDb,
  noiseWarningLimit,
  status,
  error,
  ready,
  busy,
  onRetry,
  onBegin,
  tone,
}: {
  stream: MediaStream | null;
  micDb: number | null;
  micSupported: boolean;
  requireCamera: boolean;
  requireMic: boolean;
  requireFullscreen: boolean;
  fullscreenSupported: boolean;
  noiseThresholdDb: number;
  noiseWarningLimit: number;
  status: "idle" | "requesting" | "ready" | "error";
  error: string;
  ready: boolean;
  busy: boolean;
  onRetry: () => void;
  onBegin: () => void;
  tone: string;
}) {
  const cameraOk = !requireCamera || Boolean(stream?.getVideoTracks().some((t) => t.enabled));
  const micOk = !requireMic || Boolean(stream?.getAudioTracks().some((t) => t.enabled));
  const micReadingOk = !requireMic || micDb === null || micDb <= noiseThresholdDb;
  const blocked = status === "error" || !cameraOk || !micOk;
  // A room that is already too loud is a warning, not a lock: the candidate may
  // genuinely have no control over their surroundings.
  const warning = requireMic && micDb !== null && micDb > noiseThresholdDb;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            This assessment is proctored
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Check yourself in, then begin. The exam opens fullscreen and stays there until you submit.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <div className="space-y-2">
          <VideoSurface
            stream={stream}
            muted
            mirror
            label="Camera preview"
            className="aspect-video w-full"
          />
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
            <Camera size={12} />
            <span>
              {cameraOk ? "Camera on" : requireCamera ? "Camera required" : "No camera"}
            </span>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-400">
            This preview stays on your own screen. Nothing is recorded, uploaded or shared.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300">
              <Mic size={12} /> Background noise
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full transition-[width] duration-150 ${
                  warning ? "bg-rose-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.round(dbToMeterFraction(micDb ?? -100) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
              {!requireMic
                ? "Microphone not required for this assessment."
                : !micSupported
                  ? "This browser cannot measure microphone level; the check is unavailable."
                  : micDb === null
                    ? "Waiting for the microphone..."
                    : `Now ${formatDb(micDb)} · you will be warned above ${formatDb(noiseThresholdDb)}, up to ${noiseWarningLimit} time${noiseWarningLimit === 1 ? "" : "s"}.`}
            </p>
          </div>

          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 size={13} className={`mt-0.5 shrink-0 ${cameraOk ? "text-emerald-600" : "text-rose-500"}`} />
              <span>
                {cameraOk
                  ? "Camera is working."
                  : requireCamera
                    ? "No camera available. This assessment cannot start without one."
                    : "No camera available, which is fine for this assessment."}
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 size={13} className={`mt-0.5 shrink-0 ${micOk ? "text-emerald-600" : "text-rose-500"}`} />
              <span>
                {micOk
                  ? "Microphone is working."
                  : requireMic
                    ? "No microphone available. This assessment cannot start without one."
                    : "No microphone available, which is fine for this assessment."}
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2
                size={13}
                className={`mt-0.5 shrink-0 ${
                  !requireFullscreen || !fullscreenSupported ? "text-slate-400" : "text-emerald-600"
                }`}
              />
              <span>
                {!requireFullscreen
                  ? "Fullscreen is not enforced for this assessment."
                  : !fullscreenSupported
                    ? "This browser does not support fullscreen, so it will not be enforced on your device."
                    : "The exam will open fullscreen and ask you to return if you leave it."}
              </span>
            </li>
          </ul>

          {warning && (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                It is noisy where you are right now. You can still begin, but you may be warned up
                to {noiseWarningLimit} time{noiseWarningLimit === 1 ? "" : "s"}.
              </span>
            </p>
          )}

          {error && (
            <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === "error" && (
          <button
            onClick={onRetry}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            <RefreshCw size={14} /> Try again
          </button>
        )}
        <button
          onClick={onBegin}
          disabled={blocked || busy || status === "requesting" || !ready}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: tone }}
        >
          {busy || status === "requesting" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {status === "requesting" ? "Opening devices..." : busy ? "Starting..." : "Begin assessment"}
        </button>
      </div>
    </div>
  );
}
