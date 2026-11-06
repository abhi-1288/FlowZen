"use client";

import { useCallback, useEffect, useState } from "react";
import { X, RotateCcw, Loader2, AlertTriangle, Eye } from "lucide-react";
import { AssessmentPanel } from "@/components/candidate-portal/assessment-panel";

/**
 * Modal wrapper for the HR candidate-experience preview.
 *
 * It deliberately renders the candidate panel itself rather than a look-alike:
 * whatever the panel shows a candidate — the start button, the proctoring
 * preflight walkthrough, the exam header with the real countdown, the result
 * card — is exactly what HR sees, driven by the same component the candidate
 * uses. Remounting on "Restart preview" gives the paper back to its initial
 * state (fresh component state, plus a fresh info fetch so edits made in
 * between are picked up).
 *
 * When the job's question bank is empty the preview does not dead-end: it says
 * so up front, and the panel then runs on flagged sample questions so HR can
 * still walk the whole experience.
 */

type Props = {
  jobId: string;
  mode: "assessment" | "mock";
  accent: string;
  companyName?: string;
  onClose: () => void;
};

export function AssessmentPreviewModal({ jobId, mode, accent, companyName, onClose }: Props) {
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Each restart bumps the key so the panel's internal state resets cleanly.
  const [runKey, setRunKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (mode === "mock") params.set("mode", "mock");
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment/preview?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load the candidate preview.");
        setPayload(null);
        return;
      }
      setPayload(json);
    } catch {
      setError("Could not load the candidate preview.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, mode]);

  useEffect(() => {
    void load();
  }, [load, runKey]);

  function restart() {
    setRunKey((k) => k + 1);
  }

  const trackLabel = mode === "mock" ? "Mock Test" : "Online Assessment";
  const mockOff = mode === "mock" && payload && payload.mockEnabled === false;
  const bankEmpty = payload && Number(payload.questionTotal ?? 0) === 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 px-4 py-8">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-soft dark:bg-[#000000]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-zinc-100">
              <Eye size={15} style={{ color: accent }} className="shrink-0" />
              <span className="truncate">Candidate preview — {trackLabel}</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              Nothing is saved, submitted or emailed.{" "}
              {mode === "mock"
                ? "Results release immediately here so you can see the outcome screen."
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {payload && (
              <button
                onClick={restart}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RotateCcw size={13} /> Restart preview
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[85vh] space-y-4 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-md px-3 py-10 text-sm text-slate-500 dark:text-zinc-400">
              <Loader2 size={16} className="animate-spin" /> Preparing the candidate preview…
            </div>
          )}

          {!loading && error && (
            <div>
              <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {error} {!error.includes("date") && "— there may be nothing to preview for this job yet."}
                </span>
              </p>
              <button
                onClick={() => void load()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RotateCcw size={13} /> Try again
              </button>
            </div>
          )}

          {!loading && payload && mockOff && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <strong>The mock test is switched off for this job.</strong> Candidates see no mock card at all in
              this state. Switch it on under the Mock Test modal on the job page, then preview again.
            </p>
          )}

          {!loading && payload && !mockOff && bankEmpty && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <strong>No questions in the bank yet.</strong> The preview will run on clearly marked sample
              questions so you can still walk the whole flow — device check, countdown, grading and the result
              screen. Add the real paper under <strong>Manage Assessment</strong> before the window opens;
              until then candidates would see “questions not available”.
            </p>
          )}

          {!loading && payload && !mockOff && (
            <AssessmentPanel
              // Preview-only token: never used for a fetch while previewing, other
              // than as a cache key namespace the preview path does not touch.
              token={`preview-${runKey}`}
              assessment={payload}
              accent={accent}
              companyName={companyName}
              onRefresh={() => void load()}
              mode={mode}
              preview
              previewJobId={jobId}
            />
          )}

          <p className="text-center text-xs text-slate-400 dark:text-zinc-500">
            Preview mode · question sampling and scoring run on the same code paths as the real sitting, but no
            candidate record is touched and no email is sent.
          </p>
        </div>
      </div>
    </div>
  );
}
