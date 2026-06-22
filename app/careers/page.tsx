"use client";

import { useEffect, useState } from "react";
import { Briefcase, Building2, MapPin, Clock, DollarSign, X, CheckCircle, Loader2, ExternalLink } from "lucide-react";

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
  company: CompanyInfo;
};

type CompanyGroup = {
  company: CompanyInfo;
  jobs: JobInfo[];
};

export default function CareersPage() {
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingTo, setApplyingTo] = useState<JobInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public/jobs")
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleApply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!applyingTo) return;
    setSubmitting(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/public/jobs/${applyingTo.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: String(form.get("firstName") || ""),
        lastName: String(form.get("lastName") || ""),
        email: String(form.get("email") || ""),
        phone: String(form.get("phone") || ""),
        currentCompany: String(form.get("currentCompany") || ""),
        experienceYears: Number(form.get("experienceYears") || 0),
        notes: String(form.get("notes") || ""),
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Application failed. Please try again.");
      return;
    }
    setSuccess(true);
    setTimeout(() => { setSuccess(false); setApplyingTo(null); }, 3000);
  }

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
            {companies.map((group) => (
              <section key={group.company.id}>
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
                    <article
                      key={job.id}
                      className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-indigo-200"
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
                          <span className="inline-flex items-center gap-1">
                            <DollarSign size={12} />
                            {job.salaryRangeMin.toLocaleString()} - {job.salaryRangeMax.toLocaleString()}
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
                      <button
                        onClick={() => { setApplyingTo(job); setSuccess(false); setError(""); }}
                        className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                      >
                        Apply Now
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {applyingTo && !success && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Apply for {applyingTo.title}</h2>
                <p className="text-xs text-slate-500">{applyingTo.company.name}</p>
              </div>
              <button onClick={() => setApplyingTo(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form className="space-y-4 p-6" onSubmit={handleApply}>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">First Name *</span>
                  <input name="firstName" required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Last Name</span>
                  <input name="lastName" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Email *</span>
                <input name="email" type="email" required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
                <input name="phone" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Current Company</span>
                  <input name="currentCompany" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Years of Experience</span>
                  <input name="experienceYears" type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Cover Letter / Notes</span>
                <textarea name="notes" rows={3} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </form>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Application Submitted!</h2>
            <p className="mt-1 text-sm text-slate-500">Your application has been received. The team will review it and get back to you.</p>
          </div>
        </div>
      )}
    </main>
  );
}
