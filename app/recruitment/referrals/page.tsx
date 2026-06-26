"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, ChevronRight, UserPlus, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { STAGE_LABELS, type Stage } from "@/lib/recruitment-types";

const LIMIT = 10;

export default function ReferralsPage() {
  const { jobs, referrals, loading, totalJobs, totalReferrals, fetchJobs, fetchReferrals } = useRecruitmentStore(
    useShallow((s) => ({ jobs: s.jobs, referrals: s.referrals, loading: s.loading, totalJobs: s.totalJobs, totalReferrals: s.totalReferrals, fetchJobs: s.fetchJobs, fetchReferrals: s.fetchReferrals }))
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobPage, setJobPage] = useState(1);
  const [referralPage, setReferralPage] = useState(1);
  const jobTotalPages = Math.ceil(totalJobs / LIMIT) || 1;
  const referralTotalPages = Math.ceil(totalReferrals / LIMIT) || 1;

  useEffect(() => {
    if (jobs.length === 0) void fetchJobs({ page: "1", limit: String(LIMIT) });
  }, [jobs.length, fetchJobs]);

  const loadReferrals = useCallback((pg: number, jobId: string | null) => {
    const params: Record<string, string> = { page: String(pg), limit: String(LIMIT) };
    if (jobId) params.jobId = jobId;
    void fetchReferrals(params);
  }, [fetchReferrals]);

  useEffect(() => {
    loadReferrals(referralPage, selectedJobId);
  }, [referralPage, selectedJobId, loadReferrals]);

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setReferralPage(1);
  };

  const visibleJobs = jobs.filter((j) => j.status === "open" || j.status === "closed");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Referrals</h1>
          <p className="mt-1 text-sm text-slate-500">
            {selectedJobId
              ? `${totalReferrals} referral(s)`
              : `${totalReferrals} total`}
          </p>
        </div>
        {selectedJobId && (
          <button
            onClick={() => { setSelectedJobId(null); setReferralPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            View All
          </button>
        )}
      </div>

      {!selectedJobId ? (
        <>
          {loading && jobs.length === 0 ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-200" />
              ))}
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="mt-16 text-center text-slate-500">
              <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2">No open or closed jobs found.</p>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-3">
                {visibleJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJob(job.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{job.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          job.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>{job.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{job.department} &middot; {job.location || "Remote"}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-400" />
                  </button>
                ))}
              </div>
              {jobTotalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button onClick={() => setJobPage(1)} disabled={jobPage === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronsLeft size={16} />
                  </button>
                  <button onClick={() => setJobPage((p) => Math.max(1, p - 1))} disabled={jobPage === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 text-sm text-slate-600">Page {jobPage} of {jobTotalPages}</span>
                  <button onClick={() => setJobPage((p) => Math.min(jobTotalPages, p + 1))} disabled={jobPage === jobTotalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={16} className="rotate-180" />
                  </button>
                  <button onClick={() => setJobPage(jobTotalPages)} disabled={jobPage === jobTotalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronsRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
              ))}
            </div>
          ) : referrals.length === 0 ? (
            <div className="mt-16 text-center text-slate-500">
              <UserPlus className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2">No referrals for this job yet.</p>
            </div>
          ) : (
            <>
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
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
                    {referrals.map((referral) => {
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
              </div>
              {referralTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button onClick={() => setReferralPage(1)} disabled={referralPage === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronsLeft size={16} />
                  </button>
                  <button onClick={() => setReferralPage((p) => Math.max(1, p - 1))} disabled={referralPage === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 text-sm text-slate-600">Page {referralPage} of {referralTotalPages}</span>
                  <button onClick={() => setReferralPage((p) => Math.min(referralTotalPages, p + 1))} disabled={referralPage === referralTotalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={16} className="rotate-180" />
                  </button>
                  <button onClick={() => setReferralPage(referralTotalPages)} disabled={referralPage === referralTotalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronsRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
