"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Volume2,
  Users,
  MonitorUp,
  Timer,
} from "lucide-react";

/**
 * HR/Admin view of one candidate's proctoring record.
 *
 * Kept as its own component because it is the only place the stored log is
 * rendered, and the candidate projection in lib/candidate-visibility.ts is an
 * allowlist that never includes it.
 *
 * Two things it deliberately does *not* do: decide anything, and present the
 * numbers as proof. A violation count is evidence that the guard fired, not
 * evidence of misconduct — a candidate on a locked-down machine trips it exactly
 * as readily as one cheating. The copy says so, because a count of 4 is not a
 * verdict and an HR team reading it as one will reject somebody unfairly.
 */

type Entry = { at?: string; kind?: string; detail?: string };

const KIND_STYLE: Record<string, string> = {
  violation: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  "grace-capped": "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  grace: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  noise: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  face: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  "screen-share": "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  "fullscreen-unsupported": "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
  devices: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
  exempt: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  note: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const KIND_ICON: Record<string, typeof Clock> = {
  violation: AlertTriangle,
  "grace-capped": AlertTriangle,
  grace: Timer,
  noise: Volume2,
  face: Users,
  "screen-share": MonitorUp,
  devices: ShieldCheck,
  exempt: ShieldOff,
};

export function ProctoringPanel({
  candidateId,
  proctoring,
  isLive,
  onChanged,
}: {
  candidateId: string;
  proctoring: {
    violations?: number;
    noiseWarnings?: number;
    graceMs?: number;
    extensionMs?: number;
    peakNoiseDb?: number;
    multiFaceEvents?: number;
    screenShareAttempts?: number;
    exempt?: boolean;
    exemptReason?: string;
    extensionRequestStatus?: "none" | "pending" | "approved" | "denied";
    extensionRequestedMs?: number;
    extensionRequestNote?: string;
    log?: Entry[];
  } | null;
  /** True while the candidate is mid-paper, so live actions are meaningful. */
  isLive: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [exemptReason, setExemptReason] = useState("");
  const [approveMinutes, setApproveMinutes] = useState(5);
  const [decisionNote, setDecisionNote] = useState("");

  if (!proctoring) return null;

  const log = proctoring.log ?? [];
  const minutes = (ms: number) => Math.round((ms || 0) / 60000);
  const hasAnything =
    log.length > 0 ||
    (proctoring.violations ?? 0) > 0 ||
    (proctoring.noiseWarnings ?? 0) > 0 ||
    Boolean(proctoring.exempt) ||
    (proctoring.extensionMs ?? 0) > 0;

  if (!hasAnything) return null;

  const call = async (path: string, body: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mt-3 border-t border-[var(--c-border-light)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Proctoring record
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {proctoring.exempt && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              Exempt
            </span>
          )}
          {(proctoring.violations ?? 0) > 0 && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {(proctoring.violations ?? 0)} interruption{(proctoring.violations ?? 0) === 1 ? "" : "s"}
            </span>
          )}
          {(proctoring.noiseWarnings ?? 0) > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {(proctoring.noiseWarnings ?? 0)} noise warning{(proctoring.noiseWarnings ?? 0) === 1 ? "" : "s"}
            </span>
          )}
          {(proctoring.extensionMs ?? 0) > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              +{minutes(proctoring.extensionMs ?? 0)} min granted
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <Stat label="Extra time given back" value={`${minutes(proctoring.graceMs ?? 0)} min`} hint="For time lost to interruptions, capped at 10 minutes" />
            <Stat label="HR extension granted" value={`${minutes(proctoring.extensionMs ?? 0)} min`} />
            <Stat label="Loudest reading" value={proctoring.peakNoiseDb != null && proctoring.peakNoiseDb > -100 ? `${Math.round(proctoring.peakNoiseDb * 10) / 10} dB` : "—"} />
            <Stat label="Multi-face / share events" value={`${proctoring.multiFaceEvents ?? 0} / ${proctoring.screenShareAttempts ?? 0}`} />
          </div>

          {proctoring.exempt && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-[11px] text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300">
              Proctoring waived: {proctoring.exemptReason || "no reason recorded"}
            </p>
          )}

          {(proctoring.violations ?? 0) > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
              These are signals that the fullscreen or focus guard fired, not proof of misconduct. A
              locked-down machine, a system notification, or a misclick produces the same record as
              someone looking up an answer. Read the log below before deciding anything.
            </p>
          )}

          {proctoring.extensionRequestStatus === "pending" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-500/10">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Candidate asked for {minutes(proctoring.extensionRequestedMs ?? 0)} extra minute(s)
                {isLive ? "" : " — the paper is already closed, so approving only affects the record"}
              </p>
              {proctoring.extensionRequestNote && (
                <p className="mt-1 text-[11px] italic text-amber-800 dark:text-amber-300">
                  &ldquo;{proctoring.extensionRequestNote}&rdquo;
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={approveMinutes}
                  onChange={(e) => setApproveMinutes(Math.min(30, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs outline-none dark:border-amber-800 dark:bg-zinc-900"
                />
                <span className="text-[11px] text-amber-800 dark:text-amber-300">minutes to grant</span>
                <input
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="min-w-[8rem] flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs outline-none dark:border-amber-800 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  disabled={busy === "approve" || !isLive}
                  onClick={() =>
                    void call(
                      `/api/recruitment/candidates/${candidateId}/extension`,
                      { decision: "approved", minutes: approveMinutes, note: decisionNote },
                      "approve"
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy === "approve" ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Approve
                </button>
                <button
                  type="button"
                  disabled={busy === "deny"}
                  onClick={() =>
                    void call(
                      `/api/recruitment/candidates/${candidateId}/extension`,
                      { decision: "denied", note: decisionNote },
                      "deny"
                    )
                  }
                  className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300"
                >
                  Deny
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-[11px] text-slate-500">
                {proctoring.exempt ? "Reason stored on the record" : "Reason for waiving proctoring"}
              </span>
              <input
                value={exemptReason}
                onChange={(e) => setExemptReason(e.target.value)}
                placeholder="e.g. Corporate laptop, camera blocked by policy"
                className="w-full rounded-lg border border-[var(--c-border-light)] bg-[var(--c-bg-card)] px-2.5 py-1.5 text-xs outline-none"
              />
            </label>
            <button
              type="button"
              disabled={busy === "exempt" || (!proctoring.exempt && exemptReason.trim().length < 4)}
              onClick={() =>
                void call(
                  `/api/recruitment/candidates/${candidateId}/proctoring-exemption`,
                  { exempt: !proctoring.exempt, reason: exemptReason },
                  "exempt"
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                proctoring.exempt
                  ? "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300"
                  : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              }`}
            >
              {busy === "exempt" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : proctoring.exempt ? (
                <ShieldCheck size={12} />
              ) : (
                <ShieldOff size={12} />
              )}
              {proctoring.exempt ? "Re-enable proctoring" : "Waive proctoring"}
            </button>
          </div>

          {error && <p className="text-[11px] text-rose-600">{error}</p>}

          {log.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-slate-500">Session log ({log.length})</p>
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-[var(--c-border-light)] p-2">
                {log
                  .slice()
                  .reverse()
                  .map((entry, i) => {
                    const Icon = KIND_ICON[entry.kind ?? ""] ?? Clock;
                    return (
                      <li key={i} className="flex items-start gap-2 text-[11px]">
                        <span className="shrink-0 text-slate-400">
                          {entry.at ? new Date(entry.at).toLocaleTimeString("en-IN") : "—"}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_STYLE[entry.kind ?? ""] ?? KIND_STYLE.note}`}
                        >
                          <Icon size={9} /> {entry.kind}
                        </span>
                        <span className="min-w-0 flex-1 text-slate-600 dark:text-zinc-300">{entry.detail}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-[var(--c-bg-card)] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-zinc-100">{value}</p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}
