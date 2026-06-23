"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";

export default function ReferralsPage() {
  const { referrals, loading, fetchReferrals, createReferral, setModal } = useRecruitmentStore();
  const [candidateId, setCandidateId] = useState("");
  const [bonusEligible, setBonusEligible] = useState(false);

  useEffect(() => { if (referrals.length === 0) void fetchReferrals(); }, [referrals.length, fetchReferrals]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidateId.trim()) return;
    await createReferral({ candidateId: candidateId.trim(), referralBonusEligible: bonusEligible });
    setCandidateId("");
    setBonusEligible(false);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Referrals</h1>
      <p className="mt-1 text-sm text-slate-500">{referrals.length} total</p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block flex-1 min-w-[200px]">
          <span className="mb-1 block text-sm font-medium text-slate-700">Candidate ID</span>
          <input
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            placeholder="Enter candidate ObjectId"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={bonusEligible}
            onChange={(e) => setBonusEligible(e.target.checked)}
            className="rounded border-slate-300"
          />
          Referral bonus eligible
        </label>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <UserPlus size={16} /> Submit Referral
        </button>
      </form>

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No referrals yet.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {referrals.map((referral) => {
            const employeeName = referral.employee && typeof referral.employee === "object"
              ? (referral.employee as any).name : "Unknown";
            const candidateName = referral.candidate && typeof referral.candidate === "object"
              ? `${(referral.candidate as any).firstName} ${(referral.candidate as any).lastName}`
              : "Unknown";

            return (
              <div key={referral.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{candidateName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        referral.status === "pending" ? "bg-amber-50 text-amber-700" :
                        referral.status === "reviewed" ? "bg-sky-50 text-sky-700" :
                        referral.status === "hired" ? "bg-emerald-50 text-emerald-700" :
                        "bg-rose-50 text-rose-700"
                      }`}>{referral.status}</span>
                    </div>
                    <p className="text-xs text-slate-500">Referred by {employeeName}</p>
                  </div>
                  {referral.referralBonusEligible && (
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      Bonus Eligible
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
