"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Building2, MapPin } from "lucide-react";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";

type CompanyInfo = {
  id: string;
  name: string;
  icon: string;
};

type JobInfo = {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  salaryRangeMin: number;
  salaryRangeMax: number;
  description: string;
  requiredSkills: string[];
  currency: string;
  autoCloseDate: string | null;
  company: CompanyInfo;
};

type CompanyGroup = {
  company: CompanyInfo;
  jobs: JobInfo[];
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CareersPage() {
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/jobs")
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">F</div>
            <span className="text-lg font-bold text-slate-900">FlowZen</span>
            <span className="hidden text-sm text-slate-400 sm:inline">· Careers</span>
          </div>
          <a
            href="/login"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Sign in
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Find your next <span className="text-indigo-600">opportunity</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Explore open positions across companies using FlowZen. Apply directly and join amazing teams.
          </p>
        </div>

        {loading ? (
          <div className="mt-16 grid place-items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
          </div>
        ) : companies.length === 0 ? (
          <div className="mt-16 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-700">No open positions right now</h2>
            <p className="mt-1 text-sm text-slate-500">Check back later for new opportunities.</p>
          </div>
        ) : (
          <div className="mt-12 space-y-12">
            {companies.map((group, index) => (
              <section key={group.company?.id ?? index}>
                <div className="mb-6 flex items-center gap-3">
                  {group.company.icon ? (
                    <img src={group.company.icon} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <Building2 size={20} />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{group.company.name}</h2>
                    <p className="text-sm text-slate-500">{group.jobs.length} open position{group.jobs.length > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.jobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/careers/jobs/${slugify(group.company.name)}/${job.id}`}
                      className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-indigo-200"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600">
                          {job.employmentType}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                        {job.department && (
                          <span className="inline-flex items-center gap-1">
                            <Briefcase size={12} />
                            {job.department}
                          </span>
                        )}
                        {job.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} />
                            {job.location}
                          </span>
                        )}
                        {job.salaryRangeMin > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMax.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {job.requiredSkills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {job.requiredSkills.slice(0, 4).map((skill) => (
                            <span key={skill} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {skill}
                            </span>
                          ))}
                          {job.requiredSkills.length > 4 && (
                            <span className="text-[11px] text-slate-400">+{job.requiredSkills.length - 4} more</span>
                          )}
                        </div>
                      )}
                      {job.description && (
                        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500">{job.description}</p>
                      )}
                      {job.autoCloseDate && (
                        <p className="mt-2 text-xs text-slate-400">
                          Closes: {new Date(job.autoCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      <span className="mt-4 block w-full rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-indigo-700">
                        Apply Now
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
