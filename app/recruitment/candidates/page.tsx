"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, ChevronDown, Briefcase } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { STAGE_LABELS, type Stage } from "@/lib/recruitment-types";

export default function CandidatesPage() {
  const router = useRouter();
  const { candidates, jobs, loading, fetchCandidates, fetchJobs } = useRecruitmentStore(
    useShallow((s) => ({ candidates: s.candidates, jobs: s.jobs, loading: s.loading, fetchCandidates: s.fetchCandidates, fetchJobs: s.fetchJobs }))
  );
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  useEffect(() => { if (candidates.length === 0) void fetchCandidates(); }, [candidates.length, fetchCandidates]);
  useEffect(() => { if (jobs.length === 0) void fetchJobs(); }, [jobs.length, fetchJobs]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof candidates>();
    for (const c of candidates) {
      const cJobId = typeof c.job === "object" ? c.job.id : c.job;
      const job = jobs.find((j) => j.id === cJobId);
      const key = job?.title || "Unknown Job";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [candidates, jobs]);

  const toggleJob = (title: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (stageFilter && c.stage !== stageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.firstName.toLowerCase().includes(q) && !c.lastName.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [candidates, stageFilter, search]);

  const stages = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Candidates</h1>
      <p className="mt-1 text-sm text-slate-500">{candidates.length} total</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-950"
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">All Stages</option>
          {stages.map((s) => <option key={s} value={s}>{STAGE_LABELS[s as Stage]}</option>)}
        </select>
      </div>

      {loading && candidates.length === 0 ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No candidates found.</div>
      ) : (
        <div className="mt-6 space-y-4">
          {grouped.map(([jobTitle, jobCandidates]) => {
            const isExpanded = expandedJobs.has(jobTitle);
            const job = jobs.find((j) => j.title === jobTitle);

            return (
              <div key={jobTitle} className="rounded-lg border border-slate-200 bg-white">
                <button
                  onClick={() => toggleJob(jobTitle)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isExpanded ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
                    <Briefcase size={15} className="shrink-0 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">{jobTitle}</span>
                    {job && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        job.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>{job.status}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400">{jobCandidates.length} candidate{jobCandidates.length !== 1 ? "s" : ""}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {jobCandidates.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-400">No candidates for this job.</p>
                    ) : (
                      jobCandidates.map((candidate) => {
                        const candidateJobTitle = typeof candidate.job === "object" ? candidate.job.title : "";
                        return (
                          <div key={candidate.id} className="flex items-center justify-between border-t border-slate-50 px-4 py-3 first:border-t-0 hover:bg-slate-50 transition">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">{candidate.firstName} {candidate.lastName}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  candidate.stage === "joined" ? "bg-emerald-50 text-emerald-700" :
                                  candidate.stage === "rejected" ? "bg-rose-50 text-rose-700" :
                                  "bg-slate-100 text-slate-600"
                                }`}>{STAGE_LABELS[candidate.stage]}</span>
                                {(candidate as any).upcomingInterviews?.length > 0 && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Interview Scheduled</span>
                                )}
                                {candidate.rating > 0 && (
                                  <span className="text-xs text-amber-500">{'★'.repeat(candidate.rating)}</span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{candidate.email}</span>
                                {candidateJobTitle && <><span>&middot;</span><span>{candidateJobTitle}</span></>}
                                {candidate.currentCompany && <><span>&middot;</span><span>{candidate.currentCompany}</span></>}
                                {candidate.experienceYears > 0 && <><span>&middot;</span><span>{candidate.experienceYears}y exp</span></>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <button
                                onClick={() => router.push(`/recruitment/candidates/${candidate.id}`)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Profile
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
