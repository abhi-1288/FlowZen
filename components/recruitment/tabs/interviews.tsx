"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Briefcase, ChevronDown, ChevronUp, ChevronRight, Clock, Users } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { interviewSlug } from "@/lib/interview-slug";
import type { ATSInterview } from "@/lib/recruitment-types";

const ROUND_LABEL: Record<string, string> = {
  screening: "Screening",
  technical: "Technical",
  manager: "Manager",
  hr: "HR",
  admin: "Admin",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getDateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateLabel(iso: string) {
  return formatDate(new Date(iso));
}

function getStatusClasses(status: string) {
  switch (status) {
    case "completed": return "bg-emerald-50 text-emerald-700";
    case "cancelled": return "bg-rose-50 text-rose-700";
    case "in-progress": return "bg-amber-50 text-amber-700";
    case "scheduled": return "bg-slate-100 text-slate-700";
    case "rescheduled": return "bg-zinc-100 text-zinc-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "in-progress": return "In Progress";
    case "scheduled": return "Scheduled";
    case "rescheduled": return "Rescheduled";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function candidateName(iv: ATSInterview) {
  if (iv.candidate && typeof iv.candidate === "object") {
    return `${(iv.candidate as any).firstName} ${(iv.candidate as any).lastName}`.trim();
  }
  return "Unknown";
}

function interviewerName(iv: ATSInterview) {
  if (iv.interviewer && typeof iv.interviewer === "object") return (iv.interviewer as any).name;
  return "";
}

function jobTitle(iv: ATSInterview) {
  if (iv.job && typeof iv.job === "object") return (iv.job as any).title;
  return "";
}

function jobKey(iv: ATSInterview) {
  if (iv.job && typeof iv.job === "object") return (iv.job as any).id as string;
  if (typeof iv.job === "string") return iv.job;
  return "_none";
}

function interviewDetailHref(iv: ATSInterview) {
  const job = interviewSlug(jobTitle(iv) || "interview");
  const candidate = interviewSlug(candidateName(iv) || "candidate");
  return `/recruitment/interview/${job}/${candidate}?interview=${encodeURIComponent(iv.id)}`;
}

type Grouped = {
  jobTitle: string;
  jobId: string;
  dates: {
    dateKey: string;
    dateLabel: string;
    interviews: ATSInterview[];
  }[];
};

function groupInterviews(list: ATSInterview[]): Grouped[] {
  const jobMap = new Map<string, { title: string; interviews: ATSInterview[] }>();
  for (const iv of list) {
    const jk = jobKey(iv);
    if (!jobMap.has(jk)) jobMap.set(jk, { title: jobTitle(iv) || "General", interviews: [] });
    jobMap.get(jk)!.interviews.push(iv);
  }

  const result: Grouped[] = [];
  for (const [jId, { title, interviews: jIvs }] of jobMap) {
    const dateMap = new Map<string, ATSInterview[]>();
    for (const iv of jIvs) {
      const dk = getDateKey(iv.scheduledAt);
      if (!dateMap.has(dk)) dateMap.set(dk, []);
      dateMap.get(dk)!.push(iv);
    }

    const dates = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dk, dIvs]) => ({
        dateKey: dk,
        dateLabel: dIvs.length > 0 ? getDateLabel(dIvs[0].scheduledAt) : dk,
        interviews: dIvs.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
      }));

    result.push({ jobTitle: title, jobId: jId, dates });
  }

  return result;
}

