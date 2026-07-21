import { FormEvent, useEffect, useState } from "react";
import { Camera, Clock, LogOut, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord } from "../../shared";

export function LeaveModal({
  onClose,
  onRefresh,
  showToast,
  leavePolicy,
  currentUserId,
  currentUserRole,
}: {
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
  leavePolicy?: AnyRecord | null;
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    attachmentUrl: "",
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          attachmentUrl: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/attendance/leave", {
        method: "POST",
        body: JSON.stringify({ ...formData, ...(selectedHr ? { hrApprover: selectedHr } : {}) }),
      });
      onRefresh();
      showToast("Leave request submitted!");
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit leave",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Ask Leave</h3>
        <p className="mt-1 text-sm text-slate-500">
          Submit a paid leave request for HR and admin approval.
        </p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Remaining paid leave:{" "}
          <span className="font-semibold text-slate-900">
            {Math.max(0, Number(leavePolicy?.remainingPaidLeaveDays ?? 0))} day{Math.max(0, Number(leavePolicy?.remainingPaidLeaveDays ?? 0)) === 1 ? "" : "s"}
          </span>{" "}
          this {String(leavePolicy?.paidLeavePeriod ?? "monthly")} period.
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Reason
            </label>
            <textarea
              required
              rows={3}
              placeholder="Why are you taking leave?"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
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
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Attachment (Optional)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:bg-slate-100 transition-colors">
                <Camera size={18} />
                <span>
                  {formData.attachmentUrl
                    ? "Image selected"
                    : "Upload medical/reason document"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {formData.attachmentUrl && (
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200">
                  <img
                    src={formData.attachmentUrl}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, attachmentUrl: "" }))
                    }
                    className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
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

