import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/client-utils";

export function WfhAssignModal({
  onClose,
  onRefresh,
  showToast,
}: {
  onClose: () => void;
  onRefresh: (dates: { date: string; reason: string }[]) => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.startDate) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ wfhDates: any[]; wfhCheckInMode: string }>(
        "/api/company/wfh",
        {
          method: "POST",
          body: JSON.stringify({
            startDate: formData.startDate,
            endDate: formData.endDate || formData.startDate,
            reason: formData.reason,
          }),
        }
      );
      const mapped = Array.isArray(res.wfhDates)
        ? res.wfhDates.map((item) => {
          if (item && typeof item === "object") {
            return {
              date: String(item.date),
              reason: item.reason ? String(item.reason) : ""
            };
          }
          return { date: String(item), reason: "" };
        })
        : [];
      onRefresh(mapped);
      showToast("WFH dates assigned and notifications sent!", "success");
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to assign WFH",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Assign Work From Home</h3>
        <p className="mt-1 text-sm text-slate-500">
          Assign Work From Home (WFH) dates for the company.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Reason / Instructions
            </label>
            <textarea
              required
              rows={3}
              placeholder="Reason for WFH assignment..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 p-4 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.startDate || !formData.reason}
              className="flex-1 rounded-full bg-slate-950 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? "Assigning..." : "Assign WFH"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