function Accordion({ header, count, children, defaultOpen = false }: {
  header: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        suppressHydrationWarning
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {header}
          {count !== undefined && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{count}</span>
          )}
        </span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

function TimeSlotRow({ iv, locked, href }: {
  iv: ATSInterview;
  locked: boolean;
  href: string;
}) {
  const time = formatTime(new Date(iv.scheduledAt));
  const name = candidateName(iv);
  const round = ROUND_LABEL[iv.roundType] || iv.roundType;
  const interviewer = interviewerName(iv);

  return (
    <Link
      suppressHydrationWarning
      href={href}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 w-16 shrink-0">{time}</span>
          <span className="text-sm font-medium text-slate-900 truncate">{name}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize">{round}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusClasses(iv.status)}`}>
            {getStatusLabel(iv.status)}
          </span>
        </div>
        {interviewer && (
          <div className="ml-[4.5rem] mt-0.5 text-xs text-slate-500">{interviewer}</div>
        )}
        {locked && (
          <div className="ml-[4.5rem] mt-0.5 text-xs text-amber-600">Waiting for previous candidate to finish</div>
        )}
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </Link>
  );
}

function formatFullDate(iso: string) {
  return `${formatDate(new Date(iso))} · ${formatTime(new Date(iso))}`;
}

function CandidateInfoRow({ iv, href }: { iv: ATSInterview; href: string }) {
  const name = candidateName(iv);
  const round = ROUND_LABEL[iv.roundType] || iv.roundType;
  const interviewer = interviewerName(iv);
  const cand = iv.candidate && typeof iv.candidate === "object" ? (iv.candidate as any) : null;
  const interviewerRole = iv.interviewer && typeof iv.interviewer === "object" ? (iv.interviewer as any).role : "";

  const dateNote =
    iv.status === "cancelled"
      ? "Cancelled"
      : iv.status === "rescheduled"
        ? `Rescheduled to ${formatFullDate(iv.scheduledAt)}`
        : iv.status === "completed"
          ? `Completed on ${formatFullDate(iv.scheduledAt)}`
          : iv.status === "in-progress"
            ? `In progress · ${formatFullDate(iv.scheduledAt)}`
            : `Interview on ${formatFullDate(iv.scheduledAt)}`;

  return (
    <Link href={href} className="block px-4 py-3 transition hover:bg-slate-50">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-900">{name}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize">{round}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusClasses(iv.status)}`}>
          {getStatusLabel(iv.status)}
        </span>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-slate-500">
        {cand && (
          <div className="truncate">
            {cand.email || "—"}{cand.phone ? ` · ${cand.phone}` : ""}{cand.stage ? ` · ${cand.stage}` : ""}
          </div>
        )}
        <div>{interviewer ? `Interviewer: ${interviewer}${interviewerRole ? ` (${interviewerRole})` : ""}` : "Interviewer: —"}</div>
        <div className={iv.status === "cancelled" ? "text-rose-600" : iv.status === "rescheduled" ? "text-amber-600" : "text-slate-600"}>
          {dateNote}
        </div>
        {iv.location && <div>{iv.location}</div>}
      </div>
      {iv.status === "completed" && iv.feedback && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-1">Tech: {iv.feedback.technicalSkills}/5</span>
          <span className="rounded bg-slate-100 px-2 py-1">Comm: {iv.feedback.communication}/5</span>
          <span className="rounded bg-slate-100 px-2 py-1">Problem: {iv.feedback.problemSolving}/5</span>
          <span className="rounded bg-slate-100 px-2 py-1">Culture: {iv.feedback.cultureFit}/5</span>
          <span className={`rounded px-2 py-1 font-medium ${
            iv.feedback.overallRecommendation === "strong-hire" ? "bg-emerald-50 text-emerald-700" :
            iv.feedback.overallRecommendation === "hire" ? "bg-sky-50 text-sky-700" :
            iv.feedback.overallRecommendation === "hold" ? "bg-amber-50 text-amber-700" :
            "bg-rose-50 text-rose-700"
          }`}>{iv.feedback.overallRecommendation.replace("-", " ")}</span>
        </div>
      )}
    </Link>
  );
}

function GroupedView({ grouped }: {
  grouped: Grouped[];
}) {
  return (
    <div className="mt-4 space-y-4">
      {grouped.map((g) => (
        <Accordion
          key={g.jobId}
          header={
            <span className="flex items-center gap-2">
              <Briefcase size={14} className="text-slate-400" />
              {g.jobTitle}
            </span>
          }
          count={g.dates.reduce((s, d) => s + d.interviews.length, 0)}
          defaultOpen
        >
          {g.dates.map((dg) => {
            let locked = false;
            const rows = dg.interviews.map((iv) => {
              const isBlocked = locked;
              if (iv.status !== "completed" && iv.status !== "cancelled") {
                locked = true;
              }
              return (
                <TimeSlotRow
                  key={iv.id}
                  iv={iv}
                  locked={isBlocked}
                  href={interviewDetailHref(iv)}
                />
              );
            });

            return (
              <div key={dg.dateKey}>
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
                  <Calendar size={13} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-600">{dg.dateLabel}</span>
                  <span className="text-xs text-slate-400">({dg.interviews.length})</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {rows}
                </div>
              </div>
            );
          })}
        </Accordion>
      ))}
    </div>
  );
}

function CandidatesView({ grouped }: { grouped: Grouped[] }) {
  return (
    <div className="mt-4 space-y-4">
      {grouped.map((g) => (
        <Accordion
          key={g.jobId}
          header={
            <span className="flex items-center gap-2">
              <Briefcase size={14} className="text-slate-400" />
              {g.jobTitle}
            </span>
          }
          count={g.dates.reduce((s, d) => s + d.interviews.length, 0)}
          defaultOpen
        >
          {g.dates.map((dg) => (
            <div key={dg.dateKey}>
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-600">{dg.dateLabel}</span>
                <span className="text-xs text-slate-400">({dg.interviews.length})</span>
              </div>
              <div className="divide-y divide-slate-50">
                  {dg.interviews.map((iv) => (
                    <CandidateInfoRow key={iv.id} iv={iv} href={interviewDetailHref(iv)} />
                  ))}

              </div>
            </div>
          ))}
        </Accordion>
      ))}
    </div>
  );
}

export function InterviewsTab() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isFullAccess = role === "admin" || role === "human-resource";
  const userId = session?.user?.id;

  const { interviews, loading, totalInterviews, fetchInterviews } = useRecruitmentStore(
    useShallow((s) => ({ interviews: s.interviews, loading: s.loading, totalInterviews: s.totalInterviews, fetchInterviews: s.fetchInterviews }))
  );

  const [statusFilter, setStatusFilter] = useState("");
  const [adminTab, setAdminTab] = useState<"scheduled" | "candidates">("scheduled");

  const load = useCallback((status: string, tab: "scheduled" | "candidates") => {
    const params: Record<string, string> = { page: "1", limit: "1000" };
    if (status) params.status = status;
    if (!(isFullAccess && tab === "candidates") && userId) params.interviewer = userId;
    void fetchInterviews(params);
  }, [fetchInterviews, isFullAccess, userId]);

  useEffect(() => {
    if (userId !== undefined) load(statusFilter, adminTab);
  }, [statusFilter, adminTab, userId, load]);

  const grouped = useMemo(() => groupInterviews(interviews), [interviews]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Interviews</h1>
          <p className="mt-1 text-sm text-slate-500">{totalInterviews} total</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <select
          suppressHydrationWarning
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rescheduled">Rescheduled</option>
        </select>
      </div>

      {isFullAccess && (
        <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
          <button
            suppressHydrationWarning
            onClick={() => setAdminTab("scheduled")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              adminTab === "scheduled" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              Scheduled Interviews
            </span>
          </button>
          <button
            suppressHydrationWarning
            onClick={() => setAdminTab("candidates")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              adminTab === "candidates" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              Candidates
            </span>
          </button>
        </div>
      )}

      {loading && interviews.length === 0 ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : interviews.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">No interviews found.</div>
      ) : isFullAccess && adminTab === "candidates" ? (
        <CandidatesView grouped={grouped} />
      ) : (
        <GroupedView grouped={grouped} />
      )}
    </div>
  );
}
