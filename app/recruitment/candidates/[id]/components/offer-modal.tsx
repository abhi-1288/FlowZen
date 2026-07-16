"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";

export default function OfferModal({
  candidateId,
  jobId,
}: {
  candidateId: string;
  jobId: string | null;
}) {
  const router = useRouter();
  const { modal, setModal, createOffer, saving, activeJob, fetchJob } =
    useRecruitmentStore();
  const [loadingJob, setLoadingJob] = useState(false);
  const [offeredCTC, setOfferedCTC] = useState("");

  useEffect(() => {
    if (modal?.type !== "generate-offer" || !jobId) return;
    let cancelled = false;
    setLoadingJob(true);
    (async () => {
      try {
        await fetchJob(jobId);
      } catch {
        // fallback to empty form
      } finally {
        if (!cancelled) setLoadingJob(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modal?.type, jobId, fetchJob]);

  const job = activeJob;
  const salaryType = job?.salaryType === "per-month" ? "per-month" : "per-annum";
  const salaryLabel = salaryType === "per-month" ? "per month" : "per annum";
  const currencySymbol = CURRENCY_SYMBOLS[job?.currency ?? "INR"] ?? "₹";
  const salaryMin = Math.max(0, Number(job?.salaryRangeMin || 0));
  const salaryMax = Math.max(salaryMin, Number(job?.salaryRangeMax || 0));
  const hasSalaryRange = salaryMax > salaryMin;
  const sliderStep = salaryMax - salaryMin > 100000 ? 10000 : 1000;
  const selectedCTC = Number(offeredCTC || salaryMax || salaryMin || 0);

  useEffect(() => {
    if (modal?.type !== "generate-offer") return;
    if (!job) {
      setOfferedCTC("");
      return;
    }
    const defaultAmount = Number(job.salaryRangeMax || job.salaryRangeMin || 0);
    setOfferedCTC(defaultAmount > 0 ? String(defaultAmount) : "");
  }, [modal?.type, job?.id, job?.salaryRangeMin, job?.salaryRangeMax]);

  if (modal?.type !== "generate-offer") return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createOffer({
      candidate: candidateId,
      offeredCTC: selectedCTC,
      salaryType,
      pfAmount: Number(form.get("pfAmount") || 0),
      esicAmount: Number(form.get("esicAmount") || 0),
      joiningDate: String(form.get("joiningDate") || ""),
      designation: String(form.get("designation") || ""),
      department: String(form.get("department") || ""),
      officeLocation: String(form.get("officeLocation") || ""),
      perks: String(form.get("perks") || ""),
      status: "draft",
    });
    setModal(null);
    router.push(`/recruitment/offer/jobs/${candidateId}`);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/35">
      <div className="flex min-h-full items-start justify-center p-4 pt-12">
        <div className="w-full max-w-lg rounded-lg bg-white shadow-soft">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold">Generate Offer</h2>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              onClick={() => setModal(null)}
              type="button"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          {loadingJob ? (
            <div className="p-5 text-center text-sm text-slate-500">
              Loading job details...
            </div>
          ) : (
            <form className="p-5" onSubmit={handleSubmit} key={job?.id === jobId ? `loaded-${jobId}` : "empty"}>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Offered CTC * ({salaryLabel})
                  </span>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold text-slate-950">
                        {currencySymbol}
                        {selectedCTC.toLocaleString("en-IN")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Auto selected from job salary type: {salaryLabel}
                      </p>
                    </div>
                    {job && (
                      <p className="text-right text-xs text-slate-500">
                        Job range<br />
                        {currencySymbol}
                        {salaryMin.toLocaleString("en-IN")} - {currencySymbol}
                        {salaryMax.toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                  <input name="offeredCTC" type="hidden" value={selectedCTC || ""} />
                  <input name="salaryType" type="hidden" value={salaryType} />
                  <input
                    type="range"
                    required
                    min={hasSalaryRange ? salaryMin : 0}
                    max={hasSalaryRange ? salaryMax : Math.max(salaryMax, selectedCTC, 100000)}
                    step={sliderStep}
                    value={selectedCTC}
                    onChange={(e) => setOfferedCTC(e.target.value)}
                    className="mt-4 w-full accent-slate-950"
                    disabled={!job || salaryMax <= 0}
                  />
                  <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-400">
                    <span>
                      {currencySymbol}
                      {(hasSalaryRange ? salaryMin : 0).toLocaleString("en-IN")}
                    </span>
                    <span>
                      {currencySymbol}
                      {(hasSalaryRange ? salaryMax : Math.max(salaryMax, selectedCTC, 100000)).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Designation *
                  </span>
                  <input
                    name="designation"
                    required
                    defaultValue={job?.title || ""}
                    readOnly={Boolean(job?.title)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 read-only:bg-slate-50 read-only:text-slate-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Department
                  </span>
                  <input
                    name="department"
                    defaultValue={job?.department || ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    PF Amount (per year)
                  </span>
                  <input
                    name="pfAmount"
                    type="number"
                    min="0"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    ESIC Amount (per year)
                  </span>
                  <input
                    name="esicAmount"
                    type="number"
                    min="0"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Joining Date
                  </span>
                  <input
                    name="joiningDate"
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Office Location
                  </span>
                  <input
                    name="officeLocation"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Bangalore, India"
                  />
                </label>
                <label className="block col-span-full">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Travel &amp; Food Accommodation
                  </span>
                  <textarea
                    name="perks"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Company provides travel allowance and complimentary meals."
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-4 w-full rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Generating..." : "Generate Offer"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
