"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Clock,
  Briefcase,
  MapPin,
  DollarSign,
  User,
  Mail,
  CalendarDays,
  FileText,
  StickyNote,
  Video,
  ExternalLink,
  Loader2,
  ChevronDown,
  Upload,
  UserPlus,
  Send,
  FileCheck,
  FileX,
  ArrowRight,
  Banknote,
  CalendarClock,
  ShieldCheck,
  IdCard,
  Printer,
  Download,
} from "lucide-react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";
import { JobDescription } from "@/components/recruitment/job-description";
import { DEFAULT_ACCENT, hexToRgba, salarySuffix } from "@/lib/accent";

type CandidateData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stage: string;
  resumeUrl: string;
  job: {
    title: string;
    department: string;
    location: string;
    employmentType: string;
    salaryRangeMin: number;
    salaryRangeMax: number;
    salaryType?: string;
    currency: string;
    description: string;
    requiredSkills: string[];
  };
  company: { name: string; icon?: string; primaryColor?: string };
  createdAt: string;
};

type TimelineEntry = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type InterviewData = {
  id: string;
  roundType: string;
  scheduledAt: string;
  meetingLink: string;
  location?: string;
  status: string;
  interviewer: { id: string; name: string } | string;
};

type OfferData = {
  id: string;
  offeredCTC: number;
  pfAmount: number;
  esicAmount: number;
  joiningDate: string | null;
  designation: string;
  department: string;
  status: string;
  createdAt: string;
};

const STAGE_LABELS: Record<string, string> = {
  applied: "Application Submitted",
  screening: "Screening",
  "technical-interview": "Technical Interview",
  "manager-round": "Manager Round",
  "hr-round": "HR Round",
  offer: "Offer",
  joined: "Joined",
  rejected: "Not Selected",
};

const ACTION_LABELS: Record<string, string> = {
  applied: "Application Submitted",
  "resume-uploaded": "Resume Uploaded",
  "interview-scheduled": "Interview Scheduled",
  "interview-completed": "Interview Completed",
  "offer-generated": "Offer Generated",
  "offer-accepted": "Offer Accepted",
  "offer-rejected": "Offer Rejected",
  "stage-changed": "Stage Updated",
  joined: "Joined",
  rejected: "Not Selected",
  "note-added": "Note Added",
};

const STAGE_ORDER = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined"];

