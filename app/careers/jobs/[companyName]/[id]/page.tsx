"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Building2, MapPin, CheckCircle, Loader2, ArrowLeft, Upload, ExternalLink, Clock } from "lucide-react";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";

type JobDetail = {
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
  company: { id: string; name: string; icon: string };
};

export default function JobDetailPage() {
  const params = useParams()!;
  const router = useRouter();
  const id = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/jobs/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((data) => setJob(data.job))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    setSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("currentCompany", currentCompany);
    formData.set("experienceYears", String(Number(experienceYears) || 0));
    formData.set("noticePeriod", String(Number(noticePeriod) || 0));
    formData.set("notes", notes);
    formData.set("portfolioUrl", portfolioUrl);
    formData.set("linkedInUrl", linkedInUrl);
    if (resumeFile) formData.set("resume", resumeFile);

    const res = await fetch(`/api/public/jobs/${job.id}/apply`, {
      method: "POST",
      body: formData,
    });

    try {
      if (!res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setError(data.error ?? `Server error (${res.status})`);
        } catch {
          setError(`Server error (${res.status}). Please try again.`);
        }
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </main>
    );
  }

  if (notFound || !job) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-slate-300" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Job not found</h1>
          <p className="mt-2 text-sm text-slate-500">This position may have been filled or removed.</p>
          <Link href="/careers" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft size={16} /> Browse all openings
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="mx-auto max-w-lg px-4 py-32 text-center">
          <CheckCircle className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Application Submitted!</h1>
          <p className="mt-2 text-sm text-slate-500">Your application for {job.title} at {job.company.name} has been received. The team will review it and get back to you.</p>
          <Link href="/careers" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft size={16} /> Browse more jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">F</div>
            <span className="text-lg font-bold text-slate-900">FlowZen</span>
            <span className="hidden text-sm text-slate-400 sm:inline">· Careers</span>
          </div>
          <Link href="/careers" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft size={16} className="inline" /> All jobs
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            {job.company.icon ? (
              <img src={job.company.icon} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <Building2 size={20} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.title}</h1>
              <p className="text-sm text-slate-500">{job.company.name} &middot; {job.department}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            {job.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} /> {job.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Briefcase size={14} /> {job.employmentType}
            </span>
            {job.salaryRangeMin > 0 && (
              <span>
                {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMax.toLocaleString()}
              </span>
            )}
            {job.autoCloseDate && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} /> Closes {new Date(job.autoCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>

          {job.requiredSkills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {job.requiredSkills.map((skill) => (
                <span key={skill} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{skill}</span>
              ))}
            </div>
          )}

          {job.description && (
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{job.description}</div>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Apply for this position</h2>
          <span className="text-sm text-slate-500">All mandatory fields are being marked as <span className="text-red-500">*</span></span>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">First Name *</span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Last Name</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email *</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Current Company</span>
                <input value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Years of Experience</span>
                <input value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Notice Period (days)</span>
                <input value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Cover Letter / Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Resume / CV *</span>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 file:hidden">
                <Upload size={16} className="shrink-0 text-slate-400" />
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    required
                    onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm outline-none file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-indigo-50 file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                  />
              </div>
              {resumeFile && <p className="mt-1 text-xs text-slate-500">{resumeFile.name}</p>}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Portfolio URL</span>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
                  <ExternalLink size={14} className="shrink-0 text-slate-400" />
                  <input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://" className="w-full border-0 p-0 text-sm outline-none" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">LinkedIn URL</span>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
                  <ExternalLink size={14} className="shrink-0 text-slate-400" />
                  <input value={linkedInUrl} onChange={(e) => setLinkedInUrl(e.target.value)} placeholder="https://linkedin.com/in/" className="w-full border-0 p-0 text-sm outline-none" />
                </div>
              </label>
            </div>
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
    </main>
  );
}
