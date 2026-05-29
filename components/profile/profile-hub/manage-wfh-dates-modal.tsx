import { Trash2 } from "lucide-react";
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
  const handleDelete = async (date: string) => {
    try {
      await apiFetch("/api/company/wfh", {
        method: "DELETE",
        body: JSON.stringify({ date }),
      });
      showToast("WFH date removed.", "success");
      onRefresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to remove WFH date",
        "error",
      );
    }
  };

  const sorted = [...wfhDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
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
                  onClick={() => handleDelete(d.date)}
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
      </div>
    </div>
  );
}
