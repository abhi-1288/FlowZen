import { AlertTriangle, Trash2, X } from "lucide-react";
import { useState } from "react";

type WeekendDate = {
  date: string;
  reason?: string;
  kind?: string;
  region?: string;
};

export function ManageWeekendDatesModal({
  weekendDates,
  weekendCheckInEnabled,
  setWeekendCheckInEnabled,
  onSaveCheckIn,
  onDelete,
  loading,
  onClose,
}: {
  weekendDates: WeekendDate[];
  weekendCheckInEnabled: boolean;
  setWeekendCheckInEnabled: (v: boolean) => void;
  onSaveCheckIn: () => Promise<void>;
  onDelete: (date: string) => Promise<void>;
  loading: boolean;
  onClose: () => void;
}) {
  const [dateToDelete, setDateToDelete] = useState<WeekendDate | null>(null);
  const [deletingDate, setDeletingDate] = useState(false);

  const handleDelete = async (date: string) => {
    setDeletingDate(true);
    try {
      await onDelete(date);
      setDateToDelete(null);
    } finally {
      setDeletingDate(false);
    }
  };

  const sorted = [...weekendDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center neu-overlay p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Manage Weekend Dates</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              View and remove company weekend dates.
            </p>
          </div>
          {weekendDates.length > 0 && (
            <span className="rounded-full bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] px-3 py-1 text-xs font-bold text-slate-600 dark:text-zinc-300">
              {weekendDates.length} date{weekendDates.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No weekend dates assigned yet.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {sorted.map((d) => (
              <div
                key={`${d.date}-${d.region ?? ""}`}
                className="flex items-center justify-between rounded-xl neu-inset px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                    {new Date(d.date).toLocaleDateString()}
                  </span>
                  {String(d.kind ?? "") === "holiday" && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Holiday
                    </span>
                  )}
                  {d.region && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {d.region}
                    </span>
                  )}
                  {d.reason && (
                    <span className="text-xs text-slate-500 dark:text-zinc-400">- {d.reason}</span>
                  )}
                </div>
                <button
                  aria-label="Remove weekend date"
                  onClick={() => setDateToDelete(d)}
                  className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 transition dark:hover:bg-rose-950/40"
                  title="Remove weekend date"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-xl neu-inset p-4">
          <div className="flex items-start gap-2">
            <input
              id="weekend-checkin"
              type="checkbox"
              className="mt-0.5"
              checked={weekendCheckInEnabled}
              onChange={(e) => setWeekendCheckInEnabled(e.target.checked)}
            />
            <label htmlFor="weekend-checkin" className="text-sm text-slate-800 dark:text-zinc-200">
              Allow check-in on weekends &amp; holiday weekends
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
                When off, members cannot check in on a day-off unless they have an approved WFH request for it.
              </span>
            </label>
          </div>
          <div className="mt-3">
            <button
              onClick={() => void onSaveCheckIn()}
              disabled={loading}
              className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              Save check-in policy
            </button>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-[var(--c-border-light)] py-3 text-sm font-semibold text-slate-600 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] transition dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            type="button"
          >
            Close
          </button>
        </div>

        {dateToDelete ? (
          <div
            className="fixed inset-0 z-[70] grid place-items-center neu-overlay p-4 backdrop-blur-sm"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget && !deletingDate) {
                setDateToDelete(null);
              }
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl ring-1 ring-slate-200"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-weekend-date-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-100" id="delete-weekend-date-title">
                      Delete weekend date?
                    </h4>
                    <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                      This will make{" "}
                      <span className="font-semibold text-slate-900 dark:text-zinc-100">
                        {new Date(dateToDelete.date).toLocaleDateString()}
                      </span>{" "}
                      a working day.
                    </p>
                    {dateToDelete.reason ? (
                      <p className="mt-3 rounded-lg bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] px-3 py-2 text-sm text-slate-600 dark:text-zinc-300">
                        {dateToDelete.reason}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  aria-label="Close confirmation"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] disabled:opacity-50 dark:text-zinc-400"
                  disabled={deletingDate}
                  type="button"
                  onClick={() => setDateToDelete(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="rounded-xl border border-[var(--c-border-light)] px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  disabled={deletingDate}
                  type="button"
                  onClick={() => setDateToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  className="neu-btn neu-btn-danger rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
                  disabled={deletingDate}
                  type="button"
                  onClick={() => void handleDelete(dateToDelete.date)}
                >
                  {deletingDate ? "Deleting..." : "Delete date"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
