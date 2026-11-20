"use client";

import { useState } from "react";
import type { ATSCandidate } from "@/lib/recruitment-types";
import { useNotificationToast } from "@/lib/toast-context";

function initials(first?: string, last?: string): string {
  const f = (first || "").trim().charAt(0);
  const l = (last || "").trim().charAt(0);
  return (f + l).toUpperCase() || "?";
}

type Props = {
  candidates: ATSCandidate[];
  slots: string[];
  jobId: string;
  assessmentDate: string | null;
  onClose: () => void;
};

export function AssessmentCandidatesModal({ candidates, slots, jobId, assessmentDate, onClose }: Props) {
  const { showSuccessToast, showErrorToast } = useNotificationToast();
  const [filter, setFilter] = useState<string>("all");
  const [assigning, setAssigning] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [inviting, setInviting] = useState(false);
  const sorted = [...candidates].sort((a, b) => {
    const rank = (c: ATSCandidate) => (c.assessmentSubmittedAt ? 0 : c.assessmentStartedAt ? 1 : 2);
    return rank(a) - rank(b);
  });

  const slotOptions = slots.length ? slots : ["single"];

  const filtered = filter === "all" ? sorted : sorted.filter((c) => (c.assessmentSlotStart ? new Date(c.assessmentSlotStart).toLocaleTimeString() : "single") === filter);

  const autoAssign = async () => {
    if (sorted.length === 0) {
      showErrorToast("No candidates available to assign.");
      return;
    }
    const k = slotOptions.length;
    const n = sorted.length;
    const base = Math.floor(n / k);
    const rem = n % k;
    const preview = slotOptions.map((s, i) => `${s}: ${base + (i < rem ? 1 : 0)}`).join(", ");
    setAssigning(true);
    try {
      const n = sorted.length;
      const k = slotOptions.length;
      // distribute n across k as evenly as possible
      const base = Math.floor(n / k);
      const rem = n % k;
      let idx = 0;
      for (let s = 0; s < k; s++) {
        const count = base + (s < rem ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const c = sorted[idx++];
          if (!c) break;
          const slotTime = slotOptions[s];
          const [hh, mm] = slotTime.split(":").map(Number);
          const base = assessmentDate ? new Date(assessmentDate) : new Date();
          const assigned = new Date(base);
          assigned.setHours(hh || 0, mm || 0, 0, 0);
          await fetch(`/api/recruitment/candidates/${c.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assessmentSlotStart: assigned.toISOString() }),
          });
        }
      }
      setOptimized(true);
      showSuccessToast(`Candidates assigned across ${k} slots. ${preview}`);
    } catch {
      showErrorToast("Could not auto-optimize candidate slots.");
    } finally {
      setAssigning(false);
    }
  };

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

        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-zinc-800">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <option value="all">All slots</option>
            {slotOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={autoAssign} disabled={assigning} className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
            {assigning ? "Assigning…" : "Auto-optimize slots"}
          </button>
          {optimized && (
            <button
              onClick={async () => {
                setInviting(true);
                try {
                  const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment/invite`, { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed");
                  showSuccessToast(`Invite emails sent to ${data.emailed} candidate(s).`);
                } catch {
                  showErrorToast("Could not send invite emails.");
                } finally {
                  setInviting(false);
                }
              }}
              disabled={inviting}
              className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {inviting ? "Sending…" : "Send invite emails now"}
            </button>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500 dark:text-zinc-400">No candidates are ready to receive the test link yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.map((c) => {
                const submitted = c.assessmentSubmittedAt != null;
                const started = c.assessmentStartedAt != null;
                const statusBadge = submitted
                  ? { label: "Submitted", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" }
                  : started
                    ? { label: "Started", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-emerald-300" }
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
                        {c.email} · {c.assessmentSlotStart ? new Date(c.assessmentSlotStart).toLocaleString() : "unassigned"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.cls.includes("emerald") ? statusBadge.label : statusBadge.label}</span>
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