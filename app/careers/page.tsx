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
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#1a1a1a]">
      <header className="border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-[#000000]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
              F
            </div>
            <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">FlowZen</span>
            <span className="hidden text-sm text-slate-400 dark:text-zinc-500 sm:inline">·</span>
            <span className="hidden text-sm text-slate-500 dark:text-zinc-400 sm:inline">Careers</span>
          </div>
          <Link
            href="/login"
            className="rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-300 transition-all hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:shadow-sm"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 sm:px-8 sm:pt-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-4xl">
            Find your next opportunity
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-500 dark:text-zinc-400 leading-relaxed">
            Explore open positions across companies using FlowZen.
            Apply directly and join amazing teams.
          </p>
        </div>

        {loading ? (
          <div className="mt-20 grid place-items-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
          </div>
        ) : companies.length === 0 ? (
          <div className="mt-20 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-slate-300 dark:text-zinc-600" />
            <h2 className="mt-5 text-base font-semibold text-slate-700 dark:text-zinc-300">No open positions right now</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">Check back later for new opportunities.</p>
          </div>
        ) : (
          <div className="mt-14 space-y-12">
            {companies.map((group, index) => (
              <section key={group.company?.id ?? index}>
                <div className="mb-6 flex items-center gap-3.5">
                  {group.company.icon ? (
                    <img src={group.company.icon} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400">
                      <Building2 size={20} />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{group.company.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      {group.jobs.length} open position{group.jobs.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.jobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/careers/jobs/${slugify(group.company.name)}/${job.id}`}
                      className="group block rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors">
                          {job.title}
                        </h3>
                        <span className="shrink-0 rounded-full bg-slate-100 dark:bg-zinc-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-zinc-400">
                          {job.employmentType}
                        </span>
                      </div>
                      <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-zinc-400">
                        {job.department && (
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase size={14} className="text-slate-400 dark:text-zinc-500" />
                            {job.department}
                          </span>
                        )}
                        {job.location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={14} className="text-slate-400 dark:text-zinc-500" />
                            {job.location}
                          </span>
                        )}
                        {job.salaryRangeMin > 0 && (
                          <span className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-zinc-400">
                            {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMax.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {job.requiredSkills.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {job.requiredSkills.slice(0, 4).map((skill) => (
                            <span key={skill} className="rounded-full bg-slate-100 dark:bg-zinc-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-zinc-400">
                              {skill}
                            </span>
                          ))}
                          {job.requiredSkills.length > 4 && (
                            <span className="text-xs text-slate-400 dark:text-zinc-500">+{job.requiredSkills.length - 4} more</span>
                          )}
                        </div>
                      )}
                      {job.description && (
                        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">{job.description}</p>
                      )}
                      {job.autoCloseDate && (
                        <p className="mt-3 text-xs text-slate-400 dark:text-zinc-500">
                          Closes: {new Date(job.autoCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      <span className="mt-5 block w-full rounded-full bg-slate-900 px-5 py-2.5 text-center text-sm font-medium text-white transition-all duration-200 group-hover:bg-slate-800 active:bg-slate-950">
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
