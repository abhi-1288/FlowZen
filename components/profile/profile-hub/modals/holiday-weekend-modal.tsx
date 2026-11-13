"use client";

import { useState } from "react";
import { CalendarPlus, X } from "lucide-react";

/**
 * Assign a holiday weekend across a date range.
 *
 * This is deliberately separate from the month grid: a "holiday weekend" is a
 * company-wide announcement (a festival, a shutdown) rather than an extra
 * Saturday, so it needs a range, a mandatory reason, and it notifies everyone.
 */
export function HolidayWeekendModal({
  onClose,
  onAssign,
  loading,
}: {
  onClose: () => void;
  onAssign: (startDate: string, endDate: string, reason: string) => Promise<void>;
  loading: boolean;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const invalidRange = Boolean(
    startDate && endDate && endDate < startDate,
  );
  const canSubmit =
    Boolean(startDate) && Boolean(reason.trim()) && !invalidRange && !loading;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center neu-overlay p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-zinc-100">
              <CalendarPlus size={20} className="text-indigo-600 dark:text-indigo-400" />
              Assign holiday-weekend
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Every day in the range becomes a weekend for the whole company, and
              everyone is notified with your reason.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">
                From
              </label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-xl border border-[var(--c-border-light)] px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-[#000000]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">
                To
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-xl border border-[var(--c-border-light)] px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-[#000000]"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Leave “To” empty for a single-day holiday.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">
              Reason (visible to everyone)
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Diwali, company shutdown, regional festival…"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full resize-none rounded-xl border border-[var(--c-border-light)] p-4 text-sm dark:border-zinc-800 dark:bg-[#000000]"
            />
          </div>

          {invalidRange ? (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
              The end date must be on or after the start date.
            </p>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--c-border-light)] py-3 text-sm font-semibold text-slate-600 transition hover:bg-[var(--c-bg-slate-50)] dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void onAssign(startDate, endDate || startDate, reason)}
              className="neu-btn neu-btn-primary flex-1 rounded-full py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Assigning..." : "Assign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
