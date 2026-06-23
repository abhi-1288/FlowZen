"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { Eye, Share2, Check } from "lucide-react";

type CareerJob = {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  salaryRangeMin: number;
  salaryRangeMax: number;
  currency: string;
  description: string;
  requiredSkills: string[];
  openings: number;
  autoCloseDate: string | null;
  company: { id: string; name: string };
};

function jobUrl(job: CareerJob) {
  const slug = job.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${window.location.origin}/careers/jobs/${slug}/${job.id}`;
}

export function CareersTab() {
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ jobs: CareerJob[] }>("/api/profile/jobs")
      .then((data) => setJobs(data.jobs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">
        <h2 className="text-lg font-semibold text-slate-900">Career Openings</h2>
        <p className="mt-1 text-sm text-slate-500">
          {loading ? "Loading..." : `${jobs.length} open position${jobs.length !== 1 ? "s" : ""} in your company`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">No open positions right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                  <p className="text-sm text-slate-500">{job.department} &middot; {job.location || "Remote"} &middot; {job.employmentType}</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  {job.openings} opening{job.openings > 1 ? "s" : ""}
                </span>
              </div>
              {(job.salaryRangeMin > 0 || job.salaryRangeMax > 0) && (
                <p className="mt-2 text-sm text-slate-500">
                  {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMax.toLocaleString()}
                </p>
              )}
              {job.requiredSkills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.requiredSkills.map((skill) => (
                    <span key={skill} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{skill}</span>
                  ))}
                </div>
              )}
              {job.description && (
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{job.description}</p>
              )}
              {job.autoCloseDate && (
                <p className="mt-2 text-xs text-slate-400">
                  Closes: {new Date(job.autoCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={jobUrl(job)}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Eye size={14} /> View
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(jobUrl(job)).then(() => { setCopiedId(job.id); setTimeout(() => setCopiedId(null), 2000); });
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  {copiedId === job.id ? <Check size={14} /> : <Share2 size={14} />} {copiedId === job.id ? "Copied" : "Share"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
