"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Eye, Pencil, Globe, Share2, Check, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import type { JobStatus } from "@/lib/recruitment-types";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";
import { formatJobDuration } from "@/lib/format-duration";
import { fmtJobDateTime } from "@/lib/date-utils";
import { JobModal } from "@/components/recruitment/job-modal";

export function JobsTab() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isAdmin = role === "admin";
  const isHr = role === "human-resource";
  const { jobs, loading, totalJobs, fetchJobs, updateJob, setModal } = useRecruitmentStore(
    useShallow((s) => ({ jobs: s.jobs, loading: s.loading, totalJobs: s.totalJobs, fetchJobs: s.fetchJobs, updateJob: s.updateJob, setModal: s.setModal }))
  );
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.ceil(totalJobs / 10) || 1;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    useRecruitmentStore.setState({ userRole: role });
  }, [role]);

  const load = useCallback((pg: number, status: string, q: string) => {
    const params: Record<string, string> = { page: String(pg), limit: "10" };
    if (status) params.status = status;
    if (q) params.search = q;
    void fetchJobs(params);
  }, [fetchJobs]);

  useEffect(() => {
    load(page, statusFilter, searchQuery);
  }, [page, statusFilter, searchQuery, load]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPage(1), 300);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-zinc-100">Job Openings</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{mounted ? totalJobs : "\u00A0"} jobs</p>
        </div>
        <button suppressHydrationWarning
          onClick={() => setModal({ type: "create-job" })}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New Job
        </button>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Published</h2>
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-950 dark:border-zinc-800"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <select
              suppressHydrationWarning
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-800"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {mounted && loading && jobs.length === 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-700" />
            ))}
          </div>
        ) : mounted && jobs.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-slate-500 dark:text-zinc-400">No published jobs found.</p>
          </div>
        ) : mounted ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-[#000000]">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-slate-900 dark:text-zinc-100">{job.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">{job.department}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    job.status === "open" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                    job.status === "draft" ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
                    "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400"
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                  <span>{job.location || "Remote"}</span>
                  <span>&middot;</span>
                  <span>{job.employmentType}</span>
                  {formatJobDuration(job.durationMonths, job.durationDays, job.durationHours, job.durationYears) && (
                    <>
                      <span>&middot;</span>
                      <span>{formatJobDuration(job.durationMonths, job.durationDays, job.durationHours, job.durationYears)}</span>
                    </>
                  )}
                  {job.requiredExperienceYears != null && job.requiredExperienceYears > 0 && (
                    <>
                      <span>&middot;</span>
                      <span>{job.requiredExperienceMaxYears && job.requiredExperienceMaxYears > job.requiredExperienceYears ? `${job.requiredExperienceYears}-${job.requiredExperienceMaxYears}` : `${job.requiredExperienceYears}+`} years exp</span>
                    </>
                  )}
                  {(job.salaryRangeMin > 0 || job.salaryRangeMax > 0) && (
                    <>
                      <span>&middot;</span>
                      <span>{CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMax.toLocaleString()}{job.salaryType === "per-month" ? "/mo" : job.salaryType === "per-day" ? "/day" : job.salaryType === "per-hour" ? "/hr" : "/yr"}</span>
                    </>
                  )}
                  {(job as any).applicantsCount !== undefined && (
                    <>
                      <span>&middot;</span>
                      <span>{(job as any).applicantsCount} applicants</span>
                    </>
                  )}
                  {job.autoCloseDate && (
                    <>
                      <span>&middot;</span>
                      <span>Closes: {fmtJobDateTime(job.autoCloseDate)}</span>
                    </>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <button suppressHydrationWarning
                    onClick={() => router.push(`/recruitment/jobs/${job.id}`)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Eye size={14} /> View
                  </button>
                  <button suppressHydrationWarning
                    onClick={() => { setModal({ type: "edit-job", jobId: job.id }); }}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {job.status === "draft" && isAdmin && (
                      <button suppressHydrationWarning
                        onClick={() => { void updateJob(job.id, { status: "open" as JobStatus }); }}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <Globe size={14} /> Publish
                      </button>
                    )}
                    {job.status === "open" && (
                      <button suppressHydrationWarning
                        onClick={() => {
                          const c = typeof job.company === "object" ? (job.company as any)?.name || "" : "";
                          const slug = c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                          const url = slug ? `${window.location.origin}/careers/jobs/${slug}/${job.id}` : "";
                          if (url) navigator.clipboard.writeText(url).then(() => { setCopiedJobId(job.id); setTimeout(() => setCopiedJobId(null), 2000); });
                        }}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 px-3 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-950"
                      >
                        {copiedJobId === job.id ? <Check size={14} /> : <Share2 size={14} />} {copiedJobId === job.id ? "Copied" : "Share"}
                      </button>
                    )}
                    {job.status === "open" && isAdmin && (
                      <button suppressHydrationWarning
                        onClick={() => { void updateJob(job.id, { status: "closed" as JobStatus }); }}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950"
                      >
                        <Globe size={14} /> Close
                      </button>
                    )}
                    {(job.status === "closed" || job.status === "draft") && <button suppressHydrationWarning
                      onClick={() => setModal({ type: "delete-job", jobId: job.id })}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash2 size={14} /> Delete
                    </button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {mounted && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button suppressHydrationWarning onClick={() => setPage(1)} disabled={page === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
              <ChevronsLeft size={16} />
            </button>
            <button suppressHydrationWarning onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm text-slate-600 dark:text-zinc-400">Page {page} of {totalPages}</span>
            <button suppressHydrationWarning onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
              <ChevronRight size={16} />
            </button>
            <button suppressHydrationWarning onClick={() => setPage(totalPages)} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
              <ChevronsRight size={16} />
            </button>
          </div>
        )}
      </section>
      {/* Create / edit form, shared with the job detail page. */}
      <JobModal />
      <DeleteJobModal />
    </div>
  );
}

function DeleteJobModal() {
  const { modal, setModal, deleteJob, jobs, saving } = useRecruitmentStore(
    useShallow((s) => ({
      modal: s.modal,
      setModal: s.setModal,
      deleteJob: s.deleteJob,
      jobs: s.jobs,
      saving: s.saving,
    }))
  );
  const deletingJob = modal?.type === "delete-job" ? jobs.find((j) => j.id === modal.jobId) : null;
  if (modal?.type !== "delete-job") return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-soft dark:bg-[#000000]">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Delete Job</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            Delete &ldquo;{deletingJob?.title ?? "this job"}&rdquo;? This will permanently delete the job and all associated candidates, interviews, offers, and uploaded resumes.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button suppressHydrationWarning
              onClick={() => setModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button suppressHydrationWarning
              onClick={() => {
                if (saving || !deletingJob) return;
                void deleteJob(deletingJob.id);
                setModal(null);
              }}
              disabled={saving || !deletingJob}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