export function RequestsListModal({
  requests,
  onClose,
  onApprove,
  onReject,
  onRevoke,
  currentUserId,
  onViewDay,
  userRole,
}: {
  requests: AnyRecord[];
  onClose: () => void;
  onApprove: (id: string, assignedAdmin?: string) => void;
  onReject: (id: string) => void;
  onRevoke?: (id: string) => void;
  currentUserId?: string;
  onViewDay?: (dateStr: string) => void;
  userRole?: string;
}) {
  const [selectedLeave, setSelectedLeave] = useState<AnyRecord | null>(null);

  if (selectedLeave) {
    return (
      <LeaveDetailsModal
        leave={selectedLeave}
        onClose={() => setSelectedLeave(null)}
        onApprove={(assignedAdmin) => {
          onApprove(String(selectedLeave._id), assignedAdmin);
          setSelectedLeave(null);
        }}
        onReject={() => {
          onReject(String(selectedLeave._id));
          setSelectedLeave(null);
        }}
        onRevoke={() => {
          onRevoke?.(String(selectedLeave._id));
          setSelectedLeave(null);
        }}
        currentUserId={currentUserId}
        onViewDay={onViewDay}
        userRole={userRole}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Leave Requests</h3>
            <p className="text-sm text-slate-500">
              Manage pending leave approvals and view status.
            </p>
          </div>
          <ActionButton
            variant="ghost"
            className="p-2"
            onClick={onClose}
            aria-label="Close"
          >
            <Trash2 size={20} />
          </ActionButton>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {requests.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No leave requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req: any) => {
                const isRequester =
                  req.requester?._id === currentUserId ||
                  req.requester === currentUserId;
                const step = String(req.currentStep ?? "hr");

                return (
                  <div
                    key={req._id}
                    onClick={() => setSelectedLeave(req)}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-200 hover:bg-slate-100/50 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
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
                        <p className="mt-1 text-sm text-slate-600">
                          {req.reason}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />{" "}
                            {new Date(req.startDate).toLocaleDateString()} -{" "}
                            {new Date(req.endDate).toLocaleDateString()}
                          </span>
                          <span className="font-bold">{req.duration} days</span>
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
          <ActionButton
            variant="secondary"
            onClick={onClose}
          >
            Close
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function LeaveDetailsModal({
  leave,
  onClose,
  onApprove,
  onReject,
  onRevoke,
  currentUserId,
  onViewDay,
  userRole,
}: {
  leave: AnyRecord;
  onClose: () => void;
  onApprove: (assignedAdmin?: string) => void;
  onReject: () => void;
  onRevoke?: () => void;
  currentUserId?: string;
  onViewDay?: (dateStr: string) => void;
  userRole?: string;
}) {
  const isRequester =
    (leave.requester as any)?._id === currentUserId ||
    leave.requester === currentUserId;
  const step = String(leave.currentStep ?? "hr");

  const canApprove =
    !isRequester &&
    ["pending", "hr-approved"].includes(String(leave.status)) &&
    (
      (step === "admin" && String(userRole ?? "") === "admin") ||
      (step === "hr" && ["human-resource", "admin"].includes(String(userRole ?? "")))
    );

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const canRevoke =
    isRequester &&
    leave.status !== "pending" &&
    leave.status !== "rejected" &&
    new Date(String(leave.startDate)) > now;

  const [adminUsers, setAdminUsers] = useState<{ _id: string; name: string }[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState("");

  useEffect(() => {
    if (canApprove && step === "hr") {
      apiFetch<{ users: { _id: string; name: string }[] }>("/api/users?role=admin")
        .then((res) => setAdminUsers(res.users ?? []))
        .catch(() => {});
    }
  }, [canApprove, step]);

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
                {String((leave.requester as any)?.name || "User")}
              </h3>
              <p className="text-sm font-medium text-slate-500 capitalize">
                {String(leave.status)} Request
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${leave.status === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : leave.status === "rejected"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
                }`}
            >
              {String(leave.status)}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 rounded-2xl bg-slate-50 p-5">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Duration
              </p>
              <p className="text-sm font-bold text-slate-900">
                {Number(leave.duration)} Days
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Date Range
              </p>
              <p className="text-sm font-bold text-slate-900">
                {new Date(String(leave.startDate)).toLocaleDateString()} -{" "}
                {new Date(String(leave.endDate)).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Reason for Leave
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                {String(leave.reason)}
              </p>
            </div>

            {!!leave.attachmentUrl && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Attachments
                </p>
                <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={String(leave.attachmentUrl)}
                    alt="attachment"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <a
                    href={String(leave.attachmentUrl)}
                    download="attachment"
                    className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-xl">
                      View Original
                    </div>
                  </a>
                </div>
              </div>
            )}

            {leave.status === "rejected" && !!leave.rejectionReason && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-500">
                  Rejection Reason
                </p>
                <p className="mt-2 text-sm leading-relaxed text-rose-700 font-medium">
                  {String(leave.rejectionReason)}
                </p>
              </div>
            )}
          </div>

          {canApprove && (
            <div className="mt-10 space-y-4">
              {step === "hr" && adminUsers.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Assign Admin (for final approval)
                  </label>
                  <select
                    value={selectedAdmin}
                    onChange={(e) => setSelectedAdmin(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
                  >
                    <option value="">Auto-assign any admin</option>
                    {adminUsers.map((au) => (
                      <option key={au._id} value={au._id}>{au.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject();
                  }}
                  className="flex-1 rounded-2xl border border-rose-200 py-4 text-sm font-bold text-rose-600 hover:bg-rose-50 transition shadow-sm"
                >
                  Reject
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(selectedAdmin || undefined);
                  }}
                  className="flex-1 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20"
                >
                  Approve
                </button>
              </div>
            </div>
          )}

          {canRevoke && onRevoke && (
            <div className="mt-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRevoke();
                }}
                className="w-full rounded-2xl border border-rose-200 py-4 text-sm font-bold text-rose-600 hover:bg-rose-50 transition shadow-sm"
              >
                Revoke Request
              </button>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Back to List
            </button>
          </div>
          {onViewDay && (
            <div className="mt-4">
              <button
                onClick={() => {
                  onClose();
                  try {
                    onViewDay(String(leave.startDate));
                  } catch (e) {
                    /* ignore */
                  }
                }}
                className="w-full mt-2 rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                View Day Details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
