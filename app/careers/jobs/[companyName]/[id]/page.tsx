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
  const [knowEmployee, setKnowEmployee] = useState(false);
  const [referralId, setReferralId] = useState("");
  const [referralStatus, setReferralStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
  const [referralName, setReferralName] = useState("");
  const [referralCompanyName, setReferralCompanyName] = useState("");
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

  useEffect(() => {
    if (!knowEmployee || !referralId.trim() || !job) {
      setReferralStatus("idle");
      return;
    }
    const timer = setTimeout(async () => {
      setReferralStatus("verifying");
      try {
        const res = await fetch(`/api/public/jobs/${job.id}/verify-referral?referralId=${encodeURIComponent(referralId)}`);
        if (!res.ok) {
          setReferralStatus("error");
          return;
        }
        const data = await res.json();
        setReferralName(data.name);
        setReferralCompanyName(data.company);
        setReferralStatus("verified");
      } catch {
        setReferralStatus("error");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [referralId, knowEmployee, job]);

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
    formData.set("referralId", referralId);
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
      <main className="grid min-h-screen place-items-center bg-[#fafafa] dark:bg-[#1a1a1a]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      </main>
    );
  }

  if (notFound || !job) {
    return (
      <main className="min-h-screen bg-[#fafafa] dark:bg-[#1a1a1a]">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-slate-300 dark:text-zinc-600" />
          <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-zinc-100">Job not found</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">This position may have been filled or removed.</p>
          <Link
            href="/careers"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800"
          >
            <ArrowLeft size={16} /> Browse all openings
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#fafafa] dark:bg-[#1a1a1a]">
        <div className="mx-auto max-w-lg px-6 py-32 text-center">
          <CheckCircle className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-zinc-100">Application Submitted!</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
            Your application for <strong>{job.title}</strong> at <strong>{job.company.name}</strong> has been received.
            The team will review it and get back to you.
          </p>
          <Link
            href="/careers"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800"
          >
            <ArrowLeft size={16} /> Browse more jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#1a1a1a]">
      <header className="border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-[#000000]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">F</div>
            <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">FlowZen</span>
            <span className="hidden text-sm text-slate-400 dark:text-zinc-500 sm:inline">·</span>
            <span className="hidden text-sm text-slate-500 dark:text-zinc-400 sm:inline">Careers</span>
          </div>
          <Link href="/careers" className="text-sm font-medium text-slate-900 dark:text-zinc-100 hover:text-slate-700 dark:hover:text-zinc-300">
            <ArrowLeft size={16} className="inline mr-1.5" /> All jobs
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 pb-16 pt-10 sm:px-8">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            {job.company.icon ? (
              <img src={job.company.icon} alt="" className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400">
                <Building2 size={20} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">{job.title}</h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{job.company.name} · {job.department}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-slate-500 dark:text-zinc-400">
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
            <div className="mt-5 flex flex-wrap gap-2">
              {job.requiredSkills.map((skill) => (
                <span key={skill} className="rounded-full bg-slate-100 dark:bg-zinc-700 px-3 py-1 text-sm font-medium text-slate-600 dark:text-zinc-400">{skill}</span>
              ))}
            </div>
          )}

          {job.description && (
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{job.description}</div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Apply for this position</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Fields marked with <span className="text-rose-500">*</span> are required.
          </p>
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldInput label="First Name" value={firstName} onChange={setFirstName} required placeholder="John" />
              <FieldInput label="Last Name" value={lastName} onChange={setLastName} placeholder="Doe" />
            </div>
            <FieldInput label="Email" value={email} onChange={setEmail} type="email" required placeholder="you@email.com" />
            <FieldInput label="Phone" value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldInput label="Current Company" value={currentCompany} onChange={setCurrentCompany} placeholder="Acme Inc." />
              <FieldInput label="Years of Experience" value={experienceYears} onChange={setExperienceYears} type="number" min="0" placeholder="5" />
            </div>
            <FieldInput label="Notice Period (days)" value={noticePeriod} onChange={setNoticePeriod} type="number" min="0" placeholder="30" />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Cover Letter / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                placeholder="Tell us about yourself..."
              />
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-5">
              <p className="mb-3 text-sm font-medium text-slate-700 dark:text-zinc-300">Do you know anyone working at this company?</p>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                  <input
                    type="radio"
                    name="knowEmployee"
                    checked={knowEmployee === true}
                    onChange={() => setKnowEmployee(true)}
                    className="text-slate-900"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                  <input
                    type="radio"
                    name="knowEmployee"
                    checked={knowEmployee === false}
                    onChange={() => setKnowEmployee(false)}
                    className="text-slate-900"
                  />
                  No
                </label>
              </div>
              {knowEmployee && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Employee Referral ID</label>
                  <div className="relative">
                    <input
                      value={referralId}
                      onChange={(e) => setReferralId(e.target.value)}
                      placeholder="HELLO-COMPANY-41279814"
                      className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-4 py-3 pr-12 text-sm text-slate-900 dark:text-zinc-100 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    />
                    {referralStatus === "verifying" && (
                      <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                    )}
                    {referralStatus === "verified" && (
                      <CheckCircle size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                    )}
                  </div>
                  {referralStatus === "verified" && (
                    <p className="mt-2 text-xs text-emerald-600">
                      Verified: {referralName} ({referralCompanyName})
                    </p>
                  )}
                  {referralStatus === "error" && (
                    <p className="mt-2 text-xs text-rose-500">Referral employee not found. Please check the referral ID.</p>
                  )}
                  {referralStatus === "idle" && (
                    <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">Enter the referral ID provided by the employee.</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Resume / CV *</label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-3">
                  <Upload size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    required
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file && file.size > 2 * 1024 * 1024) {
                        setError("File exceeds 2 MB limit.");
                        e.target.value = "";
                        return;
                      }
                      setError("");
                      setResumeFile(file);
                    }}
                    className="w-full text-sm text-slate-500 dark:text-zinc-400 outline-none file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500">PDF, DOC, DOCX, PNG, or JPG — max 2 MB</p>
                {resumeFile && <p className="text-xs text-slate-600 dark:text-zinc-400">{resumeFile.name}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldInput
                label="Portfolio URL"
                value={portfolioUrl}
                onChange={setPortfolioUrl}
                placeholder="https://"
                icon={<ExternalLink size={14} />}
              />
              <FieldInput
                label="LinkedIn URL"
                value={linkedInUrl}
                onChange={setLinkedInUrl}
                placeholder="https://linkedin.com/in/"
                icon={<ExternalLink size={14} />}
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50"
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

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  icon,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</span>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          min={min}
          className={`w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 ${icon ? "pl-10" : ""}`}
        />
      </div>
    </label>
  );
}
