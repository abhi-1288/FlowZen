import { FormEvent, useEffect, useState } from "react";
import { Clock, LogOut, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord } from "../../shared";

export function WfhRequestModal({
  onClose,
  onRefresh,
  showToast,
  currentUserId,
  currentUserRole,
}: {
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);
  const [hrUsers, setHrUsers] = useState<{ _id: string; name: string }[]>([]);
  const [adminUsers, setAdminUsers] = useState<{ _id: string; name: string }[]>([]);
  const [selectedHr, setSelectedHr] = useState("");

  const isOnlyHr = currentUserRole === "human-resource" && hrUsers.length <= 1;
  const dropdownUsers = isOnlyHr
    ? adminUsers.filter((u) => u._id !== currentUserId)
    : hrUsers.filter((u) => u._id !== currentUserId);

  useEffect(() => {
    apiFetch<{ users: { _id: string; name: string }[] }>("/api/users?role=human-resource")
      .then((res) => setHrUsers(res.users ?? []))
      .catch(() => {});
    apiFetch<{ users: { _id: string; name: string }[] }>("/api/users?role=admin")
      .then((res) => setAdminUsers(res.users ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/attendance/wfh", {
        method: "POST",
        body: JSON.stringify({ ...formData, ...(selectedHr ? { hrApprover: selectedHr } : {}) }),
      });
      onRefresh();
      showToast("WFH request submitted!");
      onClose();
    } catch {
      showToast("Failed to submit WFH request", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Request WFH</h3>
        <p className="mt-1 text-sm text-slate-500">
          Submit a Work From Home request for approval.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">Start Date</label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">End Date</label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">Reason</label>
            <textarea
              required
              rows={3}
              placeholder="Why are you requesting WFH?"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>
          {dropdownUsers.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                {isOnlyHr ? "Assign Admin" : "Assign HR"}
              </label>
              <select
                value={selectedHr}
                onChange={(e) => setSelectedHr(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              >
                <option value="">{isOnlyHr ? "Auto-assign any Admin" : "Auto-assign any HR"}</option>
                {dropdownUsers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="rounded-full bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WfhRequestsListModal({
  requests,
  onClose,
  onApprove,
  onReject,
  onRevoke,
  currentUserId,
  userRole,
}: {
  requests: AnyRecord[];
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRevoke?: (id: string) => void;
  currentUserId?: string;
  userRole?: string;
}) {
  const [selectedWfh, setSelectedWfh] = useState<AnyRecord | null>(null);

  if (selectedWfh) {
    return (
      <WfhDetailsModal
        wfh={selectedWfh}
        onClose={() => setSelectedWfh(null)}
        onApprove={() => {
          onApprove(String(selectedWfh._id));
          setSelectedWfh(null);
        }}
        onReject={() => {
          onReject(String(selectedWfh._id));
          setSelectedWfh(null);
        }}
        onRevoke={() => {
          onRevoke?.(String(selectedWfh._id));
          setSelectedWfh(null);
        }}
        currentUserId={currentUserId}
        userRole={userRole}
      />
    );
  }

  const isManagerRole = userRole === "project-manager" || userRole === "qa-tester" || userRole === "admin";
  const isHrRole = userRole === "human-resource" || userRole === "admin";
  const isAdmin = userRole === "admin";

  const canApproveWfh = (req: AnyRecord) => {
    const reqRequester = req.requester as { _id?: string } | undefined;
    if (String(reqRequester?._id || req.requester) === currentUserId) return false;
    if (req.status === "rejected" || req.status === "approved") return false;
    const step = String(req.currentStep ?? "manager");
    if (step === "manager" && isManagerRole) return true;
    if (step === "hr" && isHrRole) return true;
    if (step === "admin" && isAdmin) return true;
    return false;
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">WFH Requests</h3>
            <p className="text-sm text-slate-500">
              Manage WFH request approvals and view status.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-50 text-slate-400">
            <Trash2 size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {requests.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No WFH requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req: any) => {
                return (
                  <div
                    key={req._id}
                    onClick={() => setSelectedWfh(req)}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-200 hover:bg-slate-100/50 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {req.requester?.name || "User"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${req.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : req.status === "rejected"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                              }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{req.reason}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />{" "}
                            {new Date(String(req.startDate)).toLocaleDateString()} -{" "}
                            {new Date(String(req.endDate)).toLocaleDateString()}
                          </span>
                          <span className="font-bold">{Number(req.duration)} day{Number(req.duration) === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function WfhDetailsModal({
  wfh,
  onClose,
  onApprove,
  onReject,
  onRevoke,
  currentUserId,
  userRole,
}: {
  wfh: AnyRecord;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRevoke?: () => void;
  currentUserId?: string;
  userRole?: string;
}) {
  const isRequester =
    String((wfh.requester as any)?._id || wfh.requester) === currentUserId;
  const step = String(wfh.currentStep ?? "manager");
  const isManagerRole = userRole === "project-manager" || userRole === "qa-tester" || userRole === "admin";
  const isHrRole = userRole === "human-resource" || userRole === "admin";
  const isAdmin = userRole === "admin";

  const canApprove =
    !isRequester &&
    wfh.status !== "rejected" &&
    wfh.status !== "approved" &&
    (
      (step === "manager" && isManagerRole) ||
      (step === "hr" && isHrRole) ||
      (step === "admin" && isAdmin)
    );

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const canRevoke =
    isRequester &&
    wfh.status !== "pending" &&
    wfh.status !== "rejected" &&
    new Date(String(wfh.startDate)) > now;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg animate-in zoom-in-95 fade-in duration-300 rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
        <div className="relative h-32 bg-slate-900">
          <div className="absolute -bottom-8 left-6">
            <div className="h-16 w-16 rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-600/20 grid place-items-center text-white">
              <Clock size={32} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <LogOut className="rotate-180" size={16} />
          </button>
        </div>

        <div className="p-8 pt-12">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {String((wfh.requester as any)?.name || "User")}
              </h3>
              <p className="text-sm font-medium text-slate-500 capitalize">
                {String(wfh.status)} WFH Request
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${wfh.status === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : wfh.status === "rejected"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
                }`}
            >
              {String(wfh.status)}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Start Date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {new Date(String(wfh.startDate)).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">End Date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {new Date(String(wfh.endDate)).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Duration</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {Number(wfh.duration)} day{Number(wfh.duration) === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Reason</p>
              <p className="mt-1 text-sm text-slate-700 leading-relaxed">{String(wfh.reason)}</p>
            </div>

            {String(wfh.rejectionReason || "") && (
              <div className="rounded-xl bg-rose-50 p-4 border border-rose-100">
                <p className="text-xs font-bold uppercase text-rose-600">Rejection Reason</p>
                <p className="mt-1 text-sm text-rose-700">{String(wfh.rejectionReason)}</p>
              </div>
            )}
          </div>

          {canApprove && (
            <div className="mt-8 flex gap-3">
              <button
                onClick={onReject}
                className="flex-1 rounded-xl border border-rose-200 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
              >
                Reject
              </button>
              <button
                onClick={onApprove}
                className="flex-1 rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20"
              >
                Approve
              </button>
            </div>
          )}

          {canRevoke && onRevoke && (
            <div className="mt-6">
              <button
                onClick={onRevoke}
                className="w-full rounded-xl border border-rose-200 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
              >
                Revoke Request
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
