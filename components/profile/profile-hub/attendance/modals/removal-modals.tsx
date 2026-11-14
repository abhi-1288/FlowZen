import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord } from "../../shared";

/**
 * Member-side attendance-record removal, mirroring the check-out request flow:
 * pick the day, give a reason, and the request goes to the region's Finance
 * user first, then to the member's team owner and a regional admin.
 */
export function CheckInRemovalRequestModal({
  history,
  preselectedId = "",
  onClose,
  onRefresh,
  showToast,
}: {
  history: AnyRecord[];
  preselectedId?: string;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const records = history.filter((h: any) => Boolean(h.checkIn) || Boolean(h.checkOut));

  const [selectedId, setSelectedId] = useState(preselectedId);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

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
      const res = await apiFetch<{ alreadyPending?: boolean }>("/api/attendance/delete-request", {
        method: "POST",
        body: JSON.stringify({ attendanceId: selectedId, reason: reason.trim() }),
      });
      showToast(
        res.alreadyPending
          ? "A removal request is already pending for this day."
          : "Removal request sent to Finance for review.",
        res.alreadyPending ? "error" : "success",
      );
      await onRefresh();
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
    <div className="fixed inset-0 z-[60] grid place-items-center neu-overlay p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Request Record Removal</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Select the day with the wrong record (check-in or check-out). Finance reviews first, then your team owner and a regional admin &mdash; the record is deleted only after every approval.
        </p>
        {records.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No attendance records found.</p>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm mb-4"
          >
            <option value="">Select a date...</option>
            {records.map((h: any) => (
              <option key={String(h._id)} value={String(h._id)}>
                {new Date(h.date).toLocaleDateString()}
                {h.checkIn ? ` \u2014 Checked in at ${new Date(h.checkIn).toLocaleTimeString()}` : h.checkOut ? ` \u2014 Checked out at ${new Date(h.checkOut).toLocaleTimeString()}` : ""}
              </option>
            ))}
          </select>
        )}
        {records.length > 0 && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why should this record be removed? (e.g. checked in on a day off)"
            className="mb-4 w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm"
            rows={3}
          />
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
            disabled={loading || !selectedId || records.length === 0}
            className="neu-btn neu-btn-primary rounded-full px-6 py-2 text-sm font-medium"
          >
            {loading ? "Sending..." : "Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

const slotStatus = (slot: unknown) => String((slot as AnyRecord | undefined)?.status ?? "pending");

/**
 * The member's own removal requests and the ones waiting on this user's
 * review, in one modal — the same way the Leave/WFH/Check-out request lists
 * show both sides of the flow.
 */
export function CheckInRemovalRequestsListModal({
  requests = [],
  own = [],
  isFinance = false,
  onApprove,
  onReject,
  onClose,
}: {
  requests?: AnyRecord[];
  own?: AnyRecord[];
  isFinance?: boolean;
  onApprove: (id: string, adminId?: string) => void;
  onReject: (id: string, reason: string) => void;
  onClose: () => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  // Finance picks the admin who closes the request out. The list is fetched
  // per member region, once per region per modal open.
  const [adminOptions, setAdminOptions] = useState<Record<string, AnyRecord[]>>({});
  const [selectedAdmin, setSelectedAdmin] = useState<Record<string, string>>({});
  const fetchedRegions = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isFinance) return;
    requests.forEach((req: any) => {
      const region = String(req.region ?? "").trim();
      if (!region || String(req.financeApproval?.status ?? "") !== "pending") return;
      if (fetchedRegions.current.has(region)) return;
      fetchedRegions.current.add(region);
      apiFetch<{ admins: AnyRecord[] }>(
        `/api/attendance/delete-request/admins?region=${encodeURIComponent(region)}`,
        undefined,
        { toast: false },
      )
        .then((res) => setAdminOptions((current) => ({ ...current, [region]: res.admins ?? [] })))
        .catch(() => setAdminOptions((current) => ({ ...current, [region]: [] })));
    });
  }, [isFinance, requests]);

  const adminIdOf = (req: any) =>
    String(req.adminApproval?.approver?._id ?? req.adminApproval?.approver ?? "");

  const forwardAdminId = (req: any) => selectedAdmin[String(req.id)] || adminIdOf(req);

  const adminPicker = (req: any) => {
    const region = String(req.region ?? "").trim();
    if (!region) return null;
    const options = adminOptions[region] ?? [];
    const value = selectedAdmin[String(req.id)] || adminIdOf(req);
    return (
      <div className="mt-2 flex w-60 items-center gap-2">
        <label className="shrink-0 text-xs font-medium text-slate-500">Forward to admin:</label>
        <select
          value={value}
          onChange={(e) =>
            setSelectedAdmin((current) => ({ ...current, [String(req.id)]: e.target.value }))
          }
          className="min-w-0 flex-1 rounded-lg border border-[var(--c-border-light)] bg-white px-2 py-1.5 text-xs text-slate-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {options.length === 0 ? (
            <option value="">Loading admins…</option>
          ) : (
            options.map((admin: any) => (
              <option key={String(admin.id)} value={String(admin.id)}>
                {String(admin.name)}
              </option>
            ))
          )}
        </select>
      </div>
    );
  };

  const isFinanceGate = (req: any) =>
    isFinance && String(req.financeApproval?.status ?? "") === "pending";

  const rowBody = (req: any) => {
    const rejectedSlot = [req.financeApproval, req.teamOwnerApproval, req.adminApproval].find(
      (slot) => String(slot?.status ?? "") === "rejected",
    );
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">
            {String(req.member?.name ?? "Member")} — {new Date(req.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${req.status === "approved" ? "bg-emerald-100 text-emerald-700" : req.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
          >
            {String(req.status ?? "pending")}
          </span>
        </div>
        {req.reason ? (
          <p className="mt-1 text-sm text-slate-600">{String(req.reason)}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          Finance: {slotStatus(req.financeApproval)}
          {" · "}
          Team owner: {req.teamOwnerRequired ? slotStatus(req.teamOwnerApproval) : "n/a"}
          {" · "}
          Admin: {slotStatus(req.adminApproval)}
        </p>
        {rejectedSlot?.reason ? (
          <p className="mt-1 text-sm text-rose-600">
            <span className="font-medium">Rejected:</span> {String(rejectedSlot.reason)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center neu-overlay p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl neu-card ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-[var(--c-border-light)] p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Record Removal Requests</h3>
            <p className="text-sm text-slate-500">Your removal requests and their approval progress.</p>
          </div>
          <ActionButton variant="ghost" className="p-2" onClick={onClose} aria-label="Close">
            <X size={20} />
          </ActionButton>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {requests.length === 0 && own.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No removal requests found.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {requests.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Awaiting your approval</h4>
                  <div className="space-y-2">
                    {requests.map((req: any) => (
                      <div key={String(req.id)} className="rounded-xl neu-inset/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          {rowBody(req)}
                          {rejectingId === String(req.id) ? null : (
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <div className="flex gap-2">
                                <ActionButton
                                  variant="approve"
                                  onClick={() =>
                                    isFinanceGate(req)
                                      ? onApprove(String(req.id), forwardAdminId(req) || undefined)
                                      : onApprove(String(req.id))
                                  }
                                >
                                  {isFinanceGate(req) ? "Approve and forward to admin" : "Approve"}
                                </ActionButton>
                                <ActionButton
                                  variant="danger"
                                  onClick={() => { setRejectingId(String(req.id)); setRejectionReason(""); }}
                                >
                                  Reject
                                </ActionButton>
                              </div>
                              {isFinanceGate(req) ? adminPicker(req) : null}
                            </div>
                          )}
                        </div>
                        {rejectingId === String(req.id) ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Why is this removal being rejected? (required)"
                              rows={2}
                              className="w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <ActionButton
                                variant="secondary"
                                className="flex-1"
                                onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                              >
                                Cancel
                              </ActionButton>
                              <button
                                type="button"
                                disabled={!rejectionReason.trim()}
                                onClick={() => onReject(String(req.id), rejectionReason.trim())}
                                className="neu-btn neu-btn-danger flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                              >
                                Confirm Reject
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {own.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Your requests</h4>
                  <div className="space-y-2">
                    {own.map((req: any) => (
                      <div key={String(req.id)} className="rounded-xl neu-inset/50 p-4">
                        {rowBody(req)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
