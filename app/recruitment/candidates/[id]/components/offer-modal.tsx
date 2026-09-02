"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";
import { apiFetch } from "@/lib/client-utils";

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
  const [regions, setRegions] = useState<string[]>([]);
  const [officeLocation, setOfficeLocation] = useState("");
  const [useOtherLoc, setUseOtherLoc] = useState(false);

  useEffect(() => {
    if (modal?.type !== "generate-offer" || !jobId) return;
    let cancelled = false;
    setLoadingJob(true);
    (async () => {
      try {
        await fetchJob(jobId);
        try {
          const res = await apiFetch<{
            addresses: { label?: string }[];
            multiOffice: boolean;
          }>("/api/company/address");
          if (!cancelled) {
            setRegions(
              (res.addresses || [])
                .map((a) => (a.label ?? "").trim())
                .filter(Boolean),
            );
          }
        } catch {}
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
  const ALL_SALARY_TYPES = ["per-annum", "per-month", "per-day", "per-hour"];
  const salaryType = job && ALL_SALARY_TYPES.includes(job.salaryType) ? job.salaryType : "per-annum";
  const SALARY_LABELS: Record<string, string> = {
    "per-annum": "per annum",
    "per-month": "per month",
    "per-day": "per day",
    "per-hour": "per hour",
  };
  const salaryLabel = SALARY_LABELS[salaryType] || "per annum";
  const currency = job?.currency || "INR";
  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? "₹";
  const salaryMin = Math.max(0, Number(job?.salaryRangeMin || 0));
  const salaryMax = Math.max(salaryMin, Number(job?.salaryRangeMax || 0));
  const hasSalaryRange = salaryMax > salaryMin;
  const sliderStep = salaryMax - salaryMin > 100000 ? 10000 : 1000;

  const blockReason =
    job && salaryMax <= 0
      ? "This job description has 0 pay (unpaid). An offer letter cannot be generated until a CTC is set on the job. Please update the job's salary range first."
      : "";
  const selectedCTC = Number(offeredCTC || salaryMax || salaryMin || 0);

  useEffect(() => {
    if (modal?.type !== "generate-offer") return;
    if (!job) {
      setOfferedCTC("");
      setOfficeLocation("");
      setUseOtherLoc(false);
      return;
    }
    const defaultAmount = Number(job.salaryRangeMax || job.salaryRangeMin || 0);
    setOfferedCTC(defaultAmount > 0 ? String(defaultAmount) : "");
    setOfficeLocation(job.location || "");
    setUseOtherLoc(false);
  }, [modal?.type, job?.id, job?.salaryRangeMin, job?.salaryRangeMax, job?.location]);

  if (modal?.type !== "generate-offer") return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createOffer({
      candidate: candidateId,
      offeredCTC: selectedCTC,
      salaryType,
      currency,
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
    <div className="fixed inset-0 z-50 overflow-y-auto neu-overlay">
      <div className="flex min-h-full items-start justify-center p-4 pt-12">
        <div className="w-full max-w-lg rounded-lg neu-card">
          <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
            <h2 className="text-base font-semibold">Generate Offer</h2>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
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
          ) : blockReason ? (
            <div className="p-5">
              <div className="rounded-lg neu-inset p-4 text-sm text-slate-600">
                {blockReason}
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="neu-btn neu-btn-primary mt-4 w-full rounded-full px-4 py-2.5 text-sm font-medium"
              >
                Close
              </button>
            </div>
          ) : (
            <form className="p-5" onSubmit={handleSubmit} key={job?.id === jobId ? `loaded-${jobId}` : "empty"}>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div className="col-span-full rounded-lg neu-inset p-4">
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
                        {job
                          ? `Auto selected from job salary type: ${salaryLabel}`
                          : "Manual entry (no job linked to this candidate)"}
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
                  {job ? (
                    <>
                      <input
                        type="range"
                        required
                        min={hasSalaryRange ? salaryMin : 0}
                        max={hasSalaryRange ? salaryMax : Math.max(salaryMax, selectedCTC, 100000)}
                        step={sliderStep}
                        value={selectedCTC}
                        onChange={(e) => setOfferedCTC(e.target.value)}
                        className="mt-4 w-full accent-slate-950"
                        disabled={salaryMax <= 0}
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
                    </>
                  ) : (
                    <input
                      type="number"
                      required
                      min="0"
                      value={offeredCTC}
                      onChange={(e) => setOfferedCTC(e.target.value)}
                      placeholder="Enter CTC"
                      className="mt-4 w-full rounded-lg neu-inset px-3 py-2.5 text-sm"
                    />
                  )}
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
                    className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm read-only: read-only:text-slate-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Department
                  </span>
                  <input
                    name="department"
                    defaultValue={job?.department || ""}
                    className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
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
                    className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
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
                    className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
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
                    className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Office Location
                  </span>
                  {useOtherLoc ? (
                    <div className="flex gap-2">
                      <input
                        name="officeLocation"
                        value={officeLocation}
                        onChange={(e) => setOfficeLocation(e.target.value)}
                        placeholder="e.g. Bangalore, India"
                        className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setUseOtherLoc(false)}
                        className="shrink-0 rounded-lg border border-[var(--c-border-light)] px-3 text-sm text-slate-600 hover:bg-[var(--c-bg-muted)]"
                      >
                        List
                      </button>
                    </div>
                  ) : (
                    <select
                      name="officeLocation"
                      value={officeLocation}
                      onChange={(e) => {
                        if (e.target.value === "__other__") {
                          setUseOtherLoc(true);
                          setOfficeLocation("");
                        } else {
                          setOfficeLocation(e.target.value);
                        }
                      }}
                      className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
                    >
                      {officeLocation &&
                        !regions.includes(officeLocation) &&
                        officeLocation !== "Remote" && (
                          <option value={officeLocation}>{officeLocation}</option>
                        )}
                      {regions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                      <option value="Remote">Remote</option>
                      <option value="__other__">Other…</option>
                    </select>
                  )}
                </label>
                <label className="block col-span-full">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Travel &amp; Food Accommodation
                  </span>
                  <textarea
                    name="perks"
                    rows={2}
                    className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
                    placeholder="e.g. Company provides travel allowance and complimentary meals."
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="neu-btn neu-btn-primary mt-4 w-full rounded-full px-4 py-2.5 text-sm font-medium"
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
