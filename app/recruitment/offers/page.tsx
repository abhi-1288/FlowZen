"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ExternalLink, ChevronDown, PenSquare, Send, Briefcase } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";

export default function OffersPage() {
  const router = useRouter();
  const { offers, jobs, loading, fetchOffers, fetchJobs, updateOffer, signOffer } = useRecruitmentStore(
    useShallow((s) => ({ offers: s.offers, jobs: s.jobs, loading: s.loading, fetchOffers: s.fetchOffers, fetchJobs: s.fetchJobs, updateOffer: s.updateOffer, signOffer: s.signOffer }))
  );
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { if (offers.length === 0) void fetchOffers(); }, [offers.length, fetchOffers]);
  useEffect(() => { if (jobs.length === 0) void fetchJobs(); }, [jobs.length, fetchJobs]);

  const filtered = useMemo(() => statusFilter
    ? offers.filter((o) => o.status === statusFilter)
    : offers,
  [offers, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { jobTitle: string; jobStatus: string | null; offers: typeof offers }>();
    for (const offer of filtered) {
      const jobId = typeof offer.job === "object" ? (offer.job as any).id : null;
      const jobTitle = offer.job && typeof offer.job === "object" ? (offer.job as any).title : "Unknown Job";
      const job = jobId ? jobs.find((j) => j.id === jobId) : null;
      const key = jobTitle;
      if (!map.has(key)) map.set(key, { jobTitle, jobStatus: job?.status || null, offers: [] });
      map.get(key)!.offers.push(offer);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, jobs]);

  const toggleJob = (title: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Offers</h1>
      <p className="mt-1 text-sm text-slate-500">{offers.length} total</p>

      <div className="mt-4 flex items-center gap-3">
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No offers found.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {grouped.map(([jobTitle, group]) => {
            const isExpanded = expandedJobs.has(jobTitle);
            const signedCount = group.offers.filter((o) => o.isSigned).length;
            const draftCount = group.offers.filter((o) => o.status === "draft").length;

            return (
              <div key={jobTitle} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <button
                  onClick={() => toggleJob(jobTitle)}
                  className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Briefcase size={16} className="shrink-0 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900 truncate">{jobTitle}</span>
                    {group.jobStatus && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        group.jobStatus === "open" ? "bg-emerald-50 text-emerald-700" :
                        group.jobStatus === "closed" ? "bg-rose-50 text-rose-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {group.jobStatus.charAt(0).toUpperCase() + group.jobStatus.slice(1)}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-slate-400">({group.offers.length} offers)</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {draftCount > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{draftCount} pending</span>
                    )}
                    {signedCount > 0 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{signedCount} signed</span>
                    )}
                    <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {group.offers.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-400">No offers for this job.</p>
                    ) : (
                      group.offers.map((offer) => {
                        const candidateName = offer.candidate && typeof offer.candidate === "object"
                          ? `${(offer.candidate as any).firstName} ${(offer.candidate as any).lastName}`
                          : "Unknown";
                        const salaryPeriodLabel = offer.salaryType === "per-month" ? "mo" : "yr";

                        return (
                          <div key={offer.id} className="flex items-center justify-between border-t border-slate-50 px-4 py-3 first:border-t-0 hover:bg-slate-50 transition">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <FileText size={15} className="shrink-0 text-slate-400" />
                                <span className="text-sm font-semibold text-slate-900">{candidateName}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  offer.isSigned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                                }`}>
                                  {offer.isSigned ? "Signed" : "Unsigned"}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  offer.status === "draft" ? "bg-slate-100 text-slate-600" :
                                  offer.status === "sent" ? "bg-sky-50 text-sky-700" :
                                  offer.status === "accepted" ? "bg-emerald-50 text-emerald-700" :
                                  "bg-rose-50 text-rose-700"
                                }`}>{offer.status}</span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{offer.designation}</span>
                                <span>&middot;</span>
                                <span>₹{Number(offer.offeredCTC).toLocaleString()}/{salaryPeriodLabel}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {offer.status === "draft" && !offer.isSigned && (
                                <button
                                  onClick={async () => { await signOffer(offer.id); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                                >
                                  <PenSquare size={12} /> Sign
                                </button>
                              )}
                              {offer.status === "draft" && offer.isSigned && (
                                <button
                                  onClick={async () => { await updateOffer(offer.id, { status: "sent" }); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                                >
                                  <Send size={12} /> Send
                                </button>
                              )}
                              <button
                                onClick={() => router.push(`/recruitment/offers/${offer.id}/letter`)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <ExternalLink size={12} /> Letter
                              </button>
                              <button
                                onClick={() => router.push(`/recruitment/offers/${offer.id}`)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Details
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
