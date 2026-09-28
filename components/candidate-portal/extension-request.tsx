"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2, Send, XCircle } from "lucide-react";

/**
 * A candidate asking for more time mid-exam.
 *
 * Asking costs nothing and grants nothing by itself — the request lands with HR
 * and their clock only moves once a reviewer approves it. The copy says so
 * plainly, because a candidate who assumes the button worked and then watches
 * their timer run out is a support ticket every time.
 */
export function ExtensionRequest({
  token,
  status,
  requestedMs,
  grantedMs,
  disabled,
}: {
  token: string;
  status: "none" | "pending" | "approved" | "denied";
  requestedMs: number;
  grantedMs: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/public/candidate/me/assessment/extension?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes, note }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not send your request.");
      setOpen(false);
      setNote("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (status === "approved" && grantedMs > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 size={12} /> +{Math.round(grantedMs / 60000)} min added
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        <Clock size={12} /> Requesting {Math.round(requestedMs / 60000)} min — waiting for review
      </span>
    );
  }

  if (status === "denied" && !open) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
        <XCircle size={12} /> Request declined
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-end gap-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Clock size={12} /> Need more time?
        </button>
      ) : (
        <div className="w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-slate-800 dark:text-zinc-100">
            Request extra time
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
            This sends a request to the hiring team. Your clock only changes if they approve it.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="30"
              value={minutes}
              onChange={(e) => setMinutes(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <span className="text-xs text-slate-500 dark:text-zinc-400">minutes</span>
          </div>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened? (optional)"
            className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          />
          {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(""); }}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
