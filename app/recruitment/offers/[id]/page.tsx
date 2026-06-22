"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";

export default function OfferDetailPage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const { offers, fetchOffers, updateOffer } = useRecruitmentStore();

  useEffect(() => { void fetchOffers(); }, [fetchOffers]);

  const offer = offers.find((o) => o.id === id);

  if (!offer) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="mb-4 text-sm text-slate-500 hover:text-slate-900">&larr; Back</button>
        <p className="text-slate-500">Offer not found.</p>
      </div>
    );
  }

  const candidateName = offer.candidate && typeof offer.candidate === "object"
    ? `${(offer.candidate as any).firstName} ${(offer.candidate as any).lastName}`
    : "Unknown";
  const jobTitle = offer.job && typeof offer.job === "object"
    ? (offer.job as any).title : "";

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Offer: {candidateName}</h1>
            <p className="text-sm text-slate-500">{offer.designation} {jobTitle ? `· ${jobTitle}` : ""}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            offer.status === "draft" ? "bg-amber-50 text-amber-700" :
            offer.status === "sent" ? "bg-sky-50 text-sky-700" :
            offer.status === "accepted" ? "bg-emerald-50 text-emerald-700" :
            "bg-rose-50 text-rose-700"
          }`}>{offer.status}</span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Offered CTC</p>
            <p className="mt-1 text-lg font-bold text-slate-900">₹{Number(offer.offeredCTC).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Department</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{offer.department || "N/A"}</p>
          </div>
          {offer.joiningDate && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Joining Date</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{new Date(offer.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href={`/api/recruitment/offers/${offer.id}/letter`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <FileText size={16} /> Download Offer Letter
          </a>
          <a
            href={`/api/recruitment/offers/${offer.id}/letter`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ExternalLink size={16} /> Preview
          </a>
        </div>
      </div>
    </div>
  );
}
