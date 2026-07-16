import { useState } from "react";
import { apiFetch } from "@/lib/client-utils";

export function RangeExhaustionModal({
  open,
  onClose,
  onSuccess,
  showToast,
  currentEndRange,
  currentNextNumber,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
  currentEndRange: number | null;
  currentNextNumber: number | null;
}) {
  const [newEndRange, setNewEndRange] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const suggestedEnd = currentEndRange != null && currentNextNumber != null
    ? Math.max(currentEndRange, currentNextNumber + 500)
    : null;

  async function handleSave() {
    if (!newEndRange) {
      showToast("Enter a new end range.", "error");
      return;
    }
    if (currentNextNumber != null && newEndRange <= currentNextNumber) {
      showToast("New end range must be greater than the current next number.", "error");
      return;
    }
    try {
      setLoading(true);
      await apiFetch("/api/hr/identity-code-settings", {
        method: "PATCH",
        body: JSON.stringify({ endRange: newEndRange }),
      });
      showToast("Identity code range increased.", "success");
      setNewEndRange(null);
      onSuccess();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update range.", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleQuickIncrease(amount: number) {
    if (currentEndRange != null) {
      setNewEndRange(currentEndRange + amount);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Increase Identity Code Range</h3>
        <p className="mt-2 text-sm text-slate-600">
          Your identity code range is {currentEndRange != null && currentNextNumber != null && (currentEndRange - currentNextNumber) <= 0 ? "exhausted" : "running low"}.
          {currentNextNumber != null ? ` Current next number: ${currentNextNumber}.` : ""}
          {currentEndRange != null ? ` Current end range: ${currentEndRange}.` : ""}
        </p>

        <div className="mt-4">
          <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="new-end-range">New end range</label>
          <input
            id="new-end-range"
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
            placeholder={`e.g. ${suggestedEnd ?? 700000}`}
            value={newEndRange ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : Number(e.target.value);
              setNewEndRange(val);
            }}
          />
        </div>

        {currentEndRange != null ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => handleQuickIncrease(100)}
            >
              +100
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => handleQuickIncrease(500)}
            >
              +500
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => handleQuickIncrease(1000)}
            >
              +1000
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => handleQuickIncrease(5000)}
            >
              +5000
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!newEndRange || loading}
            onClick={() => void handleSave()}
          >
            {loading ? "Saving..." : "Increase Range"}
          </button>
        </div>
      </div>
    </div>
  );
}
