import { AlertTriangle, Trash2, X } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/client-utils";

export function ManageWfhDatesModal({
  wfhDates,
  onClose,
  onRefresh,
  showToast,
}: {
  wfhDates: { date: string; reason: string }[];
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [dateToDelete, setDateToDelete] = useState<{ date: string; reason: string } | null>(null);
  const [deletingDate, setDeletingDate] = useState(false);

  const handleDelete = async (date: string) => {
    setDeletingDate(true);
    try {
      await apiFetch("/api/company/wfh", {
        method: "DELETE",
        body: JSON.stringify({ date }),
      });
      showToast("WFH date removed.", "success");
      setDateToDelete(null);
      onRefresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to remove WFH date",
        "error",
      );
    } finally {
      setDeletingDate(false);
    }
  };

  const sorted = [...wfhDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Manage WFH Dates</h3>
            <p className="mt-1 text-sm text-slate-500">
              View and remove company-wide WFH dates.
            </p>
          </div>
          {wfhDates.length > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {wfhDates.length} date{wfhDates.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No WFH dates assigned yet.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {sorted.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-800">
                    {new Date(d.date).toLocaleDateString()}
                  </span>
                  {d.reason && (
                    <span className="text-xs text-slate-500">- {d.reason}</span>
                  )}
                </div>
                <button
                  aria-label="Remove WFH date"
                  onClick={() => setDateToDelete(d)}
                  className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 transition"
                  title="Remove WFH date"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            type="button"
          >
            Close
          </button>
        </div>

        {dateToDelete ? (
          <div
            className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget && !deletingDate) {
                setDateToDelete(null);
              }
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-wfh-date-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900" id="delete-wfh-date-title">
                      Delete WFH date?
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      This will remove{" "}
                      <span className="font-semibold text-slate-900">
                        {new Date(dateToDelete.date).toLocaleDateString()}
                      </span>{" "}
                      from company-wide WFH dates.
                    </p>
                    {dateToDelete.reason ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {dateToDelete.reason}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  aria-label="Close confirmation"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  disabled={deletingDate}
                  type="button"
                  onClick={() => setDateToDelete(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={deletingDate}
                  type="button"
                  onClick={() => setDateToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
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
