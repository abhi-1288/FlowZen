"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Clock, Briefcase, Building2, MapPin, DollarSign, User, Mail, CalendarDays, FileText, StickyNote, Video, ExternalLink, Loader2, ChevronDown, Upload, UserPlus, Send, FileCheck, FileX, ArrowRight } from "lucide-react";
import { CURRENCY_SYMBOLS } from "@/lib/recruitment-types";

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
    currency: string;
    description: string;
    requiredSkills: string[];
  };
  company: { name: string };
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

function TimelineAccordion({ timeline }: { timeline: TimelineEntry[] }) {
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
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ details.iconBg }`}>
                {details.icon}
              </div>
              {idx < timeline.length - 1 && <div className="mt-1 w-px flex-1 bg-[var(--c-bg-hover)]" />}
            </div>
            <div className={`flex-1 ${idx === timeline.length - 1 ? "" : "pb-4"}`}>
              <button
                onClick={() => toggle(entry.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-[var(--c-bg-muted)]"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900">{details.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="mx-3 mt-1 mb-1 rounded-lg bg-[var(--c-bg-muted)] p-3 text-xs leading-relaxed text-slate-600">
                  {details.description && <p>{details.description}</p>}
                  {details.meta.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {details.meta.map((m, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-500">
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
        iconBg: "bg-blue-100 text-blue-600",
        meta: [
          ...(m.source ? [{ icon: <Briefcase size={11} />, label: `Source: ${m.source}` }] : []),
        ],
      };
    case "resume-uploaded":
      return {
        title: "Resume Uploaded",
        description: "Your resume has been uploaded successfully.",
        icon: <Upload {...iconProps} />,
        iconBg: "bg-sky-100 text-sky-600",
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
        iconBg: "bg-indigo-100 text-indigo-600",
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
        iconBg: "bg-emerald-100 text-emerald-600",
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
        iconBg: "bg-violet-100 text-violet-600",
        meta: [
          ...(m.from && m.to ? [{ icon: <ArrowRight size={11} />, label: `${formatStage(String(m.from))} → ${formatStage(String(m.to))}` }] : []),
        ],
      };
    case "offer-generated":
      return {
        title: "Offer Generated",
        description: "An offer has been prepared for you. Please review the details.",
        icon: <FileCheck {...iconProps} />,
        iconBg: "bg-teal-100 text-teal-600",
        meta: [
          ...(m.offeredCTC ? [{ icon: <DollarSign size={11} />, label: `Offered CTC: ₹${Number(m.offeredCTC).toLocaleString()}/year` }] : []),
        ],
      };
    case "offer-accepted":
      return {
        title: "Offer Accepted",
        description: "You have accepted the offer. Welcome aboard!",
        icon: <CheckCircle {...iconProps} />,
        iconBg: "bg-emerald-100 text-emerald-600",
        meta: [
          ...(m.offeredCTC ? [{ icon: <DollarSign size={11} />, label: `CTC: ₹${Number(m.offeredCTC).toLocaleString()}/year` }] : []),
        ],
      };
    case "offer-rejected":
      return {
        title: "Offer Declined",
        description: "You have declined the offer.",
        icon: <FileX {...iconProps} />,
        iconBg: "bg-rose-100 text-rose-600",
        meta: [],
      };
    case "joined":
      return {
        title: "Joined",
        description: m.joinedDate
          ? `Welcome aboard! Your joining date is ${new Date(String(m.joinedDate)).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`
          : "You have been onboarded as an employee.",
        icon: <Briefcase {...iconProps} />,
        iconBg: "bg-emerald-100 text-emerald-600",
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
        iconBg: "bg-rose-100 text-rose-600",
        meta: [],
      };
    case "note-added":
      return {
        title: "Note Added",
        description: String(m.content || m.note || "A note was added to your application."),
        icon: <StickyNote {...iconProps} />,
        iconBg: "bg-amber-100 text-amber-600",
        meta: [],
      };
    default:
      return {
        title: ACTION_LABELS[entry.action] || entry.action,
        description: "",
        icon: <Clock {...iconProps} />,
        iconBg: "bg-[var(--c-bg-muted)] text-slate-600",
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
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

  const stageIdx = STAGE_ORDER.indexOf(candidate.stage);
  const isRejected = candidate.stage === "rejected";

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#1a1a1a]">
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-5">

        {/* --- Candidate Info --- */}
        <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--c-bg-muted)] dark:bg-zinc-700 text-sm font-bold text-slate-700 dark:text-zinc-300">
              {candidate.firstName[0]}{candidate.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-slate-900 dark:text-zinc-100">{candidate.firstName} {candidate.lastName}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} /> {candidate.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={13} /> Applied {new Date(candidate.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
          {candidate.company?.name && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--c-bg-muted)] dark:bg-zinc-700 px-4 py-2.5 text-xs text-slate-600 dark:text-zinc-400">
              <Building2 size={14} className="text-slate-400 dark:text-zinc-500" />
              {candidate.company.name}
            </div>
          )}
        </div>

        {/* --- Job Profile --- */}
        {candidate.job && (
          <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{candidate.job.title}</h2>
                {candidate.job.department && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{candidate.job.department}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-[var(--c-bg-muted)] dark:bg-zinc-700 px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                {candidate.job.employmentType}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-zinc-400">
              {candidate.job.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} /> {candidate.job.location}
                </span>
              )}
              {(candidate.job.salaryRangeMin > 0 || candidate.job.salaryRangeMax > 0) && (
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign size={13} />
                  {CURRENCY_SYMBOLS[candidate.job.currency] || "₹"}{candidate.job.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[candidate.job.currency] || "₹"}{candidate.job.salaryRangeMax.toLocaleString()}
                </span>
              )}
            </div>

            {candidate.job.requiredSkills?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {candidate.job.requiredSkills.map((skill) => (
                  <span key={skill} className="rounded-md bg-[var(--c-bg-muted)] dark:bg-zinc-700 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400">{skill}</span>
                ))}
              </div>
            )}

            {candidate.job.description && (
              <div className="mt-4 rounded-lg bg-[var(--c-bg-muted)] dark:bg-zinc-700 p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <FileText size={12} /> Job Description
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-zinc-400">{candidate.job.description}</p>
              </div>
            )}
          </div>
        )}

        {/* --- Upcoming Interviews --- */}
        {interviews.length > 0 && (
          <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-5 shadow-sm sm:p-6">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">Upcoming Interviews</h3>
            <div className="mt-4 space-y-3">
              {interviews.map((iv) => {
                const interviewerName = typeof iv.interviewer === "object" ? iv.interviewer.name : "";
                return (
                  <div key={iv.id} className="rounded-lg border border-[var(--c-border-light)] dark:border-zinc-800/50 bg-[var(--c-bg-muted)] dark:bg-zinc-700 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[var(--c-bg-hover)] px-2.5 py-0.5 text-[11px] font-medium capitalize text-slate-700">
                          {iv.roundType} Round
                        </span>
                        {interviewerName && (
                          <span className="text-[11px] text-slate-500">with {interviewerName}</span>
                        )}
                      </div>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {new Date(iv.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(iv.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {iv.meetingLink && (
                        <a href={iv.meetingLink} target="_blank" className="inline-flex items-center gap-1 text-slate-900 hover:underline">
                          <Video size={11} /> Join Meeting <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Offer Letter --- */}
        {offer && offer.status !== "draft" && (
          <div className="rounded-xl neu-card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900">Offer Letter</h3>
              <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${ offer.status === "sent" || offer.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700" }`}>{offer.status}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg neu-inset p-3">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Designation</p>
                <p className="mt-1 text-xs font-medium text-slate-900">{offer.designation}</p>
              </div>
              <div className="rounded-lg neu-inset p-3">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Department</p>
                <p className="mt-1 text-xs font-medium text-slate-900">{offer.department || "N/A"}</p>
              </div>
              <div className="rounded-lg neu-inset p-3">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Offered CTC</p>
                <p className="mt-1 text-xs font-medium text-slate-900">₹{Number(offer.offeredCTC).toLocaleString()}/year</p>
              </div>
              {offer.joiningDate && (
                <div className="rounded-lg neu-inset p-3">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Joining Date</p>
                  <p className="mt-1 text-xs font-medium text-slate-900">{new Date(offer.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <a
                href={`/api/public/candidate/me/letter?token=${encodeURIComponent(token ?? "")}`}
                target="_blank"
                className="neu-btn neu-btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all"
              >
                <FileText size={14} /> View Offer Letter
              </a>
            </div>

            {offer.status === "sent" && (
              <div className="mt-5 border-t border-[var(--c-border-light)] pt-4">
                <p className="text-xs font-medium text-slate-700">Do you accept this offer?</p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => setConfirmAction("accept")}
                    disabled={offerActionLoading}
                    className="neu-btn neu-btn-success inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
                  >
                    {offerActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Accept Offer
                  </button>
                  <button
                    onClick={() => setConfirmAction("reject")}
                    disabled={offerActionLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-[var(--c-bg-card)] px-5 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
                {offerActionError && (
                  <p className="mt-2 text-[11px] text-rose-500">{offerActionError}</p>
                )}
              </div>
            )}

            {offer.status === "accepted" && (
              <div className="mt-5 border-t border-[var(--c-border-light)] pt-4">
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
                  <CheckCircle size={16} />
                  You have accepted this offer. Welcome aboard!
                </div>
              </div>
            )}

            {offer.status === "rejected" && (
              <div className="mt-5 border-t border-[var(--c-border-light)] pt-4">
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                  <XCircle size={16} />
                  You have declined this offer.
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Confirmation Modal --- */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay px-4">
            <div className="w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl">
              <h3 className="text-sm font-bold text-slate-900">
                {confirmAction === "accept" ? "Accept Offer?" : "Decline Offer?"}
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                {confirmAction === "accept"
                  ? "Are you sure you want to accept this offer? This action cannot be undone."
                  : "Are you sure you want to decline this offer? This action cannot be undone."}
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={offerActionLoading}
                  className="rounded-full neu-card px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleOfferAction(confirmAction)}
                  disabled={offerActionLoading}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium ${confirmAction === "accept" ? "neu-btn neu-btn-success" : "neu-btn neu-btn-danger"}`}
                >
                  {offerActionLoading && <Loader2 size={12} className="animate-spin" />}
                  {confirmAction === "accept" ? "Yes, Accept" : "Yes, Decline"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- Current Status & Stage Progress --- */}
        <div className="rounded-xl neu-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900">Current Status</h3>
            <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${ isRejected ? "bg-rose-50 text-rose-700" : candidate.stage === "joined" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" }`}>
              {STAGE_LABELS[candidate.stage] || candidate.stage}
            </span>
          </div>

          {!isRejected && candidate.stage !== "joined" && (
            <>
              <div className="mt-5">
                <div className="flex items-center gap-1">
                  {STAGE_ORDER.map((s, i) => (
                    <div key={s} className="flex items-center gap-1 flex-1">
                      <div className={`neu-btn neu-btn-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${ i <= stageIdx ? " " : "bg-slate-200 text-slate-400" }`}>
                        {i < stageIdx ? <CheckCircle size={12} /> : i + 1}
                      </div>
                      {i < STAGE_ORDER.length - 1 && (
                        <div className={`h-0.5 flex-1 ${i < stageIdx ? "bg-slate-900" : "bg-[var(--c-bg-hover)]"}`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between px-0.5 text-[10px] text-slate-400">
                  {STAGE_ORDER.map((s) => (
                    <span key={s} className="text-center" style={{ width: `${100 / STAGE_ORDER.length}%` }}>{STAGE_LABELS[s]}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* --- Timeline with Accordion --- */}
        <div className="rounded-xl neu-card p-5 sm:p-6">
          <h3 className="text-xs font-semibold text-slate-900">Application Timeline</h3>
          <div className="mt-4">
            <TimelineAccordion timeline={timeline} />
          </div>
        </div>

      </div>
    </main>
  );
}

export default function CandidatePortalPage() {
  return (
    <Suspense fallback={
      <main className="grid min-h-screen place-items-center bg-[#fafafa]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </main>
    }>
      <CandidatePortalInner />
    </Suspense>
  );
}
