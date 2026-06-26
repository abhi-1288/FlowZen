"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client-utils";

type LetterOffer = {
  id: string;
  candidate: { firstName: string; lastName: string; email: string; phone?: string };
  job: { title: string; department: string; location: string };
  company: { name: string; icon?: string };
  offeredCTC: number;
  salaryType?: "per-annum" | "per-month";
  pfAmount: number;
  esicAmount: number;
  joiningDate: string | null;
  designation: string;
  department: string;
  officeLocation: string;
  perks: string;
  status: string;
  signedBy?: { name?: string; role?: string } | null;
  signedAt?: string | null;
  isSigned?: boolean;
};

type PolicyData = {
  foodAmount: number;
  travelAccommodationAmount: number;
};

export default function CandidateOfferLetterPage() {
  const params = useParams()!;
  const candidateId = params.id as string;
  const [offer, setOffer] = useState<LetterOffer | null>(null);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<{ offer: LetterOffer }>(`/api/recruitment/candidates/${candidateId}/offer`),
      apiFetch<PolicyData>("/api/finance/policy").catch(() => null),
    ])
      .then(([offerRes, policyRes]) => {
        if (cancelled) return;
        setOffer(offerRes.offer);
        setPolicy(policyRes);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading letter...</p>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-rose-600">{error || "Offer not found."}</p>
      </div>
    );
  }

  const pfAmt = Number(offer.pfAmount || 0);
  const esicAmt = Number(offer.esicAmount || 0);
  const foodAmt = policy ? Number(policy.foodAmount || 0) * 12 : 0;
  const travelAmt = policy ? Number(policy.travelAccommodationAmount || 0) * 12 : 0;
  const netTakeHome = Number(offer.offeredCTC) - pfAmt - esicAmt - foodAmt - travelAmt;
  const companyName = offer.company?.name ?? "Company";
  const companyIcon = offer.company?.icon ?? "";
  const isMonthlySalary = offer.salaryType === "per-month";
  const compensationPeriod = isMonthlySalary ? "Per Month" : "Per Annum";
  const amountPeriodLabel = isMonthlySalary ? "month" : "year";

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <h1 className="text-lg font-semibold text-slate-900">Offer Letter</h1>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            offer.status === "draft" ? "bg-amber-50 text-amber-700" :
            offer.status === "sent" || offer.status === "accepted" ? "bg-emerald-50 text-emerald-700" :
            "bg-rose-50 text-rose-700"
          }`}>{offer.status}</span>
          <button
            className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => window.print()}
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow-lg print:mx-auto print:min-h-screen print:shadow-none print:p-6 print:text-[11px]">
        <div className="mb-8 text-center print:mb-4">
          <div className="flex items-center justify-center gap-3">
            {companyIcon ? (
              <img src={companyIcon} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                {companyName[0]}
              </div>
            )}
            <h2 className="text-2xl font-bold uppercase tracking-wide text-slate-900 print:text-xl">
              {companyName}
            </h2>
          </div>
          <div className="mx-auto mt-3 h-0.5 w-20 bg-indigo-600 print:mt-1" />
        </div>

        <h1 className="mb-6 text-center text-xl font-bold text-slate-900 print:mb-4 print:text-lg">
          Offer of Employment
        </h1>

        <p className="mb-6 text-sm text-slate-600 print:mb-4">
          Date: <strong>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>
        </p>

        <div className="space-y-4 text-sm leading-relaxed text-slate-800 print:space-y-2">
          <p>Dear <strong>{offer.candidate.firstName} {offer.candidate.lastName}</strong>,</p>

          <p>
            We are pleased to offer you the position of <strong>{offer.designation}</strong> at <strong>{companyName}</strong>.
            We were impressed with your qualifications and believe your skills and experience will be a valuable addition to our team.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:p-2">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 print:py-1">Candidate Name</td>
                  <td className="py-1.5 font-medium text-slate-900 print:py-1">{offer.candidate.firstName} {offer.candidate.lastName}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 print:py-1">Email</td>
                  <td className="py-1.5 font-medium text-slate-900 print:py-1">{offer.candidate.email}</td>
                </tr>
                {offer.candidate.phone ? (
                  <tr>
                    <td className="py-1.5 pr-4 text-slate-500 print:py-1">Phone</td>
                    <td className="py-1.5 font-medium text-slate-900 print:py-1">{offer.candidate.phone}</td>
                  </tr>
                ) : null}
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 print:py-1">Designation</td>
                  <td className="py-1.5 font-medium text-slate-900 print:py-1">{offer.designation}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500 print:py-1">Department</td>
                  <td className="py-1.5 font-medium text-slate-900 print:py-1">{offer.department || offer.job?.department || "N/A"}</td>
                </tr>
                {offer.officeLocation ? (
                  <tr>
                    <td className="py-1.5 pr-4 text-slate-500 print:py-1">Office Location</td>
                    <td className="py-1.5 font-medium text-slate-900 print:py-1">{offer.officeLocation}</td>
                  </tr>
                ) : null}
                {offer.joiningDate ? (
                  <tr>
                    <td className="py-1.5 pr-4 text-slate-500 print:py-1">Joining Date</td>
                    <td className="py-1.5 font-medium text-slate-900 print:py-1">
                      {new Date(offer.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6 print:mt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 print:mb-2">Compensation Summary ({compensationPeriod})</h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-700 print:px-2 print:py-1">Component</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-700 print:px-2 print:py-1">Amount (per {amountPeriodLabel})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-white">
                    <td className="px-4 py-2.5 text-slate-700 print:px-2 print:py-1">Gross CTC</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900 print:px-2 print:py-1">₹{Number(offer.offeredCTC).toLocaleString()}</td>
                  </tr>
                  {pfAmt > 0 ? (
                    <tr className="bg-white">
                      <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- PF Deduction</td>
                      <td className="px-4 py-2.5 text-right text-rose-600 print:px-2 print:py-1">- ₹{pfAmt.toLocaleString()}</td>
                    </tr>
                  ) : null}
                  {esicAmt > 0 ? (
                    <tr className="bg-white">
                      <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- ESIC Deduction</td>
                      <td className="px-4 py-2.5 text-right text-rose-600 print:px-2 print:py-1">- ₹{esicAmt.toLocaleString()}</td>
                    </tr>
                  ) : null}
                  {foodAmt > 0 ? (
                    <tr className="bg-white">
                      <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- Food Accommodation</td>
                      <td className="px-4 py-2.5 text-right text-rose-600 print:px-2 print:py-1">- ₹{foodAmt.toLocaleString()}</td>
                    </tr>
                  ) : null}
                  {travelAmt > 0 ? (
                    <tr className="bg-white">
                      <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- Travel Accommodation</td>
                      <td className="px-4 py-2.5 text-right text-rose-600 print:px-2 print:py-1">- ₹{travelAmt.toLocaleString()}</td>
                    </tr>
                  ) : null}
                  <tr className="bg-emerald-50">
                    <td className="px-4 py-2.5 font-semibold text-emerald-800 print:px-2 print:py-1">Net Take-Home (Approx)</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-800 print:px-2 print:py-1">₹{netTakeHome.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {offer.perks ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 print:mt-2 print:p-2">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-800 print:text-[10px]">
                Travel &amp; Food Accommodation
              </h4>
              <p className="text-sm text-amber-900 print:text-[11px]">{offer.perks}</p>
            </div>
          ) : null}

          <p className="mt-4 print:mt-2">
            We look forward to welcoming you to {companyName} and are excited about the contributions you will make to our team.
          </p>
        </div>

        <div className="mt-12 print:mt-6">
          <p className="mb-8 text-xs font-semibold uppercase tracking-wider text-slate-500 print:mb-4 print:text-[10px]">
            Authorized Signatories
          </p>
          <div className="grid grid-cols-2 gap-x-12 gap-y-10 print:gap-x-6 print:gap-y-3">
            {offer.isSigned ? (
              <>
                <div className="flex flex-col items-center">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-[9px]">HR Name</p>
                  <div className="mb-1 h-10 w-48 border-b border-slate-400 print:h-6 print:w-36" />
                  <p className="text-sm font-medium text-slate-900 print:text-[11px]">{offer.signedBy?.name || "N/A"}</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-[9px]">HR Role</p>
                  <div className="mb-1 h-10 w-48 border-b border-slate-400 print:h-6 print:w-36" />
                  <p className="text-sm font-medium text-slate-900 print:text-[11px]">{offer.signedBy?.role || "N/A"}</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-[9px]">Signed Date &amp; Time</p>
                  <div className="mb-1 h-10 w-48 border-b border-slate-400 print:h-6 print:w-36" />
                  <p className="text-sm font-medium text-slate-900 print:text-[11px]">{offer.signedAt ? new Date(offer.signedAt).toLocaleString("en-IN") : "N/A"}</p>
                </div>
                <div className="col-span-2 text-center pt-2">
                  <p className="text-xs italic text-slate-500 print:text-[10px]">Electronically signed through FlowZen HRMS.</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400 print:text-[9px]">
                  Authorized Signatory
                </p>
                <div className="mb-1 h-10 w-48 border-b border-slate-400 print:h-6 print:w-36" />
                <p className="text-sm font-medium text-slate-900 print:text-[11px]">{companyName}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-4 text-center text-xs text-slate-400 print:mt-6 print:pt-2 print:text-[9px]">
          {offer.joiningDate && (
            <p className="mb-2 text-slate-600">
              Please bring this Offer Letter to {companyName} on your joining date ({new Date(offer.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}).
            </p>
          )}
          Generated by FlowZen &middot; {new Date().toLocaleDateString("en-IN")}
        </div>
      </div>
    </div>
  );
}
