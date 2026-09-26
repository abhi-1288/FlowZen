"use client";

import { useEffect, useRef } from "react";
import { PhoneOff } from "lucide-react";

/**
 * Confirmation shown only to the interviewer before the call is torn down for
 * both participants. Candidates never see this control.
 */
export function EndCallConfirm({
  open,
  candidateName,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  candidateName: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-call-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600/20 text-rose-400">
            <PhoneOff size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="end-call-title" className="text-base font-semibold">
              End this interview call?
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-400">
              {candidateName ? `This disconnects the call for you and ${candidateName}.` : "This disconnects the call for both of you."}{" "}
              The interview stays marked in progress and either of you can rejoin while the join window is open.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
          >
            Keep talking
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PhoneOff size={15} />
            {busy ? "Ending…" : "End call"}
          </button>
        </div>
      </div>
    </div>
  );
}
