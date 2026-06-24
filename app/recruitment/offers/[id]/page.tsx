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
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Designation</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{offer.designation}</p>
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

        <div className="mt-6 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">Salary Breakdown (₹/year)</p>
          </div>
          <div className="space-y-0 divide-y divide-slate-100 px-5 py-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">Gross CTC</span>
              <span className="text-sm font-semibold text-slate-900">₹{Number(offer.offeredCTC).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">PF Deduction</span>
              <span className="text-sm text-rose-600">- ₹{Number(offer.pfAmount || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">ESIC Deduction</span>
              <span className="text-sm text-rose-600">- ₹{Number(offer.esicAmount || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-slate-900">Net Take-Home (Approx)</span>
              <span className="text-sm font-semibold text-emerald-600">₹{Number(offer.offeredCTC - (offer.pfAmount || 0) - (offer.esicAmount || 0)).toLocaleString()}</span>
            </div>
          </div>
          {offer.pfAmount || offer.esicAmount ? (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <p className="text-xs text-slate-500">Food &amp; travel accommodation deductions are applied as per company policy. See the full offer letter for the complete breakdown.</p>
            </div>
          ) : null}
          <div className="border-t border-slate-200 px-5 py-3">
            <p className="text-xs text-slate-400 italic">Note: A detailed offer letter will be provided after joining the company.</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href={`/recruitment/offers/${offer.id}/letter`}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <FileText size={16} /> View Offer Letter
          </a>
        </div>
      </div>
    </div>
  );
}
