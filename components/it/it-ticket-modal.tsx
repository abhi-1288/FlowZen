"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Send,
  Paperclip,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Info,
  MessageSquare,
  Loader2,
  Phone,
  Mail,
  Shield,
  Building,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useSession } from "next-auth/react";
import {
  type ItTicket,
  type ItTicketStatus,
  type ItTicketPriority,
  type ItResolutionType,
  IT_STATUS_LABELS,
  IT_STATUS_COLORS,
  IT_CATEGORY_LABELS,
  IT_PRIORITY_LABELS,
  IT_PRIORITY_COLORS,
  IT_RESOLUTION_TYPE_LABELS,
  IT_CANCEL_REASONS,
  ALL_IT_STATUSES,
  requesterId,
  requesterName,
  userObj,
  CANCEL_ALLOWED_STATUSES,
} from "./it-types";

type RequesterObject = NonNullable<ItTicket["requester"]> extends string
  ? never
  : Extract<NonNullable<ItTicket["requester"]>, object>;

function RequesterPopover({
  requester,
  onClose,
}: {
  requester: RequesterObject;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const ROLE_LABELS: Record<string, string> = {
    "employee": "Employee",
    "project-manager": "Project Manager",
    "qa-tester": "QA Tester",
    "human-resource": "Human Resource",
    "finance": "Finance",
    "admin": "Admin",
    "security": "Security",
    "it-admin": "IT Admin",
    "it-administration": "IT Administration",
    "others": "Others",
  };

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-[80] mt-1 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-[#111]"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          Requester Details
        </p>
        <button
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
          onClick={onClose}
          type="button"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-start gap-2.5">
          <UserCheck size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
              {requester.name}
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              {ROLE_LABELS[requester.role ?? ""] || requester.role || "—"}
              {requester.customRole ? ` (${requester.customRole})` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Mail size={14} className="shrink-0 text-slate-400" />
          <a
            className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            href={`mailto:${requester.email}`}
          >
            {requester.email}
          </a>
        </div>
        {requester.phone && (
          <div className="flex items-center gap-2.5">
            <Phone size={14} className="shrink-0 text-slate-400" />
            <a
              className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
              href={`tel:${requester.phone}`}
            >
              {requester.phone}
            </a>
          </div>
        )}
        {requester.emergencyContact && (
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={14} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                Emergency Contact
              </p>
              <p className="text-xs text-slate-700 dark:text-zinc-300">
                {requester.emergencyContact}
              </p>
            </div>
          </div>
        )}
        {requester.department && (
          <div className="flex items-center gap-2.5">
            <Building size={14} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                Department
              </p>
              <p className="text-xs text-slate-700 dark:text-zinc-300">
                {requester.department}
              </p>
            </div>
          </div>
        )}
        {requester.companyIdentityCode && (
          <div className="flex items-center gap-2.5">
            <Shield size={14} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                Identity Code
              </p>
              <p className="font-mono text-xs text-slate-700 dark:text-zinc-300">
                {requester.companyIdentityCode}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ItTicketModal({
  ticket: initial,
  onClose,
  onUpdated,
  actorRole,
  assignees = [],
  requesterCanConfirm,
}: {
  ticket: ItTicket;
  onClose: () => void;
  onUpdated: () => void;
  actorRole?: string;
  assignees?: { id: string; name: string; email?: string }[];
  requesterCanConfirm?: boolean;
}) {
  const { data: session } = useSession();
  const currentUserId = String(session?.user?.id ?? "");
  const [ticket, setTicket] = useState<ItTicket>(initial);
  const [commentBody, setCommentBody] = useState("");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachUploading, setAttachUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRequesterInfo, setShowRequesterInfo] = useState(false);

  const isITStaff = ["it-admin", "it-administration", "admin", "human-resource"].includes(
    String(actorRole),
  );
  const isItAdminOnly = String(actorRole) === "it-admin";
  const canAssign = isItAdminOnly;
  const canChangePriority = isItAdminOnly;
  const canResolve = ["it-admin", "it-administration"].includes(String(actorRole));
  const canRequestInfo = ["it-admin", "it-administration"].includes(String(actorRole));
  const canChangeStatus = ["it-admin", "it-administration"].includes(String(actorRole));
  // Older ticket responses can expose the requester ID in different shapes.
  // Fall back to the signed-in email so owner controls remain available.
  const requesterEmail =
    typeof ticket.requester === "string" ? "" : ticket.requester.email?.toLowerCase();
  const sessionEmail = session?.user?.email?.toLowerCase();
  const isRequester = Boolean(
    (currentUserId && requesterId(ticket.requester) === currentUserId) ||
      (requesterEmail && sessionEmail && requesterEmail === sessionEmail),
  );

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<{ ticket: ItTicket }>(
        `/api/it/tickets/${ticket.id}`,
        undefined,
        { toast: false },
      );
      setTicket(res.ticket);
    } catch { /* ignore */ }
  }, [ticket.id]);

  useEffect(() => { void refresh(); }, []);

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setLoading(true);
    try {
      await apiFetch(`/api/it/tickets/${ticket.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: commentBody }),
      });
      setCommentBody("");
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAttachment() {
    const hasFile = attachFile instanceof File;
    const hasUrl = attachUrl.trim();
    if (!hasFile && !hasUrl) return;
    if (hasFile) {
      setAttachUploading(true);
    } else {
      setLoading(true);
    }
    try {
      if (hasFile) {
        const formData = new FormData();
        formData.append("file", attachFile);
        if (attachName.trim()) formData.append("name", attachName.trim());
        const res = await fetch(`/api/it/tickets/${ticket.id}/attachments`, {
          method: "POST",
          body: formData,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error ?? "Upload failed");
      } else {
        await apiFetch(`/api/it/tickets/${ticket.id}/attachments`, {
          method: "POST",
          body: JSON.stringify({ name: attachName || attachUrl, url: attachUrl }),
        });
      }
      setAttachFile(null);
      setAttachName("");
      setAttachUrl("");
      await refresh();
      onUpdated();
    } finally {
      setAttachUploading(false);
      setLoading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    setLoading(true);
    try {
      await apiFetch(
        `/api/it/tickets/${ticket.id}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" },
      );
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    setLoading(true);
    try {
      await apiFetch(
        `/api/it/tickets/${ticket.id}/comments?commentId=${encodeURIComponent(commentId)}`,
        { method: "DELETE" },
      );
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: ItTicketStatus) {
    setLoading(true);
    try {
      await apiFetch(`/api/it/tickets/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function handlePriorityChange(newPriority: ItTicketPriority) {
    setLoading(true);
    try {
      await apiFetch(`/api/it/tickets/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ priority: newPriority }),
      });
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  const [assigneeId, setAssigneeId] = useState("");
  async function handleAssign() {
    if (!assigneeId) return;
    setLoading(true);
    try {
      await apiFetch(`/api/it/tickets/${ticket.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigneeId }),
      });
      setAssigneeId("");
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestInfo() {
    setLoading(true);
    try {
      await apiFetch(`/api/it/tickets/${ticket.id}/request-information`, {
        method: "POST",
      });
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  const [resolveResolution, setResolveResolution] = useState("");
  const [resolveType, setResolveType] = useState<ItResolutionType>("OTHER");
  const [showResolveForm, setShowResolveForm] = useState(false);

  async function handleResolve(e: FormEvent) {
    e.preventDefault();
    if (!resolveResolution.trim()) return;
    setLoading(true);
    try {
      await apiFetch(`/api/it/tickets/${ticket.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution: resolveResolution, resolutionType: resolveType }),
      });
      setShowResolveForm(false);
      setResolveResolution("");
      setResolveType("OTHER");
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(confirmed: boolean) {
    setLoading(true);
    try {
      await apiFetch(`/api/it/tickets/${ticket.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmed }),
      });
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);

  async function handleCancel(e: FormEvent) {
    e.preventDefault();
    if (!cancelReason) return;
    setLoading(true);
    try {
      await apiFetch(`/api/it/tickets/${ticket.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancelReason }),
      });
      setShowCancelForm(false);
      setCancelReason("");
      await refresh();
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  const actorObj =
    typeof ticket.requester === "string"
      ? null
      : ticket.requester;
  const assignedObj = ticket.assignedTo;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 px-4">
      <section className="flex w-full max-w-3xl flex-col rounded-lg bg-white shadow-soft dark:bg-[#000000] dark:border dark:border-zinc-800 max-h-[90vh]">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-slate-950 dark:text-zinc-100">
                {ticket.ticketNumber} — {ticket.title}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${IT_STATUS_COLORS[ticket.status]}`}
              >
                {IT_STATUS_LABELS[ticket.status]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${IT_PRIORITY_COLORS[ticket.priority]}`}
              >
                {IT_PRIORITY_LABELS[ticket.priority]}
              </span>
            </div>
          </div>
          <button
            className="ml-3 shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isRequester && CANCEL_ALLOWED_STATUSES.includes(ticket.status) && !showCancelForm && (
            <button
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
              disabled={loading}
              onClick={() => setShowCancelForm(true)}
              type="button"
            >
              <AlertTriangle size={16} />
              Withdraw Ticket
            </button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                  Category
                </span>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  {IT_CATEGORY_LABELS[ticket.category]}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                  Department
                </span>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  {ticket.department || "—"}
                </p>
              </div>
              <div className="relative">
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                  Requester
                </span>
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-zinc-200">
                  {requesterName(ticket.requester)}
                  {actorObj && (
                    <button
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-700"
                      onClick={() => setShowRequesterInfo((p) => !p)}
                      title="View requester details"
                      type="button"
                    >
                      <Info size={13} />
                    </button>
                  )}
                </p>
                {showRequesterInfo && actorObj && (
                  <RequesterPopover
                    requester={actorObj}
                    onClose={() => setShowRequesterInfo(false)}
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                  Assigned To
                </span>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  {assignedObj ? assignedObj.name : "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                  Created
                </span>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  {new Date(ticket.createdAt).toLocaleString()}
                </p>
              </div>
              {ticket.resolution && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                    Resolution
                  </span>
                  <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                    {ticket.resolution}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
              Description
            </span>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-zinc-300">
              {ticket.description || "No description provided."}
            </p>
          </div>

          {/* IT Staff Controls */}
          {isITStaff ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                <UserCheck size={14} />
                IT Actions
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                    Change Status
                  </span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    value={ticket.status}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as ItTicketStatus)
                    }
                    disabled={loading || !canChangeStatus}
                  >
                    {ALL_IT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {IT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                    Change Priority
                  </span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    value={ticket.priority}
                    onChange={(e) =>
                      handlePriorityChange(e.target.value as ItTicketPriority)
                    }
                    disabled={loading || !canChangePriority}
                  >
                    {(["LOW", "MEDIUM", "HIGH", "URGENT"] as ItTicketPriority[]).map(
                      (p) => (
                        <option key={p} value={p}>
                          {IT_PRIORITY_LABELS[p]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              {canAssign && (
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select assignee...</option>
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.email ? ` (${a.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    disabled={loading || !assigneeId}
                    onClick={handleAssign}
                    type="button"
                  >
                    Assign
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {["PENDING", "ASSIGNED", "QUEUED", "IN_PROGRESS", "WAITING_FOR_USER"].includes(
                  ticket.status,
                ) && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    disabled={loading || !canRequestInfo}
                    onClick={handleRequestInfo}
                    type="button"
                  >
                    <Info size={14} />
                    Request Info
                  </button>
                )}

                {canResolve && !isRequester && ["ASSIGNED", "QUEUED", "IN_PROGRESS"].includes(ticket.status) && (
                  <>
                    {!showResolveForm ? (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loading}
                        onClick={() => setShowResolveForm(true)}
                        type="button"
                      >
                        <CheckCircle2 size={14} />
                        Resolve
                      </button>
                    ) : (
                      <form
                        className="flex w-full flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30"
                        onSubmit={handleResolve}
                      >
                        <textarea
                          className="min-h-16 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          placeholder="Resolution details..."
                          value={resolveResolution}
                          onChange={(e) => setResolveResolution(e.target.value)}
                          disabled={loading}
                        />
                        <div className="flex gap-2">
                          <select
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                            value={resolveType}
                            onChange={(e) =>
                              setResolveType(e.target.value as ItResolutionType)
                            }
                            disabled={loading}
                          >
                            {(
                              Object.entries(IT_RESOLUTION_TYPE_LABELS) as [
                                ItResolutionType,
                                string,
                              ][]
                            ).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                          <button
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={loading || !resolveResolution.trim()}
                            type="submit"
                          >
                            Submit
                          </button>
                          <button
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            disabled={loading}
                            onClick={() => setShowResolveForm(false)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Requester Actions */}
          {isRequester && ticket.status === "AWAITING_CONFIRMATION" && (
            <div className="flex gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
                onClick={() => handleConfirm(true)}
                type="button"
              >
                <CheckCircle2 size={14} />
                Confirm Resolved
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
                onClick={() => handleConfirm(false)}
                type="button"
              >
                <AlertTriangle size={14} />
                Not Resolved
              </button>
            </div>
          )}

          {isRequester && CANCEL_ALLOWED_STATUSES.includes(ticket.status) && showCancelForm && (
            <form
              className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/30"
              onSubmit={handleCancel}
            >
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                  Cancel Reason
                </span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-rose-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select a reason...</option>
                  {IT_CANCEL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading || !cancelReason}
                  type="submit"
                >
                      Confirm Withdraw
                </button>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  disabled={loading}
                  onClick={() => setShowCancelForm(false)}
                  type="button"
                >
                  Go Back
                </button>
              </div>
            </form>
          )}

          {/* Attachments */}
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-zinc-200">
              <Paperclip size={14} />
              Attachments ({ticket.attachments.length})
            </p>
            <div className="mt-2 space-y-1.5">
              {ticket.attachments.map((a) => (
                <div
                  className="flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2 dark:bg-zinc-800"
                  key={a.id}
                >
                  <a
                    className="min-w-0 truncate text-sm text-emerald-700 hover:underline dark:text-emerald-400"
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.name}
                  </a>
                  <button
                    className="shrink-0 rounded-md p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                    disabled={loading}
                    onClick={() => handleDeleteAttachment(a.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {ticket.attachments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No attachments.</p>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/60">
                <Paperclip size={14} />
                {attachFile ? attachFile.name : "Choose file to upload..."}
                <input
                  className="hidden"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setAttachFile(f);
                    if (f && !attachName) setAttachName(f.name);
                  }}
                  disabled={loading || attachUploading}
                />
              </label>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  placeholder="Name"
                  value={attachName}
                  onChange={(e) => setAttachName(e.target.value)}
                  disabled={loading || attachUploading}
                />
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  placeholder="Or paste a URL..."
                  value={attachUrl}
                  onChange={(e) => setAttachUrl(e.target.value)}
                  disabled={loading || attachUploading}
                />
              </div>
              <div className="flex justify-end gap-2">
                {(attachFile || attachName || attachUrl) && (
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400"
                    disabled={loading || attachUploading}
                    onClick={() => {
                      setAttachFile(null);
                      setAttachName("");
                      setAttachUrl("");
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  disabled={loading || attachUploading || (!attachFile && !attachUrl.trim())}
                  onClick={handleAddAttachment}
                  type="button"
                >
                  {attachUploading && <Loader2 size={12} className="animate-spin" />}
                  {attachFile ? "Upload" : "Add"}
                </button>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-zinc-200">
              <MessageSquare size={14} />
              Comments ({ticket.comments.length})
            </p>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {ticket.comments.map((c) => {
                const u = userObj(c.user);
                const cAuthorId =
                  typeof c.user === "string" ? c.user : String((c.user as any).id ?? (c.user as any)._id ?? "");
                const canDeleteComment =
                  currentUserId && (cAuthorId === currentUserId || isITStaff);
                return (
                  <div
                    className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800"
                    key={c.id}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        {u.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                      {canDeleteComment && (
                        <button
                          className="ml-auto rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                          disabled={loading}
                          onClick={() => handleDeleteComment(c.id)}
                          title="Delete comment"
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                      {c.body}
                    </p>
                  </div>
                );
              })}
              {ticket.comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No comments yet.</p>
              ) : null}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={handleAddComment}>
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                placeholder="Add a comment..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                disabled={loading}
              />
              <button
                className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                disabled={loading || !commentBody.trim()}
                type="submit"
              >
                <Send size={14} />
              </button>
            </form>
          </div>

          {/* Activity Log */}
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-zinc-200">
              <Clock size={14} />
              Activity ({ticket.activity.length})
            </p>
            <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-sm text-slate-500 dark:text-zinc-400">
              {ticket.activity
                .slice()
                .reverse()
                .map((a) => {
                  const u = userObj(a.user);
                  return (
                    <div
                      className="flex items-start gap-2"
                      key={a.id}
                    >
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-zinc-600" />
                      <div>
                        <span className="font-medium text-slate-600 dark:text-zinc-300">
                          {u.name}
                        </span>{" "}
                        {a.detail || a.action}
                        <span className="ml-1 text-[10px] text-slate-400 dark:text-zinc-500">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              {ticket.activity.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No activity.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
