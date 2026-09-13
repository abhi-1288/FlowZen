"use client";

import { useState } from "react";

type Props = {
  data: {
    total: number;
    passed: number;
    failed: number;
  } | null;
  onClose: () => void;
  onSubmit: (mode: "auto" | "manual", note: string) => Promise<void>;
};

export function AssessmentResultsModal({ data, onClose, onSubmit }: Props) {
  const [action, setAction] = useState<"auto" | "manual">("auto");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!data) return null;

  async function handleSubmit() {
    setLoading(true);
    try {
      await onSubmit(action, note.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-soft dark:bg-[#000000]">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Update candidate timelines from assessment results?</h2>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 dark:bg-zinc-900 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{data.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{data.passed}</p>
              <p className="text-xs text-emerald-600">Passed</p>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-500/10 p-3 text-center">
              <p className="text-2xl font-bold text-rose-700">{data.failed}</p>
              <p className="text-xs text-rose-600">Failed</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Assessment timeline action</span>
              <select value={action} onChange={(e) => setAction(e.target.value as "auto" | "manual")} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800">
                <option value="auto">Auto-advance (reject assessment-failed, move passed to Technical Interview)</option>
                <option value="manual">Manual review (leave stages as-is)</option>
              </select>
            </label>
            {action === "auto" && (
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                Passed candidates still in Assessment will be moved to Technical Interview. Failed candidates will be moved to ATS Rejected. Offer and Joined stages are never auto-changed.
              </p>
            )}
          </div>

          <div className="mt-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Rejection note (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Type a reason for rejection. If left empty, an automatic assessment-based reason will be recorded."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
              />
            </label>
            <p className="mt-1 text-xs text-slate-400">{note.trim() ? "A manual note will be saved." : "An auto note (score vs. threshold + assessment reason) will be saved."}</p>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Mark them later
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}