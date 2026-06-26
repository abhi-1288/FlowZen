"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronUp, Briefcase } from "lucide-react";
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
  const [jobFilter, setJobFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { if (candidates.length === 0) void fetchCandidates(); }, [candidates.length, fetchCandidates]);
  useEffect(() => { if (jobs.length === 0) void fetchJobs(); }, [jobs.length, fetchJobs]);

  const filtered = useMemo(() => candidates.filter((c) => {
    if (stageFilter && c.stage !== stageFilter) return false;
    if (jobFilter) {
      const cJobId = typeof c.job === "object" ? c.job.id : c.job;
      if (cJobId !== jobFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!c.firstName.toLowerCase().includes(q) && !c.lastName.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [candidates, stageFilter, jobFilter, search]);

  const candidateCountByJob = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of candidates) {
      const cJobId = typeof c.job === "object" ? c.job.id : c.job;
      map.set(cJobId, (map.get(cJobId) || 0) + 1);
    }
    return map;
  }, [candidates]);

  const stages = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Candidates</h1>
      <p className="mt-1 text-sm text-slate-500">{candidates.length} total</p>

      <div className="mt-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setJobFilter(null)}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              jobFilter === null ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Briefcase size={14} className="inline mr-1" />All Jobs
          </button>
          {jobs.map((job) => {
            const count = candidateCountByJob.get(job.id) || 0;
            const isActive = jobFilter === job.id;
            return (
              <button
                key={job.id}
                onClick={() => setJobFilter(isActive ? null : job.id)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  isActive ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {job.title}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

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

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No candidates found.</div>
      ) : (
        <div className="mt-6 space-y-2">
          {filtered.map((candidate) => {
            const candidateJobTitle = typeof candidate.job === "object" ? candidate.job.title : "";
            return (
              <div key={candidate.id} className="rounded-lg border border-slate-200 bg-white">
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50"
                  onClick={() => setExpandedId(expandedId === candidate.id ? null : candidate.id)}
                >
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
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/recruitment/candidates/${candidate.id}`); }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Profile
                    </button>
                    {expandedId === candidate.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>
                {expandedId === candidate.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      {candidate.phone && <div><span className="text-xs text-slate-400">Phone</span><p className="text-slate-700">{candidate.phone}</p></div>}
                      <div><span className="text-xs text-slate-400">Experience</span><p className="text-slate-700">{candidate.experienceYears}y</p></div>
                      {candidate.currentCTC > 0 && <div><span className="text-xs text-slate-400">Current CTC</span><p className="text-slate-700">₹{candidate.currentCTC.toLocaleString()}</p></div>}
                      {candidate.expectedCTC > 0 && <div><span className="text-xs text-slate-400">Expected CTC</span><p className="text-slate-700">₹{candidate.expectedCTC.toLocaleString()}</p></div>}
                      <div><span className="text-xs text-slate-400">Notice Period</span><p className="text-slate-700">{candidate.noticePeriod}d</p></div>
                      <div><span className="text-xs text-slate-400">Source</span><p className="text-slate-700">{candidate.source}</p></div>
                    </div>
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
