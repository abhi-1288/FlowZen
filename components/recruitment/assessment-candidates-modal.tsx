"use client";

import { useEffect, useState } from "react";
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
  onRefresh?: () => void;
  onClose: () => void;
};

export function AssessmentCandidatesModal({ candidates, slots, jobId, assessmentDate, onRefresh, onClose }: Props) {
  const { showSuccessToast, showErrorToast } = useNotificationToast();
  const [rows, setRows] = useState<ATSCandidate[]>(candidates);
  // The job doc's `assessment` is only a boolean flag, so the page cannot supply
  // the real slots. Load them from the assessment document instead.
  const [liveSlots, setLiveSlots] = useState<string[]>(slots);
  const [liveDate, setLiveDate] = useState<string | null>(assessmentDate);
  const [filter, setFilter] = useState<string>("all");
  const [assigning, setAssigning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => setRows(candidates), [candidates]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/recruitment/jobs/${jobId}/assessment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        const saved: string[] = Array.isArray(data.assessment?.timeSlots)
          ? data.assessment.timeSlots.map((s: any) => String(s?.start || "")).filter(Boolean)
          : [];
        if (saved.length) setLiveSlots(saved);
        const date = data.job?.assessmentDate;
        if (date) setLiveDate(String(date));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [jobId]);

  const sorted = [...rows].sort((a, b) => {
    const rank = (c: ATSCandidate) => (c.assessmentSubmittedAt ? 0 : c.assessmentStartedAt ? 1 : 2);
    return rank(a) - rank(b);
  });

  const slotOptions = liveSlots.length ? liveSlots : ["single"];

  /** IST wall-clock label with an explicit AM/PM so 12:00 is never read as midnight. */
  function formatAssigned(value?: string | null): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const h24 = ist.getUTCHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const mm = String(ist.getUTCMinutes()).padStart(2, "0");
    return `${h12}:${mm} ${h24 >= 12 ? "PM" : "AM"}`;
  }

  function formatAssignedFull(value?: string | null): string {
    const time = formatAssigned(value);
    if (!time) return "";
    const d = new Date(value as string);
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const dd = String(ist.getUTCDate()).padStart(2, "0");
    const mo = String(ist.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = ist.getUTCFullYear();
    return `${dd}/${mo}/${yyyy}, ${time}`;
  }

  /** 24-hour IST key used only for matching the filter dropdown values. */
  const slotKey = (c: ATSCandidate) =>
    c.assessmentSlotStart
      ? new Date(c.assessmentSlotStart).toLocaleTimeString("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "single";

  const filtered = filter === "all" ? sorted : sorted.filter((c) => slotKey(c) === filter);

  const assignCandidates = async (list: ATSCandidate[], silent = false) => {
    if (list.length === 0) {
      if (!silent) showErrorToast("No candidates available to assign.");
      return false;
    }
    const k = slotOptions.length;
    const n = list.length;
    const base = Math.floor(n / k);
    const rem = n % k;
    const preview = slotOptions.map((s, i) => `${s}: ${base + (i < rem ? 1 : 0)}`).join(", ");
    setAssigning(true);
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment/assign-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: slotOptions,
          assessmentDate: liveDate,
          candidateIds: list.map((c) => c.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "assign failed");
      // Trust the values read back from Mongo, not a client-side reconstruction.
      const stored: Array<{ id: string; assessmentSlotStart: string | null }> = Array.isArray(data.candidates)
        ? data.candidates
        : [];
      const byId = new Map(stored.map((r) => [r.id, r.assessmentSlotStart]));
      setRows((prev) =>
        prev.map((c) => ({
          ...c,
          assessmentSlotStart: byId.has(c.id) ? (byId.get(c.id) ?? null) : c.assessmentSlotStart,
        }))
      );
      setOptimized(true);
      onRefresh?.();
      if (!silent) showSuccessToast(`Candidates assigned across ${k} slots. ${preview}`);
      return true;
    } catch (err) {
      if (!silent) showErrorToast(err instanceof Error && err.message ? err.message : "Could not auto-optimize candidate slots.");
      return false;
    } finally {
      setAssigning(false);
    }
  };

  const resetTimes = async () => {
    setResetting(true);
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment/reset-assignments`, { method: "POST" });
      if (!res.ok) throw new Error("reset failed");
      setRows((prev) => prev.map((c) => ({ ...c, assessmentSlotStart: null })));
      setOptimized(false);
      onRefresh?.();
      showSuccessToast("Assigned times removed for all candidates.");
    } catch {
      showErrorToast("Could not reset candidate times.");
    } finally {
      setResetting(false);
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

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-zinc-800">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <option value="all">All slots</option>
            {slotOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => void resetTimes()}
            disabled={resetting || assigning || sorted.length === 0}
            className="rounded-md border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 disabled:opacity-50 dark:border-amber-900/60 dark:text-amber-300"
          >
            {resetting ? "Resetting…" : "Reset time for all"}
          </button>
          <button onClick={() => void assignCandidates(sorted)} disabled={assigning || resetting} className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
            {assigning ? "Assigning…" : "Auto-optimize slots"}
          </button>
          {(optimized || sorted.some((c) => c.assessmentSlotStart)) && (
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
                        {c.email} · {formatAssignedFull(c.assessmentSlotStart) || "unassigned"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
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
