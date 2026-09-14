"use client";

import type { ATSCandidate } from "@/lib/recruitment-types";

function initials(first?: string, last?: string): string {
  const f = (first || "").trim().charAt(0);
  const l = (last || "").trim().charAt(0);
  return (f + l).toUpperCase() || "?";
}

type Props = {
  candidates: ATSCandidate[];
  onClose: () => void;
};

export function AssessmentCandidatesModal({ candidates, onClose }: Props) {
  const sorted = [...candidates].sort((a, b) => {
    const rank = (c: ATSCandidate) => (c.assessmentSubmittedAt ? 0 : c.assessmentStartedAt ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-soft dark:bg-[#000000]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Assessment Candidates</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              {sorted.length} candidate{sorted.length === 1 ? "" : "s"} will get the test link
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500 dark:text-zinc-400">No candidates are ready to receive the test link yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
              {sorted.map((c) => {
                const submitted = c.assessmentSubmittedAt != null;
                const started = c.assessmentStartedAt != null;
                const statusBadge = submitted
                  ? { label: "Submitted", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" }
                  : started
                    ? { label: "Started", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" }
                    : { label: "Not started", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" };
                return (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                      {initials(c.firstName, c.lastName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                        {c.email}
                        {c.phone ? <><span className="mx-1">·</span>{c.phone}</> : null}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.cls}`}>
                      {statusBadge.label}
                      {submitted && c.assessmentScore != null ? ` · ${c.assessmentScore}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}