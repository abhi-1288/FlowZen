import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord } from "../../shared";

export function CheckOutRequestsListModal({
  requests,
  onClose,
}: {
  requests: AnyRecord[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Check-Out Requests</h3>
            <p className="text-sm text-slate-500">Your check-out requests and their status.</p>
          </div>
          <ActionButton variant="ghost" className="p-2" onClick={onClose} aria-label="Close">
            <Trash2 size={20} />
          </ActionButton>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {requests.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No check-out requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req: any) => {
                const att = req.attendance as any;
                return (
                  <div key={req._id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {new Date(req.date).toLocaleDateString()}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              req.status === "approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : req.status === "rejected"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          Check-in at {att?.checkIn ? new Date(att.checkIn).toLocaleTimeString() : "--"}
                          {req.requestedCheckOut ? ` \u2192 Check-out at ${new Date(req.requestedCheckOut).toLocaleTimeString()}` : ""}
                        </p>
                        {req.reason ? (
                          <p className="mt-1 text-sm text-slate-500">
                            <span className="font-medium">Reason:</span> {req.reason}
                          </p>
                        ) : null}
                        {req.rejectionReason ? (
                          <p className="mt-1 text-sm text-rose-600">
                            <span className="font-medium">Rejected:</span> {req.rejectionReason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CheckOutRequestModal({
  history,
  onClose,
  onRefresh,
  showToast,
}: {
  history: AnyRecord[];
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const recordsWithoutCheckOut = history.filter(
    (h: any) => {
      if (h.checkOut || !h.checkIn) return false;
      const d = new Date(h.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() !== todayStart.getTime();
    },
  );

  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [financeUsers, setFinanceUsers] = useState<{ _id: string; name: string }[]>([]);
  const [selectedFinance, setSelectedFinance] = useState("");

  useEffect(() => {
    apiFetch<{ users: { _id: string; name: string }[] }>("/api/users?role=finance")
      .then((res) => setFinanceUsers(res.users ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!selectedId) {
      showToast("Please select a date.", "error");
      return;
    }
    if (!reason.trim()) {
      showToast("Please provide a reason.", "error");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/attendance/checkout-request", {
        method: "POST",
        body: JSON.stringify({ attendanceId: selectedId, reason: reason.trim(), ...(selectedFinance ? { assignedTo: selectedFinance } : {}) }),
      });
      showToast("Check-out request sent to finance.");
      onRefresh();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit request",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Request Check-Out</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Select a day you forgot to check out. Finance will mark check-out at 8 hours from check-in.
        </p>
        {recordsWithoutCheckOut.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No pending check-outs found.</p>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4"
          >
            <option value="">Select a date...</option>
            {recordsWithoutCheckOut.map((h: any) => (
              <option key={String(h._id)} value={String(h._id)}>
                {new Date(h.date).toLocaleDateString()} \u2014 Checked in at{" "}
                {new Date(h.checkIn).toLocaleTimeString()}
              </option>
            ))}
          </select>
        )}
        {recordsWithoutCheckOut.length > 0 && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for requesting check-out..."
            className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
          />
        )}
        {financeUsers.length > 0 && (
          <div className="space-y-1 mb-4">
            <label className="text-xs font-bold uppercase text-slate-500">
              Assign Finance User
            </label>
            <select
              value={selectedFinance}
              onChange={(e) => setSelectedFinance(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            >
              <option value="">Auto-assign any finance</option>
              {financeUsers.map((fu) => (
                <option key={fu._id} value={fu._id}>{fu.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedId}
            className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
