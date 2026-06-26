"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, ChevronDown, UserPlus } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { STAGE_LABELS, type Stage } from "@/lib/recruitment-types";

export default function ReferralsPage() {
  const { jobs, referrals, loading, fetchJobs, fetchReferrals } = useRecruitmentStore(
    useShallow((s) => ({ jobs: s.jobs, referrals: s.referrals, loading: s.loading, fetchJobs: s.fetchJobs, fetchReferrals: s.fetchReferrals }))
  );
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => { if (jobs.length === 0) void fetchJobs(); }, [jobs.length, fetchJobs]);
  useEffect(() => { if (referrals.length === 0) void fetchReferrals(); }, [referrals.length, fetchReferrals]);

  const grouped = useMemo(() => {
    const map = new Map<string, { job: { id: string; title: string; status: string } | null; referrals: typeof referrals }>();
    for (const r of referrals) {
      const candidate = typeof r.candidate === "object" ? r.candidate : null;
      const jobId = candidate && typeof candidate.job === "object" ? candidate.job.id : null;
      const job = jobId ? jobs.find((j) => j.id === jobId) : null;
      const key = jobId || "__unknown__";
      if (!map.has(key)) {
        map.set(key, {
          job: job ? { id: job.id, title: job.title, status: job.status } : null,
          referrals: [],
        });
      }
      map.get(key)!.referrals.push(r);
    }
    const entries = Array.from(map.entries());
    const unknown = entries.filter(([k]) => k === "__unknown__");
    const known = entries.filter(([k]) => k !== "__unknown__").sort((a, b) => a[1].job?.title?.localeCompare(b[1].job?.title || "") || 0);
    return [...known, ...unknown];
  }, [referrals, jobs]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Referrals</h1>
      <p className="mt-1 text-sm text-slate-500">{referrals.length} total</p>

      {loading && referrals.length === 0 ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">
          <UserPlus className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2">No referrals found.</p>
        </div>
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
                    {group.referrals.length}
                  </span>
                </div>
                <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${expandedJob === jobId ? "" : "-rotate-90"}`} />
              </button>
              {expandedJob === jobId && (
                <div className="border-t border-slate-100">
                  {group.referrals.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">No referrals for this job.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Candidate Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Referred By</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Current Stage</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Referral Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.referrals.map((referral) => {
                          const candidateName = referral.candidate && typeof referral.candidate === "object"
                            ? `${(referral.candidate as any).firstName} ${(referral.candidate as any).lastName}`
                            : "Unknown";
                          const referredBy = referral.employee && typeof referral.employee === "object"
                            ? (referral.employee as any).name
                            : "Unknown";
                          const stage = referral.candidate && typeof referral.candidate === "object"
                            ? (referral.candidate as any).stage
                            : "";
                          const stageLabel = stage ? STAGE_LABELS[stage as Stage] || stage : "-";

                          return (
                            <tr key={referral.id} className="bg-white hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{candidateName}</td>
                              <td className="px-4 py-3 text-slate-600">{referredBy}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  stage === "joined" ? "bg-emerald-50 text-emerald-700" :
                                  stage === "rejected" ? "bg-rose-50 text-rose-700" :
                                  stage === "offer" ? "bg-indigo-50 text-indigo-700" :
                                  "bg-slate-100 text-slate-600"
                                }`}>
                                  {stageLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  referral.status === "pending" ? "bg-amber-50 text-amber-700" :
                                  referral.status === "reviewed" ? "bg-sky-50 text-sky-700" :
                                  referral.status === "hired" ? "bg-emerald-50 text-emerald-700" :
                                  "bg-rose-50 text-rose-700"
                                }`}>
                                  {referral.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
