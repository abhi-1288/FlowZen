"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, ExternalLink, PenSquare, Send, CheckCircle } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useSession } from "next-auth/react";
import type { ATSOffer } from "@/lib/recruitment-types";

export default function CandidateOfferPage() {
  const params = useParams()!;
  const router = useRouter();
  const candidateId = params.candidateId as string;
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isHr = role === "admin" || role === "human-resource";
  const { offers, fetchOffers, updateOffer, signOffer } = useRecruitmentStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      await fetchOffers();
      setLoading(false);
    })();
  }, [fetchOffers]);

  const offer = offers.find((o) => {
    const cId = typeof o.candidate === "object" ? o.candidate.id : o.candidate;
    return cId === candidateId;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="p-6 max-w-xl">
        <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <FileText size={40} className="mx-auto text-slate-300" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">No Offer Found</h2>
          <p className="mt-1 text-sm text-slate-500">This candidate doesn't have an offer yet.</p>
          <button
            onClick={() => router.push("/recruitment/offers")}
            className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Go to Offers
          </button>
        </div>
      </div>
    );
  }

  const candidateName = typeof offer.candidate === "object"
    ? `${(offer.candidate as any).firstName} ${(offer.candidate as any).lastName}`
    : "Unknown";
  const jobTitle = typeof offer.job === "object" ? (offer.job as any).title : "";
  const salaryPeriodLabel = offer.salaryType === "per-month" ? "month" : "year";

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
            <p className="mt-1 text-sm font-medium text-slate-900">₹{Number(offer.offeredCTC).toLocaleString()}/{salaryPeriodLabel}</p>
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
          {offer.officeLocation && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Office Location</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{offer.officeLocation}</p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">Salary Breakdown (per {salaryPeriodLabel})</p>
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
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href={`/recruitment/offers/${offer.id}/letter`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <FileText size={16} /> View Offer Letter
          </a>
          <button
            onClick={() => router.push("/recruitment/offers")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ExternalLink size={16} /> All Offers (Jobs)
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Digital Signature</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              offer.isSigned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              {offer.isSigned ? "Signed" : "Not Signed"}
            </span>
          </div>
          {offer.isSigned ? (
            <div className="mt-3 flex flex-col items-center">
              <div className="rounded-lg border border-slate-300 px-4 py-2 text-left min-w-[200px]">
                <p className="text-sm font-semibold text-slate-900">{(offer.signedBy as any)?.name || "N/A"}</p>
                <div className="border-t border-slate-300 my-1 w-1/2" />
                <p className="text-sm font-semibold text-slate-900">{(offer.signedBy as any)?.role || "N/A"}</p>
                <div className="border-t border-slate-300 my-1 w-1/2" />
                <p className="text-sm font-semibold text-slate-900">{offer.signedAt ? new Date(offer.signedAt).toLocaleString("en-IN") : "N/A"}</p>
              </div>
              <div className="mt-3 w-48 border-t border-slate-400" />
              <p className="mt-1 text-sm font-medium text-slate-700">Authority</p>
              <p className="mt-0.5 font-mono text-[10px] tracking-widest text-slate-400 uppercase">flowzen-hrms</p>
              {offer.status === "draft" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => { await updateOffer(offer.id, { status: "sent" }); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    <Send size={16} /> Send Offer
                  </button>
                </div>
              )}
            </div>
          ) : isHr ? (
            <div className="mt-3">
              <button
                onClick={async () => { await signOffer(offer.id); }}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <PenSquare size={16} /> Sign Offer
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/recruitment/offers")}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            View all offers grouped by jobs &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
