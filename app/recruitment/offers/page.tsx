"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ExternalLink } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";

export default function OffersPage() {
  const router = useRouter();
  const { offers, loading, fetchOffers, updateOffer } = useRecruitmentStore();
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { if (offers.length === 0) void fetchOffers(); }, [offers.length, fetchOffers]);

  const filtered = statusFilter
    ? offers.filter((o) => o.status === statusFilter)
    : offers;

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
      ) : filtered.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No offers found.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((offer) => {
            const candidateName = offer.candidate && typeof offer.candidate === "object"
              ? `${(offer.candidate as any).firstName} ${(offer.candidate as any).lastName}`
              : "Unknown";
            const jobTitle = offer.job && typeof offer.job === "object"
              ? (offer.job as any).title : "";
            const salaryPeriodLabel = offer.salaryType === "per-month" ? "mo" : "yr";

            return (
              <div key={offer.id} className="rounded-lg border border-slate-200 bg-white p-4 transition hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-slate-400" />
                      <span className="text-sm font-semibold text-slate-900">{candidateName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        offer.status === "draft" ? "bg-amber-50 text-amber-700" :
                        offer.status === "sent" ? "bg-sky-50 text-sky-700" :
                        offer.status === "accepted" ? "bg-emerald-50 text-emerald-700" :
                        "bg-rose-50 text-rose-700"
                      }`}>{offer.status}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{offer.designation}</span>
                      {jobTitle && <><span>&middot;</span><span>{jobTitle}</span></>}
                      <span>&middot;</span>
                      <span>₹{Number(offer.offeredCTC).toLocaleString()}/{salaryPeriodLabel}</span>
                      {offer.joiningDate && <><span>&middot;</span><span>Joins {new Date(offer.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {offer.status === "draft" && (
                      <button
                        onClick={() => void updateOffer(offer.id, { status: "sent" })}
                        className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Mark Sent
                      </button>
                    )}
                    {offer.status === "sent" && (
                      <>
                        <button
                          onClick={() => void updateOffer(offer.id, { status: "accepted" })}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => void updateOffer(offer.id, { status: "rejected" })}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Reject
                        </button>
                      </>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
