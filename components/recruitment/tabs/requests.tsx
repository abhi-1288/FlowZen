"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Eye } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { WorkflowBadge } from "@/components/recruitment/workflow-badge";
import { TaskCard } from "@/components/recruitment/task-card";
import { JobRequestModal } from "@/components/recruitment/job-request-modal";
import type { WorkflowStatus } from "@/lib/recruitment-types";

type SubTab = "my" | "other";

export function RequestsTab() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isFullAccess = role === "admin" || role === "human-resource";
  const { myRequests, allRequests, fetchMyRequests, fetchAllRequests } = useRecruitmentStore(
    useShallow((s) => ({ myRequests: s.myRequests, allRequests: s.allRequests, fetchMyRequests: s.fetchMyRequests, fetchAllRequests: s.fetchAllRequests }))
  );
  const [subTab, setSubTab] = useState<SubTab>("my");
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    if (isFullAccess) setSubTab("other");
    useRecruitmentStore.setState({ userRole: role });
  }, [isFullAccess, role]);

  useEffect(() => {
    void fetchMyRequests();
    if (isFullAccess) void fetchAllRequests();
  }, [fetchMyRequests, fetchAllRequests, isFullAccess]);

  const refresh = useCallback(() => {
    void fetchMyRequests();
    if (isFullAccess) void fetchAllRequests();
  }, [fetchMyRequests, fetchAllRequests, isFullAccess]);

  const tabs: { key: SubTab; label: string }[] = [{ key: "my", label: "My Requests" }];
  if (isFullAccess) tabs.push({ key: "other", label: "Other Requests" });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">Requests</h1>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {tabs.map((t) => (
              <button
                suppressHydrationWarning
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  subTab === t.key ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button suppressHydrationWarning
          onClick={() => setShowRequestModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus size={16} />
          Request Job
        </button>
      </div>

      {subTab === "my" && (
        <>
          {myRequests.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-slate-500">No requests yet.</p>
              <button suppressHydrationWarning
                onClick={() => setShowRequestModal(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus size={16} />
                Create your first request
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myRequests.map((job) => {
                const wf = job.workflow;
                const s = (wf?.status ?? "requested") as WorkflowStatus;
                return (
                  <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-slate-900">{job.title}</h3>
                          <WorkflowBadge status={s} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {job.openings > 0 ? <>{job.openings} opening{job.openings > 1 ? "s" : ""}</> : null}
                          {wf?.assignedHR && typeof wf.assignedHR === "object" ? <> &middot; Assigned to {wf.assignedHR.name}</> : null}
                        </p>
                        {wf?.requestedAt && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            Requested {new Date(wf.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                      <button suppressHydrationWarning
                        onClick={() => router.push(`/recruitment/jobs/${job.id}`)}
                        className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {subTab === "other" && isFullAccess && (
        <>
          {allRequests.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-slate-500">No other requests.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allRequests.map((job) => (
                <TaskCard key={job.id} job={job} onAction={refresh} />
              ))}
            </div>
          )}
        </>
      )}

      {showRequestModal && <JobRequestModal onClose={() => { setShowRequestModal(false); refresh(); }} />}
    </div>
  );
}
