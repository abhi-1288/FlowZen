"use client";

import { useState } from "react";
import { Eye, Check, X, ArrowRight, Send, DollarSign, Globe, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { WorkflowBadge } from "@/components/recruitment/workflow-badge";
import type { ATSJob, WorkflowStatus } from "@/lib/recruitment-types";

export function TaskCard({ job, onAction }: { job: ATSJob; onAction: () => void }) {
  const router = useRouter();
  const { updateJob, userRole } = useRecruitmentStore();
  const [busy, setBusy] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const wf = job.workflow;
  const isHr = userRole === "human-resource";
  const isAdmin = userRole === "admin";

  async function handleAction(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      await updateJob(job.id, { action, ...extra } as any);
      onAction();
    } finally {
      setBusy(false);
      setShowRejectInput(false);
      setRejectReason("");
    }
  }

  const status = wf?.status as WorkflowStatus;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">{job.title}</h3>
            <WorkflowBadge status={status} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Requested by {wf?.requestedBy && typeof wf.requestedBy === "object" ? wf.requestedBy.name : "—"}
            {wf?.assignedHR && typeof wf.assignedHR === "object" ? <> &middot; Assigned to {wf.assignedHR.name}</> : null}
          </p>
        </div>
        <button suppressHydrationWarning
          onClick={() => router.push(`/recruitment/jobs/${job.id}`)}
          className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
        >
          <Eye size={16} />
        </button>
      </div>

      {isHr && (status === "requested" || status === "drafting" || status === "salary-approved") && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {status === "requested" && (
            <>
              <button suppressHydrationWarning
                onClick={() => handleAction("accept")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check size={14} /> Accept
              </button>
              <button suppressHydrationWarning
                onClick={() => setShowRejectInput(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <X size={14} /> Reject
              </button>
              {showRejectInput && (
                <div className="flex w-full items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none"
                    placeholder="Reason (optional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <button suppressHydrationWarning
                    onClick={() => handleAction("reject", { rejectionReason: rejectReason })}
                    disabled={busy}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Confirm Reject
                  </button>
                </div>
              )}
            </>
          )}
          {(status === "drafting" || status === "salary-approved") && (
            <button suppressHydrationWarning
              onClick={() => router.push(`/recruitment/jobs/${job.id}?edit=1`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <FileText size={14} /> Edit Details
            </button>
          )}
          {status === "drafting" && (
            <button suppressHydrationWarning
              onClick={() => handleAction("forward")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send size={14} /> Forward to Admin
            </button>
          )}
          {status === "salary-approved" && (
            <button suppressHydrationWarning
              onClick={() => handleAction("mark-ready")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              <Check size={14} /> Mark Ready
            </button>
          )}
        </div>
      )}

      {isAdmin && (status === "salary-pending" || status === "draft-ready") && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {status === "salary-pending" && (
            <button suppressHydrationWarning
              onClick={() => router.push(`/recruitment/jobs/${job.id}?salary=1`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
            >
              <DollarSign size={14} /> Set Salary
            </button>
          )}
          {status === "draft-ready" && (
            <button suppressHydrationWarning
              onClick={() => handleAction("publish")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Globe size={14} /> Publish
            </button>
          )}
        </div>
      )}
    </div>
  );
}