function TimelineAccordion({ timeline, accent }: { timeline: TimelineEntry[]; accent: string }) {
  const [openId, setOpenId] = useState<string | null>(timeline[0]?.id ?? null);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  if (timeline.length === 0) {
    return <p className="text-xs text-slate-400">No updates yet.</p>;
  }

  return (
    <div className="space-y-0">
      {timeline.map((entry, idx) => {
        const isOpen = openId === entry.id;
        const details = getTimelineDetails(entry);
        return (
          <div key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${details.iconBg}`}
                style={{ boxShadow: `0 0 0 3px ${hexToRgba(accent, 0.18)}` }}
              >
                {details.icon}
              </div>
              {idx < timeline.length - 1 && (
                <div className="mt-1 w-px flex-1" style={{ backgroundColor: hexToRgba(accent, 0.18) }} />
              )}
            </div>
            <div className={`flex-1 ${idx === timeline.length - 1 ? "" : "pb-4"}`}>
              <button
                onClick={() => toggle(entry.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-[var(--c-bg-muted)]"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{details.title}</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="mx-3 mt-1 mb-1 rounded-lg bg-[var(--c-bg-muted)] p-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                  {details.description && <p>{details.description}</p>}
                  {details.meta.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {details.meta.map((m, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                          {m.icon}
                          <span>{m.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTimelineDetails(entry: TimelineEntry): {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  meta: Array<{ icon: React.ReactNode; label: string }>;
} {
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const iconProps = { size: 13 };

  switch (entry.action) {
    case "applied":
      return {
        title: "Application Submitted",
        description: "Your application has been received and is under review.",
        icon: <UserPlus {...iconProps} />,
        iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
        meta: [
          ...(m.source ? [{ icon: <Briefcase size={11} />, label: `Source: ${m.source}` }] : []),
        ],
      };
    case "resume-uploaded":
      return {
        title: "Resume Uploaded",
        description: "Your resume has been uploaded successfully.",
        icon: <Upload {...iconProps} />,
        iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
        meta: [
          ...(m.fileName ? [{ icon: <FileText size={11} />, label: `File: ${m.fileName}` }] : []),
        ],
      };
    case "interview-scheduled":
      return {
        title: m.rescheduled ? "Interview Rescheduled" : "Interview Scheduled",
        description: m.rescheduled
          ? `Your ${String(m.roundType || "interview")} round has been rescheduled.`
          : `A ${String(m.roundType || "interview")} round has been scheduled for you.`,
        icon: <CalendarDays {...iconProps} />,
        iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
        meta: [
          ...(m.roundType ? [{ icon: <Briefcase size={11} />, label: `Round: ${String(m.roundType)} round` }] : []),
          ...(m.scheduledAt ? [{ icon: <Clock size={11} />, label: `Date: ${new Date(String(m.scheduledAt)).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` }] : []),
          ...(m.newDate ? [{ icon: <Clock size={11} />, label: `New date: ${new Date(String(m.newDate)).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` }] : []),
          ...(m.assignedTo ? [{ icon: <User size={11} />, label: `Interviewer: ${m.assignedTo}` }] : []),
        ],
      };
    case "interview-completed":
      return {
        title: "Interview Completed",
        description: m.recommendation
          ? `Interview completed. Recommendation: ${String(m.recommendation).replace(/-/g, " ")}.`
          : m.feedback
            ? `Feedback submitted for the ${String(m.roundType || "")} round.`
            : "Your interview has been completed and is being reviewed.",
        icon: <CheckCircle {...iconProps} />,
        iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
        meta: [
          ...(m.roundType ? [{ icon: <Briefcase size={11} />, label: `Round: ${String(m.roundType)}` }] : []),
          ...(m.recommendation ? [{ icon: <Send size={11} />, label: `Verdict: ${String(m.recommendation).replace(/-/g, " ")}` }] : []),
        ],
      };
    case "stage-changed":
      return {
        title: "Stage Updated",
        description: m.reason
          ? `${String(m.reason)}`
          : `Your application moved from ${formatStage(String(m.from || ""))} to ${formatStage(String(m.to || ""))}.`,
        icon: <ArrowRight {...iconProps} />,
        iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
        meta: [
          ...(m.from && m.to ? [{ icon: <ArrowRight size={11} />, label: `${formatStage(String(m.from))} → ${formatStage(String(m.to))}` }] : []),
        ],
      };
    case "offer-generated":
      return {
        title: "Offer Generated",
        description: "An offer has been prepared for you. Please review the details.",
        icon: <FileCheck {...iconProps} />,
        iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
        meta: [
          ...(m.offeredCTC ? [{ icon: <DollarSign size={11} />, label: `Offered CTC: ₹${Number(m.offeredCTC).toLocaleString()}/year` }] : []),
        ],
      };
    case "offer-accepted":
      return {
        title: "Offer Accepted",
        description: "You have accepted the offer. Welcome aboard!",
        icon: <CheckCircle {...iconProps} />,
        iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
        meta: [
          ...(m.offeredCTC ? [{ icon: <DollarSign size={11} />, label: `CTC: ₹${Number(m.offeredCTC).toLocaleString()}/year` }] : []),
        ],
      };
    case "offer-rejected":
      return {
        title: "Offer Declined",
        description: "You have declined the offer.",
        icon: <FileX {...iconProps} />,
        iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
        meta: [],
      };
    case "joined":
      return {
        title: "Joined",
        description: m.joinedDate
          ? `Welcome aboard! Your joining date is ${new Date(String(m.joinedDate)).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`
          : "You have been onboarded as an employee.",
        icon: <Briefcase {...iconProps} />,
        iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
        meta: [
          ...(m.joinedDate ? [{ icon: <CalendarDays size={11} />, label: `Joining: ${new Date(String(m.joinedDate)).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` }] : []),
          ...(m.employeeId ? [{ icon: <User size={11} />, label: `Employee ID: ${m.employeeId}` }] : []),
        ],
      };
    case "rejected":
      return {
        title: "Not Selected",
        description: "Unfortunately, your application was not selected at this time. We encourage you to apply for future openings.",
        icon: <XCircle {...iconProps} />,
        iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
        meta: [],
      };
    case "note-added":
      return {
        title: "Note Added",
        description: String(m.content || m.note || "A note was added to your application."),
        icon: <StickyNote {...iconProps} />,
        iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
        meta: [],
      };
    default:
      return {
        title: ACTION_LABELS[entry.action] || entry.action,
        description: "",
        icon: <Clock {...iconProps} />,
        iconBg: "bg-[var(--c-bg-muted)] text-slate-600 dark:text-zinc-400",
        meta: [],
      };
  }
}

function formatStage(stage: string): string {
  const labels: Record<string, string> = {
    applied: "Applied",
    screening: "Screening",
    "technical-interview": "Technical Interview",
    "manager-round": "Manager Round",
    "hr-round": "HR Round",
    offer: "Offer",
    joined: "Joined",
    rejected: "Rejected",
  };
  return labels[stage] || stage.replace(/-/g, " ");
}

function formatEmploymentType(type?: string | null): string {
  if (!type) return "Full-time";
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function CandidatePortalInner() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? null;

  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offerActionLoading, setOfferActionLoading] = useState(false);
  const [offerActionError, setOfferActionError] = useState("");
  const [confirmAction, setConfirmAction] = useState<"accept" | "reject" | null>(null);
  const [activePass, setActivePass] = useState<InterviewData | null>(null);

  useEffect(() => {
    if (!token) { setError("No access token provided."); setLoading(false); return; }
    fetch(`/api/public/candidate/me?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Invalid link."); }
        return r.json();
      })
      .then((data) => { setCandidate(data.candidate); setTimeline(data.timeline ?? []); setInterviews(data.interviews ?? []); setOffer(data.offer ?? null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleOfferAction(action: "accept" | "reject") {
    if (!token) return;
    setOfferActionLoading(true);
    setOfferActionError("");
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/public/candidate/me/offer?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setOffer(data.offer);
      if (action === "accept") {
        setCandidate((prev) => prev ? { ...prev, stage: "joined" } : prev);
      }
      const refreshRes = await fetch(`/api/public/candidate/me?token=${encodeURIComponent(token)}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setCandidate(refreshData.candidate);
        setTimeline(refreshData.timeline ?? []);
        setInterviews(refreshData.interviews ?? []);
      }
    } catch (e: any) {
      setOfferActionError(e.message);
    } finally {
      setOfferActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fafafa] dark:bg-[#1a1a1a]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </main>
    );
  }

  if (error || !candidate) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fafafa] dark:bg-[#1a1a1a] px-4">
        <div className="max-w-md text-center">
          <XCircle className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="mt-4 text-base font-bold text-slate-900 dark:text-zinc-100">Link Expired or Invalid</h1>
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">{error || "This link may have expired or is no longer valid."}</p>
        </div>
      </main>
    );
  }

  const accent = candidate.company?.primaryColor || DEFAULT_ACCENT;
  const accentSoft = hexToRgba(accent, 0.12);
  const accentSofter = hexToRgba(accent, 0.06);

  const stageIdx = STAGE_ORDER.indexOf(candidate.stage);
  const isRejected = candidate.stage === "rejected";
  const isJoined = candidate.stage === "joined";

  const stagePill =
    isRejected
      ? { label: "Not Selected", cls: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" }
      : isJoined
        ? { label: "Joined", cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" }
        : { label: STAGE_LABELS[candidate.stage] || formatStage(candidate.stage), cls: "accent-pill" };

  const companyInitials = candidate.company?.name
    ? candidate.company.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CO";

  const showSalary = candidate.job && (candidate.job.salaryRangeMin > 0 || candidate.job.salaryRangeMax > 0);

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#1a1a1a]">
      <style>{`.accent-pill { background-color: ${accentSoft}; color: ${accent}; }`}</style>
      <header className="sticky top-0 z-20 border-b border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)]/85 dark:bg-[#000000]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: accent }}>
              F
            </div>
            <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">FlowZen</span>
            <span className="hidden text-sm text-slate-400 dark:text-zinc-500 sm:inline">·</span>
            <span className="hidden text-sm text-slate-500 dark:text-zinc-400 sm:inline">Candidate Portal</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${stagePill.cls}`}>
            {isRejected ? <XCircle size={13} /> : isJoined ? <CheckCircle size={13} /> : <Clock size={13} />}
            {stagePill.label}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8 sm:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* ---------- Main column ---------- */}
          <div className="min-w-0 space-y-6">
            {/* Hero */}
            <div className="overflow-hidden rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] shadow-sm">
              <div className="h-2.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${hexToRgba(accent, 0.6)})` }} />
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white"
                    style={{ backgroundColor: accent, boxShadow: `0 0 0 4px ${accentSoft}` }}
                  >
                    {candidate.firstName[0]}{candidate.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-2xl">
                      {candidate.firstName} {candidate.lastName}
                    </h1>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={13} /> {candidate.email}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} /> Applied{" "}
                        {new Date(candidate.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Application progress */}
            <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Application progress</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${stagePill.cls}`}>
                  {STAGE_LABELS[candidate.stage] || formatStage(candidate.stage)}
                </span>
              </div>

              {isRejected ? (
                <div className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                  <XCircle size={16} />
                  Unfortunately, your application was not selected at this time.
                </div>
              ) : isJoined ? (
                <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircle size={16} />
                  Welcome aboard! You have been onboarded as an employee.
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <div className="min-w-[560px]">
                    <div className="flex items-center gap-1">
                      {STAGE_ORDER.map((s, i) => (
                        <div key={s} className="flex flex-1 items-center gap-1">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                              i <= stageIdx
                                ? "text-white"
                                : "border border-[var(--c-border-light)] bg-[var(--c-bg-muted)] text-slate-400 dark:text-zinc-500"
                            }`}
                            style={i <= stageIdx ? { backgroundColor: i === stageIdx ? accent : accent } : undefined}
                          >
                            {i < stageIdx ? <CheckCircle size={13} /> : i + 1}
                          </div>
                          {i < STAGE_ORDER.length - 1 && (
                            <div
                              className="h-0.5 flex-1"
                              style={{ backgroundColor: i < stageIdx ? accent : "var(--c-bg-hover)" }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex px-0.5 text-[9px] font-medium text-slate-500 dark:text-zinc-400">
                      {STAGE_ORDER.map((s, i) => (
                        <span
                          key={s}
                          className={`text-center ${i <= stageIdx ? "opacity-100" : "opacity-60"}`}
                          style={{ width: `${100 / STAGE_ORDER.length}%` }}
                        >
                          {STAGE_LABELS[s]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Job profile */}
            {candidate.job && (
              <div className="overflow-hidden rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] shadow-sm">
                <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${hexToRgba(accent, 0.5)})` }} />
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: accent }}>
                        {candidate.job.department ? candidate.job.department : "Position"}
                      </p>
                      <h2 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100">{candidate.job.title}</h2>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: accentSofter, border: `1px solid ${hexToRgba(accent, 0.25)}`, color: accent }}
                    >
                      {formatEmploymentType(candidate.job.employmentType)}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {candidate.job.location && (
                      <FactTile accent={accent} icon={MapPin} label="Location" value={candidate.job.location} />
                    )}
                    <FactTile
                      accent={accent}
                      icon={Briefcase}
                      label="Employment type"
                      value={formatEmploymentType(candidate.job.employmentType)}
                    />
                    {showSalary ? (
                      <FactTile
                        accent={accent}
                        icon={Banknote}
                        label="Salary range"
                        value={`${CURRENCY_SYMBOLS[candidate.job.currency] || "₹"}${candidate.job.salaryRangeMin.toLocaleString()} - ${CURRENCY_SYMBOLS[candidate.job.currency] || "₹"}${candidate.job.salaryRangeMax.toLocaleString()} ${salarySuffix(candidate.job.salaryType)}`}
                      />
                    ) : (
                      <FactTile accent={accent} icon={ShieldCheck} label="Stage" value={formatStage(candidate.stage)} />
                    )}
                  </div>

                  {candidate.job.requiredSkills?.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {candidate.job.requiredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border px-3 py-1 text-xs font-medium"
                          style={{ backgroundColor: accentSofter, borderColor: hexToRgba(accent, 0.25), color: accent }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {candidate.job.description && (
                    <div className="mt-6">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">About the role</p>
                      <div className="mt-2">
                        <JobDescription content={candidate.job.description} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Offer letter */}
            {offer && offer.status !== "draft" && (
              <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Offer letter</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      offer.status === "sent" || offer.status === "accepted"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                    }`}
                  >
                    {offer.status}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <OfferTile accent={accent} label="Designation" value={offer.designation} />
                  <OfferTile accent={accent} label="Department" value={offer.department || "N/A"} />
                  <OfferTile accent={accent} label="Offered CTC" value={`₹${Number(offer.offeredCTC).toLocaleString()}/year`} />
                  {offer.joiningDate ? (
                    <OfferTile
                      accent={accent}
                      label="Joining date"
                      value={new Date(offer.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    />
                  ) : (
                    <div className="col-span-2 flex items-center gap-2 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-zinc-400" style={{ backgroundColor: accentSofter }}>
                      <CalendarClock size={14} /> Joining date will be shared with the offer details.
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={`/api/public/candidate/me/letter?token=${encodeURIComponent(token ?? "")}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: accent }}
                  >
                    <FileText size={14} /> View Offer Letter
                  </a>
                </div>

                {offer.status === "sent" && (
                  <div className="mt-6 border-t border-[var(--c-border-light)] pt-5">
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Do you accept this offer?</p>
                    <div className="mt-3 flex gap-3">
                      <button
                        onClick={() => setConfirmAction("accept")}
                        disabled={offerActionLoading}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {offerActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Accept Offer
                      </button>
                      <button
                        onClick={() => setConfirmAction("reject")}
                        disabled={offerActionLoading}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-transparent px-5 py-2.5 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {offer.status === "accepted" && (
                  <div className="mt-6 border-t border-[var(--c-border-light)] pt-5">
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <CheckCircle size={16} />
                      You have accepted this offer. Welcome aboard!
                    </div>
                  </div>
                )}

                {offer.status === "rejected" && (
                  <div className="mt-6 border-t border-[var(--c-border-light)] pt-5">
                    <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                      <XCircle size={16} />
                      You have declined this offer.
                    </div>
                  </div>
                )}

                {offerActionError && (
                  <p className="mt-3 text-xs text-rose-500">{offerActionError}</p>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Application timeline</h2>
              <div className="mt-4">
                <TimelineAccordion timeline={timeline} accent={accent} />
              </div>
            </div>
          </div>

          {/* ---------- Sticky sidebar ---------- */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-6">
              {/* Company */}
              <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  {candidate.company?.icon ? (
                    <img src={candidate.company.icon} alt="" className="h-11 w-11 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: accent }}>
                      {companyInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {candidate.company?.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Hiring on FlowZen</p>
                  </div>
                </div>
                <ul className="mt-5 space-y-3 border-t border-[var(--c-border-light)] pt-5 text-xs text-slate-500 dark:text-zinc-400">
                  <li className="flex items-center gap-2">
                    <Mail size={14} style={{ color: accent }} /> {candidate.email}
                  </li>
                  <li className="flex items-center gap-2">
                    <CalendarDays size={14} style={{ color: accent }} /> Applied{" "}
                    {new Date(candidate.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </li>
                  <li className="flex items-center gap-2">
                    <User size={14} style={{ color: accent }} /> Stage:{" "}
                    {STAGE_LABELS[candidate.stage] || formatStage(candidate.stage)}
                  </li>
                </ul>
              </div>

              {/* Upcoming interviews */}
              {interviews.length > 0 && (
                <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-zinc-100">
                    <Video size={15} style={{ color: accent }} /> Upcoming interviews
                  </h3>
                  <div className="mt-4 space-y-3">
                    {interviews.map((iv) => {
                      const interviewerName = typeof iv.interviewer === "object" ? iv.interviewer.name : "";
                      return (
                        <div
                          key={iv.id}
                          className="rounded-xl border border-[var(--c-border-light)] p-4"
                          style={{ backgroundColor: accentSofter }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                              style={{ backgroundColor: accentSoft, color: accent }}
                            >
                              {iv.roundType} Round
                            </span>
                            {interviewerName && (
                              <span className="truncate text-[11px] text-slate-500 dark:text-zinc-400">{interviewerName}</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                            <CalendarDays size={12} />
                            {new Date(iv.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(iv.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {iv.meetingLink && (
                            <a
                              href={iv.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
                              style={{ backgroundColor: accent }}
                            >
                              <Video size={13} /> Join Meeting <ExternalLink size={11} />
                            </a>
                          )}
                          {!iv.meetingLink && iv.location && (
                            <div className="mt-3">
                              <p className="text-xs text-slate-500">Location: {iv.location}</p>
                              <button
                                type="button"
                                onClick={() => setActivePass(iv)}
                                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
                                style={{ backgroundColor: accent, color: "#fff" }}
                              >
                                <IdCard size={13} /> Show ID Card
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {activePass && candidate && (
        <IdCardModal
          interview={activePass}
          candidate={candidate}
          accent={accent}
          companyInitials={companyInitials}
          onClose={() => setActivePass(null)}
        />
      )}

      {/* --- Confirmation Modal --- */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--c-border-light)] bg-[var(--c-bg-card)] p-5 shadow-xl dark:bg-[#0d0d0d]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              {confirmAction === "accept" ? "Accept Offer?" : "Decline Offer?"}
            </h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              {confirmAction === "accept"
                ? "Are you sure you want to accept this offer? This action cannot be undone."
                : "Are you sure you want to decline this offer? This action cannot be undone."}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={offerActionLoading}
                className="rounded-full border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-[var(--c-bg-muted)] disabled:opacity-50 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleOfferAction(confirmAction)}
                disabled={offerActionLoading}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: confirmAction === "accept" ? "#059669" : "#e11d48" }}
              >
                {offerActionLoading && <Loader2 size={12} className="animate-spin" />}
                {confirmAction === "accept" ? "Yes, Accept" : "Yes, Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function FactTile({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: string;
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 p-3.5" style={{ backgroundColor: hexToRgba(accent, 0.06) }}>
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: accent }} />
        <span className="text-[11px] text-slate-400 dark:text-zinc-500">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-zinc-200">{value}</p>
    </div>
  );
}

function OfferTile({ accent, label, value }: { accent: string; label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: hexToRgba(accent, 0.06), border: "1px solid var(--c-border-light)" }}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500" style={label === "Offered CTC" ? { color: accent } : {}}>
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

export default function CandidatePortalPage() {
  return (
    <Suspense fallback={
      <main className="grid min-h-screen place-items-center bg-[#fafafa] dark:bg-[#1a1a1a]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </main>
    }>
      <CandidatePortalInner />
    </Suspense>
  );
}

function IdCardModal({
  interview,
  candidate,
  accent,
  companyInitials,
  onClose,
}: {
  interview: InterviewData;
  candidate: CandidateData;
  accent: string;
  companyInitials: string;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const qrContent = String((interview as any).passCode || `FLOWZ-${String(interview.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "PASS"}`);
  const passId = String((interview as any).passCode || `FLOWZ-${String(interview.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "PASS"}`);
  const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim();

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrContent, { width: 220, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (active) setQrDataUrl(url); })
      .catch(() => { if (active) setQrDataUrl(""); });
    return () => { active = false; };
  }, [qrContent]);

  async function exportPdf() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`flowzen-pass-${candidateName.replace(/\s+/g, "-").toLowerCase() || "guest"}.pdf`);
    } catch {
      // ignore download errors
    } finally {
      setBusy(false);
    }
  }

  async function printPdf() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.output("dataurlnewwindow");
    } catch {
      // ignore print errors
    } finally {
      setBusy(false);
    }
  }

  const dateStr = new Date(interview.scheduledAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  const timeStr = new Date(interview.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const interviewerName = typeof interview.interviewer === "object" ? interview.interviewer.name : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div
          ref={cardRef}
          className="overflow-hidden rounded-2xl border border-black/10 bg-white text-slate-900 shadow-2xl"
          style={{ fontFamily: "inherit" }}
        >
          <div className="px-5 py-4 text-white" style={{ backgroundColor: accent }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-bold">
                  {companyInitials}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/70">FlowZen</p>
                  <p className="text-sm font-bold leading-tight">{candidate.company?.name || "Company"}</p>
                </div>
              </div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">Guest Pass</span>
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Candidate</p>
                <p className="text-lg font-bold leading-tight">{candidateName}</p>
                <p className="text-sm font-medium" style={{ color: accent }}>{candidate.job?.title || "Position"}</p>
                <p className="text-xs text-slate-400">{candidate.email}</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: accent }}>
                {candidate.firstName[0]}{candidate.lastName[0]}
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="flex items-center gap-2">
                <Video size={14} style={{ color: accent }} />
                <span className="text-slate-500">Round:</span>
                <span className="font-semibold capitalize">{interview.roundType}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays size={14} style={{ color: accent }} />
                <span className="text-slate-500">{dateStr} · {timeStr}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} style={{ color: accent }} />
                <span className="text-slate-500">{interview.location}</span>
              </div>
              {interviewerName && (
                <div className="flex items-center gap-2">
                  <User size={14} style={{ color: accent }} />
                  <span className="text-slate-500">Contact: <span className="font-medium text-slate-700">{interviewerName}</span></span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-dashed border-slate-200 pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Pass ID</p>
                <p className="text-sm font-bold" style={{ color: accent }}>{passId}</p>
                <p className="mt-2 text-[10px] leading-snug text-slate-400">
                  Ask security to scan the QR code to verify this pass at the reception.
                </p>
              </div>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Verification QR" className="h-24 w-24 rounded-lg border border-slate-100 bg-white p-1" />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-lg bg-slate-100 text-[10px] text-slate-400">QR</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={printPdf}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            <Printer size={13} /> {busy ? "Preparing…" : "Print"}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <Download size={13} /> Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}