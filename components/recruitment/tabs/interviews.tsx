"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";

const LIMIT = 10;

export function InterviewsTab() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isFullAccess = role === "admin" || role === "human-resource";
  const { interviews, loading, totalInterviews, fetchInterviews, setModal } = useRecruitmentStore(
    useShallow((s) => ({ interviews: s.interviews, loading: s.loading, totalInterviews: s.totalInterviews, fetchInterviews: s.fetchInterviews, setModal: s.setModal }))
  );
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalPages = Math.ceil(totalInterviews / LIMIT) || 1;

  const load = useCallback((pg: number, status: string) => {
    const params: Record<string, string> = { page: String(pg), limit: String(LIMIT) };
    if (status) params.status = status;
    void fetchInterviews(params);
  }, [fetchInterviews]);

  useEffect(() => {
    load(page, statusFilter);
  }, [page, statusFilter, load]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Interviews</h1>
          <p className="mt-1 text-sm text-slate-500">{totalInterviews} total</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <select
          suppressHydrationWarning
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rescheduled">Rescheduled</option>
        </select>
      </div>

      {loading && interviews.length === 0 ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : interviews.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No interviews found.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {interviews.map((interview) => {
            const candidateName = interview.candidate && typeof interview.candidate === "object"
              ? `${(interview.candidate as any).firstName} ${(interview.candidate as any).lastName}`
              : "Unknown";
            const interviewerName = interview.interviewer && typeof interview.interviewer === "object"
              ? (interview.interviewer as any).name : "";
            const jobTitle = interview.job && typeof interview.job === "object"
              ? (interview.job as any).title : "";

            return (
              <div key={interview.id} className="rounded-lg border border-slate-200 bg-white">
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50"
                  onClick={() => setExpandedId(expandedId === interview.id ? null : interview.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar size={15} className="text-slate-400" />
                      <span className="text-sm font-semibold text-slate-900">{candidateName}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize">{interview.roundType}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        interview.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                        interview.status === "cancelled" ? "bg-rose-50 text-rose-700" :
                        "bg-amber-50 text-amber-700"
                      }`}>{interview.status}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(interview.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {interviewerName && <><span>&middot;</span><span>{interviewerName}</span></>}
                      {jobTitle && <><span>&middot;</span><span>{jobTitle}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isFullAccess && interview.status === "scheduled" && (
                      <>
                        <button suppressHydrationWarning
                          onClick={(e) => { e.stopPropagation(); setModal({ type: "add-feedback", interviewId: interview.id }); }}
                          className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          Feedback
                        </button>
                        <button suppressHydrationWarning
                          onClick={(e) => { e.stopPropagation(); setModal({ type: "edit-interview", interviewId: interview.id }); }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      </>
                    )}
                    {expandedId === interview.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>
                {expandedId === interview.id && interview.feedback && interview.status === "completed" && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="rounded bg-slate-100 px-2 py-1">Tech: {interview.feedback.technicalSkills}/5</span>
                      <span className="rounded bg-slate-100 px-2 py-1">Comm: {interview.feedback.communication}/5</span>
                      <span className="rounded bg-slate-100 px-2 py-1">Problem: {interview.feedback.problemSolving}/5</span>
                      <span className="rounded bg-slate-100 px-2 py-1">Culture: {interview.feedback.cultureFit}/5</span>
                      <span className={`rounded px-2 py-1 font-medium ${
                        interview.feedback.overallRecommendation === "strong-hire" ? "bg-emerald-50 text-emerald-700" :
                        interview.feedback.overallRecommendation === "hire" ? "bg-sky-50 text-sky-700" :
                        interview.feedback.overallRecommendation === "hold" ? "bg-amber-50 text-amber-700" :
                        "bg-rose-50 text-rose-700"
                      }`}>{interview.feedback.overallRecommendation.replace("-", " ")}</span>
                    </div>
                    {interview.feedback.notes && (
                      <p className="mt-2 text-sm text-slate-600">{interview.feedback.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button suppressHydrationWarning onClick={() => setPage(1)} disabled={page === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronsLeft size={16} />
              </button>
              <button suppressHydrationWarning onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button suppressHydrationWarning onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} className="rotate-180" />
              </button>
              <button suppressHydrationWarning onClick={() => setPage(totalPages)} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronsRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
