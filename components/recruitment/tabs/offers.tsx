"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ExternalLink, ChevronRight, ChevronDown, PenSquare, Send, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";

const LIMIT = 10;

export function OffersTab() {
  const router = useRouter();
  const { offers, loading, totalOffers, fetchOffers, updateOffer, signOffer } = useRecruitmentStore(
    useShallow((s) => ({ offers: s.offers, loading: s.loading, totalOffers: s.totalOffers, fetchOffers: s.fetchOffers, updateOffer: s.updateOffer, signOffer: s.signOffer }))
  );
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(totalOffers / LIMIT) || 1;

  const load = useCallback((pg: number, status: string) => {
    const params: Record<string, string> = { page: String(pg), limit: String(LIMIT) };
    if (status) params.status = status;
    void fetchOffers(params);
  }, [fetchOffers]);

  useEffect(() => {
    load(page, statusFilter);
  }, [page, statusFilter, load]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof offers>();
    for (const offer of offers) {
      const jobTitle = offer.job && typeof offer.job === "object" ? (offer.job as any).title : "Unknown Job";
      if (!map.has(jobTitle)) map.set(jobTitle, []);
      map.get(jobTitle)!.push(offer);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [offers]);

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
      <p className="mt-1 text-sm text-slate-500">{totalOffers} offers across {grouped.length} jobs</p>

      <div className="mt-4 flex items-center gap-3">
        <select
          suppressHydrationWarning
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading && offers.length === 0 ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No offers found.</div>
      ) : (
        <div className="mt-6 space-y-4">
          {grouped.map(([jobTitle, jobOffers]) => {
            const isExpanded = expandedJobs.has(jobTitle);
            const signedCount = jobOffers.filter((o) => o.isSigned).length;
            const draftCount = jobOffers.filter((o) => o.status === "draft").length;

            return (
              <div key={jobTitle} className="rounded-lg border border-slate-200 bg-white">
                <button suppressHydrationWarning
                  onClick={() => toggleJob(jobTitle)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isExpanded ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
                    <span className="text-sm font-semibold text-slate-900">{jobTitle}</span>
                    <span className="text-xs text-slate-400">({jobOffers.length} offers)</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {draftCount > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{draftCount} pending</span>
                    )}
                    {signedCount > 0 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{signedCount} signed</span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {jobOffers.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-400">No offers for this job.</p>
                    ) : (
                      jobOffers.map((offer) => {
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
                                <span>?{Number(offer.offeredCTC).toLocaleString()}/{salaryPeriodLabel}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {offer.status === "draft" && !offer.isSigned && (
                                <button suppressHydrationWarning
                                  onClick={async () => { await signOffer(offer.id); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                                >
                                  <PenSquare size={12} /> Sign
                                </button>
                              )}
                              {offer.status === "draft" && offer.isSigned && (
                                <button suppressHydrationWarning
                                  onClick={async () => { await updateOffer(offer.id, { status: "sent" }); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                                >
                                  <Send size={12} /> Send
                                </button>
                              )}
                              <button suppressHydrationWarning
                                onClick={() => router.push(`/recruitment/offers/${offer.id}/letter`)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <ExternalLink size={12} /> Letter
                              </button>
                              <button suppressHydrationWarning
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button suppressHydrationWarning onClick={() => setPage(1)} disabled={page === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronsLeft size={16} />
              </button>
              <button suppressHydrationWarning onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button suppressHydrationWarning onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
              <button suppressHydrationWarning onClick={() => setPage(totalPages)} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronsRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
