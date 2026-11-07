"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Eye, Pencil, Globe, Share2, Check, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PageShell, type PageNavItem } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { inputCls } from "@/components/ui/field";
import { Briefcase } from "lucide-react";
import { Modal } from "@/components/ui/modal";
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
  // Raising a requisition is the pipeline owner's job, not merely an HR/admin one.
  // A regional HR reaches this tab and sees every job in the company; without
  // this they would find a "New Job" button, fill the whole form, and be refused
  // on submit. The session flag is refreshed with the token, so revoking a
  // delegation takes effect at the next refresh rather than instantly — which is
  // why the server re-derives it on every write.
  const canCreateJobs = Boolean(session?.user?.isRecruitmentHQ);
  const canPublishJobs = session?.user?.role === "admin" || Boolean(session?.user?.isCompanyOwner);
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
    <PageShell
      icon={Briefcase}
      title="Job Openings"
      subtitle={`${mounted ? totalJobs : "\u00A0"} jobs`}
      actions={
        canCreateJobs ? (
          <button
            suppressHydrationWarning
            onClick={() => setModal({ type: "create-job" })}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            + New Job
          </button>
        ) : (
          <p className="max-w-xs text-right text-xs text-slate-400 dark:text-zinc-500">
            Requisitions are raised by your main office.
          </p>
        )
      }
    >
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Published</h2>
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                className={`${inputCls} py-1.5 pl-9 text-xs`}
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <select
              suppressHydrationWarning
              className={`${inputCls} w-auto py-1.5 text-xs`}
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
          <div className="mt-4">
            <Skeleton grid rows={6} />
          </div>
        ) : mounted && jobs.length === 0 ? (
          <div className="mt-6">
            <Empty icon={Briefcase} title="No published jobs found." message="Create a new job to get started." />
          </div>
        ) : mounted ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <Card key={job.id} className="p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-slate-900 dark:text-zinc-100">{job.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">{job.department}</p>
                  </div>
                  <Badge
                    variant={
                      job.status === "open" ? "emerald" : job.status === "draft" ? "amber" : "slate"
                    }
                  >
                    {job.status}
                  </Badge>
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
                  {canCreateJobs && (
                    <button suppressHydrationWarning
                      onClick={() => { setModal({ type: "edit-job", jobId: job.id }); }}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {job.status === "draft" && canPublishJobs && (
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
                    {job.status === "open" && canCreateJobs && (
                      <button suppressHydrationWarning
                        onClick={() => { void updateJob(job.id, { status: "closed" as JobStatus }); }}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950"
                      >
                        <Globe size={14} /> Close
                      </button>
                    )}
                    {canCreateJobs && (job.status === "closed" || job.status === "draft") && <button suppressHydrationWarning
                      onClick={() => setModal({ type: "delete-job", jobId: job.id })}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash2 size={14} /> Delete
                    </button>}
                  </div>
                </div>
              </Card>
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
    </PageShell>
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
  return (
    <Modal
      open={modal?.type === "delete-job"}
      onClose={() => setModal(null)}
      title="Delete Job"
      maxWidth="max-w-sm"
      footer={
        <>
          <button
            suppressHydrationWarning
            onClick={() => setModal(null)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            suppressHydrationWarning
            onClick={() => {
              if (saving || !deletingJob) return;
              void deleteJob(deletingJob.id);
              setModal(null);
            }}
            disabled={saving || !deletingJob}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Deleting…" : "Delete"}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-zinc-400">
        Delete &ldquo;{deletingJob?.title ?? "this job"}&rdquo;? This will permanently delete the job and all associated candidates, interviews, offers, and uploaded resumes.
      </p>
    </Modal>
  );
}
