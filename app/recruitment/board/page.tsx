"use client";

import { useEffect, useMemo } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { RecruitmentKanbanBoard } from "@/components/recruitment/recruitment-kanban-board";
import { Building2, Briefcase } from "lucide-react";

export default function FullKanbanPage() {
  const { candidates, jobs, fetchCandidates, fetchJobs } = useRecruitmentStore();

  useEffect(() => { void fetchCandidates(); void fetchJobs(); }, [fetchCandidates, fetchJobs]);

  const grouped = useMemo(() => {
    const map: Record<string, { jobTitle: string; candidates: typeof candidates }> = {};
    for (const c of candidates) {
      const jobId = typeof c.job === "object" ? (c.job as { id: string }).id : String(c.job);
      const jobTitle = typeof c.job === "object" ? (c.job as { title: string }).title : "Unknown Job";
      if (!map[jobId]) map[jobId] = { jobTitle, candidates: [] };
      map[jobId].candidates.push(c);
    }
    return Object.entries(map);
  }, [candidates]);

  const totalCandidates = candidates.length;

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Building2 size={14} />
          <span>All Jobs</span>
        </div>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Kanban Board</h1>
        <p className="text-xs text-slate-500">{totalCandidates} candidates across {grouped.length} jobs</p>
      </header>
      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        {grouped.length === 0 ? (
          <div className="mt-16 text-center text-sm text-slate-500">No candidates yet.</div>
        ) : (
          grouped.map(([jobId, { jobTitle, candidates: jobCandidates }]) => (
            <section key={jobId}>
              <div className="mb-3 flex items-center gap-2">
                <Briefcase size={15} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-800">{jobTitle}</h2>
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
  );
}
