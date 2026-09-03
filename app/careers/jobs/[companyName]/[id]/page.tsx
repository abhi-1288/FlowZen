"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  MapPin,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Upload,
  ExternalLink,
  Clock,
  Users,
  Banknote,
  ShieldCheck,
  CalendarClock,
} from "lucide-react";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";
import { formatJobDuration } from "@/lib/format-duration";
import { JobDescription } from "@/components/recruitment/job-description";
import { DEFAULT_ACCENT, salarySuffix, hexToRgba } from "@/lib/accent";

type JobDetail = {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  durationMonths: number | null;
  durationDays: number | null;
  durationHours: number | null;
  durationYears: number | null;
  requiredExperienceYears: number | null;
  salaryRangeMin: number;
  salaryRangeMax: number;
  salaryType: string;
  description: string;
  requiredSkills: string[];
  currency: string;
  autoCloseDate: string | null;
  openings?: number | null;
  company: { id: string; name: string; icon: string; primaryColor?: string };
};

function formatEmploymentType(type: string): string {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function JobDetailPage() {
  const params = useParams()!;
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
  const [internshipExperienceMonths, setInternshipExperienceMonths] = useState("");
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
    formData.set("internshipExperienceMonths", String(Number(internshipExperienceMonths) || 0));
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

  const accent = job?.company.primaryColor || DEFAULT_ACCENT;
  const accentStyle = { "--accent": accent } as CSSProperties;
  const accentSoft = hexToRgba(accent, 0.12);
  const accentSofter = hexToRgba(accent, 0.06);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fafafa] dark:bg-[#1a1a1a]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--c-border-light)] border-t-slate-900" />
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
            className="mt-8 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-all"
            style={{ backgroundColor: accent }}
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
          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
            Your application for <strong>{job.title}</strong> at <strong>{job.company.name}</strong> has been received.
            The team will review it and get back to you.
          </p>
          <Link
            href="/careers"
            className="mt-10 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-all"
            style={{ backgroundColor: accent }}
          >
            <ArrowLeft size={16} /> Browse more jobs
          </Link>
        </div>
      </main>
    );
  }

  const applyFields = [
    { icon: MapPin, label: "Location", value: job.location || "Remote / On-site" },
    { icon: Briefcase, label: "Type", value: formatEmploymentType(job.employmentType) },
    { icon: Clock, label: "Duration", value: formatJobDuration(job.durationMonths, job.durationDays, job.durationHours, job.durationYears) || "Not specified" },
    { icon: ShieldCheck, label: "Experience", value: job.requiredExperienceYears && job.requiredExperienceYears > 0 ? `${job.requiredExperienceYears}+ years` : "Not specified" },
    { icon: Users, label: "Openings", value: job.openings ? String(job.openings) : "1" },
    { icon: CalendarClock, label: "Closes", value: job.autoCloseDate ? `${new Date(job.autoCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ${new Date(job.autoCloseDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}` : "Rolling" },
  ].filter((f) => f.value !== null && f.value !== "" && f.value !== "Not specified");

  const scrollToApply = () => {
    document.getElementById("apply")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#1a1a1a]" style={accentStyle}>
      <header className="sticky top-0 z-20 border-b border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)]/85 dark:bg-[#000000]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: accent }}>
              F
            </div>
            <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">FlowZen</span>
            <span className="hidden text-sm text-slate-400 dark:text-zinc-500 sm:inline">·</span>
            <span className="hidden text-sm text-slate-500 dark:text-zinc-400 sm:inline">Careers</span>
          </div>
          <Link
            href="/careers"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 transition-all hover:shadow-sm"
          >
            <ArrowLeft size={15} /> All jobs
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8 sm:px-8 sm:pt-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* ---------- Main column ---------- */}
          <div className="min-w-0 space-y-6">
            {/* Hero */}
            <div className="overflow-hidden rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] shadow-sm">
              <div className="h-2.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${hexToRgba(accent, 0.6)})` }} />
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  {job.company.icon ? (
                    <img src={job.company.icon} alt="" className="h-12 w-12 rounded-xl object-cover" style={{ boxShadow: `0 0 0 4px ${accentSoft}` }} />
                  ) : (
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: accent }}
                    >
                      <Building2 size={22} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: accent }}>
                      {job.company.name}
                      {job.department ? ` · ${job.department}` : ""}
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-3xl">{job.title}</h1>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-zinc-400">
                  {job.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={15} /> {job.location}
                    </span>
                  )}
                  {job.autoCloseDate && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock size={15} /> Applications close{" "}
                      {new Date(job.autoCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} {new Date(job.autoCloseDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    </span>
                  )}
                </div>

                {job.salaryRangeMin > 0 && (
                  <div
                    className="mt-5 inline-flex items-center gap-2.5 rounded-xl px-4 py-3"
                    style={{ backgroundColor: accentSoft }}
                  >
                    <Banknote size={18} style={{ color: accent }} />
                    <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                      {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[job.currency] || "₹"}{job.salaryRangeMax.toLocaleString()}
                      <span className="ml-1 text-sm font-medium" style={{ color: accent }}>{salarySuffix(job.salaryType)}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Key facts */}
            <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Job highlights</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {applyFields.map((f) => (
                  <div key={f.label} className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 p-3.5" style={{ backgroundColor: accentSofter }}>
                    <div className="flex items-center gap-2">
                      <f.icon size={15} style={{ color: accent }} />
                      <span className="text-xs text-slate-400 dark:text-zinc-500">{f.label}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-zinc-200">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* About the role */}
            <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">About the role</h2>
              <div className="mt-3">
                <JobDescription content={job.description} />
              </div>
            </div>

            {/* Skills */}
            {job.requiredSkills.length > 0 && (
              <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Skills &amp; requirements</h2>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {job.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border px-3.5 py-1.5 text-sm font-medium"
                      style={{ backgroundColor: accentSofter, borderColor: hexToRgba(accent, 0.25), color: accent }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Application form */}
            <div id="apply" className="scroll-mt-24 rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Apply for this position</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    Fields marked with <span className="text-rose-500">*</span> are required.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: accentSoft, color: accent }}>
                  <Clock size={13} /> ~2 min
                </span>
              </div>

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
                {job.employmentType === "internship" && (
                  <FieldInput label="Experience in Internship (months)" value={internshipExperienceMonths} onChange={setInternshipExperienceMonths} type="number" min="0" placeholder="6" />
                )}
                <FieldInput label="Notice Period (days)" value={noticePeriod} onChange={setNoticePeriod} type="number" min="0" placeholder="30" />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Cover Letter / Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="neu-inset w-full resize-y rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 p-5">
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
                          className="neu-inset w-full rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 dark:bg-[#000000] px-4 py-3 pr-12 text-sm text-slate-900 dark:text-zinc-100 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500"
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
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 px-4 py-3">
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
                        className="w-full cursor-pointer text-sm text-slate-500 dark:text-zinc-400 outline-none file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-white file:shadow-sm file:transition-all hover:file:opacity-90"
                      />
                      <style>{`input[type="file"]::file-selector-button { background-color: ${accent}; }`}</style>
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
                  className="flex w-full items-center justify-center gap-2.5 rounded-full px-5 py-3 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </form>
            </div>
          </div>

          {/* ---------- Sticky sidebar ---------- */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm">
              <div className="flex items-center gap-3">
                {job.company.icon ? (
                  <img src={job.company.icon} alt="" className="h-11 w-11 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: accent }}>
                    <Building2 size={20} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{job.company.name}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Careers on FlowZen</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t border-[var(--c-border-light)] dark:border-zinc-800 pt-5">
                <SideRow accent={accent} icon={Briefcase} label="Position" value={job.title} />
                {job.department && <SideRow accent={accent} icon={Building2} label="Department" value={job.department} />}
                <SideRow accent={accent} icon={Users} label="Openings" value={job.openings ? String(job.openings) : "1"} />
                {job.salaryRangeMin > 0 && (
                  <SideRow
                    accent={accent}
                    icon={Banknote}
                    label="Salary range"
                    highlight
                    value={`${CURRENCY_SYMBOLS[job.currency] || "₹"}${job.salaryRangeMin.toLocaleString()} - ${CURRENCY_SYMBOLS[job.currency] || "₹"}${job.salaryRangeMax.toLocaleString()} ${salarySuffix(job.salaryType)}`}
                  />
                )}
              </div>

              <button
                onClick={scrollToApply}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Apply for this position
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SideRow({
  accent,
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  accent: string;
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: hexToRgba(accent, 0.1) }}>
        <Icon size={15} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-zinc-500">{label}</p>
        <p className={`truncate text-sm ${highlight ? "font-semibold text-slate-900 dark:text-zinc-100" : "text-slate-700 dark:text-zinc-300"}`}>
          {value}
        </p>
      </div>
    </div>
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
          className={`neu-inset w-full rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500 ${icon ? "pl-10" : ""}`}
        />
      </div>
    </label>
  );
}
