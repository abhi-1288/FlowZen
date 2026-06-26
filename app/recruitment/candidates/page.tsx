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
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => { if (candidates.length === 0) void fetchCandidates(); }, [candidates.length, fetchCandidates]);
  useEffect(() => { if (jobs.length === 0) void fetchJobs(); }, [jobs.length, fetchJobs]);

  const filtered = useMemo(() => candidates.filter((c) => {
    if (stageFilter && c.stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.firstName.toLowerCase().includes(q) && !c.lastName.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [candidates, stageFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { job: { id: string; title: string; status: string } | null; candidates: typeof candidates }>();
    for (const c of filtered) {
      const jobId = typeof c.job === "object" ? c.job.id : c.job;
      const j = jobs.find((j) => j.id === jobId);
      const key = jobId || "__unknown__";
      if (!map.has(key)) {
        map.set(key, {
          job: j ? { id: j.id, title: j.title, status: j.status } : null,
          candidates: [],
        });
      }
      map.get(key)!.candidates.push(c);
    }
    const entries = Array.from(map.entries());
    const unknown = entries.filter(([k]) => k === "__unknown__");
    const known = entries.filter(([k]) => k !== "__unknown__").sort((a, b) => a[1].job?.title?.localeCompare(b[1].job?.title || "") || 0);
    return [...known, ...unknown];
  }, [filtered, jobs]);

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

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No candidates found.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {grouped.map(([jobId, group]) => (
            <div key={jobId} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setExpandedJob(expandedJob === jobId ? null : jobId)}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Briefcase size={16} className="shrink-0 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {group.job ? group.job.title : "Unknown Job"}
                  </span>
                  {group.job && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      group.job.status === "open" ? "bg-emerald-50 text-emerald-700" :
                      group.job.status === "closed" ? "bg-rose-50 text-rose-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {group.job.status.charAt(0).toUpperCase() + group.job.status.slice(1)}
                    </span>
                  )}
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {group.candidates.length}
                  </span>
                </div>
                {expandedJob === jobId ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
              </button>
              {expandedJob === jobId && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                  {group.candidates.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">No candidates for this job.</div>
                  ) : (
                    group.candidates.map((candidate) => {
                      return (
                        <div key={candidate.id} className="px-4 py-3 hover:bg-slate-50 transition">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => router.push(`/recruitment/candidates/${candidate.id}`)}
                                  className="text-sm font-semibold text-slate-900 hover:text-indigo-600 truncate"
                                >
                                  {candidate.firstName} {candidate.lastName}
                                </button>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                  candidate.stage === "joined" ? "bg-emerald-50 text-emerald-700" :
                                  candidate.stage === "rejected" ? "bg-rose-50 text-rose-700" :
                                  "bg-slate-100 text-slate-600"
                                }`}>{STAGE_LABELS[candidate.stage]}</span>
                                {(candidate as any).upcomingInterviews?.length > 0 && (
                                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Interview Scheduled</span>
                                )}
                                {candidate.rating > 0 && (
                                  <span className="shrink-0 text-xs text-amber-500">{'★'.repeat(candidate.rating)}</span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{candidate.email}</span>
                                {candidate.currentCompany && <><span>&middot;</span><span>{candidate.currentCompany}</span></>}
                                {candidate.experienceYears > 0 && <><span>&middot;</span><span>{candidate.experienceYears}y exp</span></>}
                              </div>
                            </div>
                            <button
                              onClick={() => router.push(`/recruitment/candidates/${candidate.id}`)}
                              className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
          ))}
        </div>
      )}
    </div>
  );
}
