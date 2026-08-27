"use client";

import { useEffect, useMemo, useState } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { RecruitmentKanbanBoard } from "@/components/recruitment/recruitment-kanban-board";
import { Building2, Briefcase, LayoutList } from "lucide-react";

export function BoardTab() {
  const { candidates, jobs, fetchCandidates, fetchJobs } = useRecruitmentStore(
    useShallow((s) => ({ candidates: s.candidates, jobs: s.jobs, fetchCandidates: s.fetchCandidates, fetchJobs: s.fetchJobs }))
  );
  const [selectedJob, setSelectedJob] = useState<string>("all");

  useEffect(() => {
    if (candidates.length === 0) void fetchCandidates({ limit: "0" });
    if (jobs.length === 0) void fetchJobs({ limit: "0" });
  }, [candidates.length, jobs.length, fetchCandidates, fetchJobs]);

  const candidatesByJob = useMemo(() => {
    const map: Record<string, typeof candidates> = {};
    for (const c of candidates) {
      const job = c.job as { id?: string; _id?: string; title?: string } | string | undefined;
      const jobId = !job
        ? ""
        : typeof job === "string"
          ? job
          : String(job.id ?? job._id ?? "");
      if (!jobId) continue;
      if (!map[jobId]) map[jobId] = [];
      map[jobId].push(c);
    }
    return map;
  }, [candidates]);

  // Each published job is a board, even if it has no candidates yet.
  const jobEntries = useMemo(
    () =>
      jobs.map((job) => ({
        job,
        jobCandidates: candidatesByJob[job.id] ?? [],
      })),
    [jobs, candidatesByJob]
  );

  // Fall back to "all" if the previously selected job is no longer present.
  const effectiveJob = jobs.some((j) => j.id === selectedJob) ? selectedJob : "all";
  const visible = effectiveJob === "all" ? jobEntries : jobEntries.filter((e) => e.job.id === effectiveJob);
  const selectedTitle = effectiveJob === "all" ? "All Jobs" : (jobs.find((j) => j.id === effectiveJob)?.title ?? "All Jobs");

  return (
    <div className="flex h-screen">
      {/* Sub sidebar — job/board switcher */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white md:flex dark:border-zinc-800 dark:bg-[#000000]">
        <div className="border-b border-slate-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
            <LayoutList size={16} className="text-slate-400" />
            <span>Boards</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{jobs.length} jobs</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <button
            type="button"
            onClick={() => setSelectedJob("all")}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              effectiveJob === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 size={15} className="shrink-0" />
              All Jobs
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-zinc-700 dark:text-zinc-300">
              {candidates.length}
            </span>
          </button>
          {jobEntries.map(({ job, jobCandidates }) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setSelectedJob(job.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                effectiveJob === job.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Briefcase size={15} className="shrink-0 text-slate-400" />
                <span className="truncate">{job.title}</span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-zinc-700 dark:text-zinc-300">
                {jobCandidates.length}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Board area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Building2 size={14} />
            <span>{selectedTitle}</span>
          </div>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">Kanban Board</h1>
          <p className="text-xs text-slate-500">
            {candidates.length} candidates across {jobs.length} jobs
          </p>
        </header>
        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          {visible.length === 0 ? (
            <div className="mt-16 text-center text-sm text-slate-500">No jobs yet.</div>
          ) : (
            visible.map(({ job, jobCandidates }) => (
              <section key={job.id}>
                <div className="mb-3 flex items-center gap-2">
                  <Briefcase size={15} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800">{job.title}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {jobCandidates.length}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white">
                  <RecruitmentKanbanBoard candidates={jobCandidates} />
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
