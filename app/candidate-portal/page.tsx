"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Clock, Briefcase, Building2, MapPin, DollarSign, User, Mail, CalendarDays, FileText, StickyNote, Video, ExternalLink } from "lucide-react";
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

function CandidatePortalInner() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? null;

  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("No access token provided."); setLoading(false); return; }
    fetch(`/api/public/candidate/me?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Invalid link."); }
        return r.json();
      })
      .then((data) => { setCandidate(data.candidate); setTimeline(data.timeline ?? []); setInterviews(data.interviews ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </main>
    );
  }

  if (error || !candidate) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4">
        <div className="max-w-md text-center">
          <XCircle className="mx-auto h-12 w-12 text-rose-400" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Link Expired or Invalid</h1>
          <p className="mt-2 text-sm text-slate-500">{error || "This link may have expired or is no longer valid."}</p>
        </div>
      </main>
    );
  }

  const stageIdx = STAGE_ORDER.indexOf(candidate.stage);
  const isRejected = candidate.stage === "rejected";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">

        {/* --- Candidate Info --- */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-lg font-bold text-indigo-700">
              {candidate.firstName[0]}{candidate.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-slate-900">{candidate.firstName} {candidate.lastName}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={14} /> {candidate.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} /> Applied {new Date(candidate.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
          {candidate.company?.name && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
              <Building2 size={16} className="text-slate-400" />
              {candidate.company.name}
            </div>
          )}
        </div>

        {/* --- Job Profile --- */}
        {candidate.job && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{candidate.job.title}</h2>
                {candidate.job.department && (
                  <p className="mt-0.5 text-sm text-slate-500">{candidate.job.department}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                {candidate.job.employmentType}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {candidate.job.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} /> {candidate.job.location}
                </span>
              )}
              {(candidate.job.salaryRangeMin > 0 || candidate.job.salaryRangeMax > 0) && (
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign size={14} />
                  {CURRENCY_SYMBOLS[candidate.job.currency] || "₹"}{candidate.job.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[candidate.job.currency] || "₹"}{candidate.job.salaryRangeMax.toLocaleString()}
                </span>
              )}
            </div>

            {candidate.job.requiredSkills?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {candidate.job.requiredSkills.map((skill) => (
                  <span key={skill} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{skill}</span>
                ))}
              </div>
            )}

            {candidate.job.description && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <FileText size={13} /> Job Description
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{candidate.job.description}</p>
              </div>
            )}
          </div>
        )}

        {/* --- Upcoming Interviews --- */}
        {interviews.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="text-sm font-semibold text-slate-900">Upcoming Interviews</h3>
            <div className="mt-4 space-y-3">
              {interviews.map((iv) => {
                const interviewerName = typeof iv.interviewer === "object" ? iv.interviewer.name : "";
                return (
                  <div key={iv.id} className="rounded-lg border border-slate-100 bg-indigo-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium capitalize text-indigo-700">
                          {iv.roundType} Round
                        </span>
                        {interviewerName && (
                          <span className="text-xs text-slate-500">with {interviewerName}</span>
                        )}
                      </div>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {new Date(iv.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(iv.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {iv.meetingLink && (
                        <a href={iv.meetingLink} target="_blank" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                          <Video size={12} /> Join Meeting <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Current Status & Stage Progress --- */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Current Status</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              isRejected ? "bg-rose-50 text-rose-700" : candidate.stage === "joined" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              {STAGE_LABELS[candidate.stage] || candidate.stage}
            </span>
          </div>

          {!isRejected && candidate.stage !== "joined" && (
            <>
              <div className="mt-5">
                <div className="flex items-center gap-1">
                  {STAGE_ORDER.map((s, i) => (
                    <div key={s} className="flex items-center gap-1 flex-1">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i <= stageIdx ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"
                      }`}>
                        {i < stageIdx ? <CheckCircle size={14} /> : i + 1}
                      </div>
                      {i < STAGE_ORDER.length - 1 && (
                        <div className={`h-0.5 flex-1 ${i < stageIdx ? "bg-indigo-600" : "bg-slate-200"}`} />
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

        {/* --- Timeline with Annotations --- */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="text-sm font-semibold text-slate-900">Application Timeline</h3>
          <div className="mt-4 space-y-0">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400">No updates yet.</p>
            ) : (
              timeline.map((entry, idx) => {
                const note = entry.action === "note-added" ? (entry.metadata?.note as string) : undefined;
                const comment = !note ? (entry.metadata?.comment as string) || (entry.metadata?.note as string) : undefined;
                const annotation = note || comment;
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        entry.action === "rejected" ? "bg-rose-100 text-rose-600" :
                        entry.action === "joined" || entry.action === "offer-accepted" ? "bg-emerald-100 text-emerald-600" :
                        "bg-indigo-100 text-indigo-600"
                      }`}>
                        {entry.action === "note-added" ? <StickyNote size={13} /> : <Clock size={13} />}
                      </div>
                      {idx < timeline.length - 1 && <div className="mt-1 w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className={`pb-6 ${idx === timeline.length - 1 ? "pb-0" : ""}`}>
                      <p className="text-sm font-medium text-slate-900">{ACTION_LABELS[entry.action] || entry.action}</p>
                      <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      {annotation && (
                        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                          {annotation}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </main>
  );
}

export default function CandidatePortalPage() {
  return (
    <Suspense fallback={
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </main>
    }>
      <CandidatePortalInner />
    </Suspense>
  );
}