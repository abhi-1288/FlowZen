"use client";

import { useEffect, useState } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";

export default function JobDescriptionModal() {
  const { modal, setModal, fetchJob, activeJob } = useRecruitmentStore();
  const isOpen = modal?.type === "view-job-description";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen || !modal || modal.type !== "view-job-description") return;
    setLoading(true);
    setError(false);
    fetchJob(modal.jobId)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isOpen, modal, fetchJob]);

  const job = isOpen ? activeJob : null;

  if (!isOpen) return null;

  const currencySymbol = CURRENCY_SYMBOLS[job?.currency ?? "INR"] ?? "₹";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/35">
      <div className="flex min-h-full items-start justify-center p-4 pt-12">
        <div className="w-full max-w-lg rounded-lg bg-white shadow-soft">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold">Job Description</h2>
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
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : error ? (
              <p className="text-sm text-rose-500">
                Failed to load job details.
              </p>
            ) : !job ? null : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {job.title}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {job.department} &middot; {job.location} &middot;{" "}
                    {job.employmentType}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Salary Range
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {currencySymbol}
                    {Number(job.salaryRangeMin).toLocaleString()} -{" "}
                    {currencySymbol}
                    {Number(job.salaryRangeMax).toLocaleString()}
                  </p>
                </div>

                {job.requiredSkills.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                      Required Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.requiredSkills.map((skill, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {job.description && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                      Description
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {job.description}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  {job.openings > 0 && (
                    <span>
                      {job.openings} opening{job.openings > 1 ? "s" : ""}
                    </span>
                  )}
                  <span
                    className={
                      job.status === "open"
                        ? "text-emerald-600"
                        : job.status === "closed"
                          ? "text-rose-600"
                          : "text-amber-600"
                    }
                  >
                    {job.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
