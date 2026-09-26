"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Calendar,
  CalendarCheck,
  CheckCircle,
  Clock,
  FileText,
  PieChart,
  RefreshCw,
  Send,
  TrendingUp,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { STAGE_LABELS } from "@/lib/recruitment-types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ROUND_LABELS: Record<string, string> = {
  screening: "Screening",
  technical: "Technical",
  manager: "Manager",
  hr: "HR",
  admin: "Admin",
};

const ACTION_LABELS: Record<string, string> = {
  applied: "Applied for a position",
  "resume-uploaded": "Uploaded a resume",
  "interview-scheduled": "Scheduled an interview",
  "interview-completed": "Completed an interview",
  "offer-generated": "Generated an offer",
  "offer-accepted": "Accepted an offer",
  "offer-rejected": "Declined an offer",
  "offer-recalled": "Recalled an offer",
  "stage-changed": "Moved to a new stage",
  joined: "Joined the company",
  rejected: "Rejected the candidate",
  "note-added": "Added a note",
};

const ACTION_ICONS: Record<string, LucideIcon> = {
  applied: UserPlus,
  "resume-uploaded": FileText,
  "interview-scheduled": Calendar,
  "interview-completed": CheckCircle,
  "offer-generated": Send,
  "offer-accepted": CheckCircle,
  "offer-rejected": XCircle,
  "offer-recalled": Undo2,
  "stage-changed": ArrowRight,
  joined: UserCheck,
  rejected: XCircle,
  "note-added": FileText,
};

type MetricCardData = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  iconClass: string;
  href: string;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function relativeTime(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatInterviewDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

function actionTone(action: string) {
  if (action === "offer-accepted" || action === "joined") {
    return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300";
  }
  if (action === "offer-rejected" || action === "rejected") {
    return "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300";
  }
  if (action === "interview-scheduled" || action === "stage-changed") {
    return "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300";
  }
  if (action === "interview-completed" || action === "offer-recalled") {
    return "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300";
  }
  return "bg-muted text-sec";
}

function Panel({
  title,
  description,
  count,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-lt bg-card p-5 shadow-card-v ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-base">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-sec">{description}</p> : null}
        </div>
        {count !== undefined ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-sec">{count}</span>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-lt bg-muted/50 px-4 py-7 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-elevated text-sec shadow-card-v">
        <Icon size={17} />
      </span>
      <p className="mt-3 text-sm font-medium text-base">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-sec">{description}</p>
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  return (
    <Link
      href={metric.href}
      className="group rounded-2xl border border-lt bg-card p-4 shadow-card-v transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-soft dark:hover:border-indigo-800"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${metric.iconClass}`}>
          <metric.icon size={17} />
        </span>
        <ArrowRight size={15} className="text-dim transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-base">{metric.value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-xs font-medium text-sec">{metric.label}</p>
      <p className="mt-2 truncate text-[11px] text-dim">{metric.detail}</p>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-3 w-32 rounded bg-[var(--c-skeleton)]" />
          <div className="h-8 w-64 max-w-full rounded bg-[var(--c-skeleton)]" />
          <div className="h-4 w-80 max-w-full rounded bg-[var(--c-skeleton)]" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-[var(--c-skeleton)]" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 rounded-2xl bg-[var(--c-skeleton)]" />
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="h-80 rounded-2xl bg-[var(--c-skeleton)] xl:col-span-2" />
        <div className="h-64 rounded-2xl bg-[var(--c-skeleton)]" />
      </div>
    </div>
  );
}

export function DashboardTab() {
  const dashboard = useRecruitmentStore((state) => state.dashboard);
  const error = useRecruitmentStore((state) => state.error);
  const fetchDashboard = useRecruitmentStore((state) => state.fetchDashboard);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!dashboard) void fetchDashboard();
  }, [dashboard, fetchDashboard]);

  const refresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  if (!dashboard) {
    if (error) {
      return (
        <div className="grid min-h-[70vh] place-items-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-lt bg-card p-8 text-center shadow-card-v">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
              <AlertCircle size={20} />
            </span>
            <h1 className="mt-4 text-lg font-semibold text-base">Could not load the dashboard</h1>
            <p className="mt-2 text-sm text-sec">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        </div>
      );
    }
    return <DashboardSkeleton />;
  }

  const firstName = dashboard.userName.trim().split(/\s+/)[0] || "there";
  const maxStageCount = Math.max(...dashboard.hiringFunnel.map((item) => item.count), 1);
  const sourceTotal = dashboard.sourcePerformance.reduce((sum, item) => sum + item.count, 0);
  const sortedSources = [...dashboard.sourcePerformance].sort((a, b) => b.count - a.count);
  const monthlyTotal = dashboard.monthlyTrends.reduce((sum, item) => sum + item.count, 0);
  const maxMonthlyCount = Math.max(...dashboard.monthlyTrends.map((item) => item.count), 1);

  const metricCards: MetricCardData[] = [
    {
      label: "Open positions",
      value: dashboard.openPositions,
      detail: `${dashboard.draftJobs} draft · ${dashboard.closedJobs} closed`,
      icon: Briefcase,
      iconClass: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300",
      href: "/recruitment/jobs",
    },
    {
      label: "Total candidates",
      value: dashboard.totalCandidates,
      detail: `${dashboard.candidatesThisMonth} added this month`,
      icon: Users,
      iconClass: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300",
      href: "/recruitment/candidates",
    },
    {
      label: "Interviews this week",
      value: dashboard.interviewsThisWeek,
      detail: `${dashboard.interviewsThisMonth} scheduled this month`,
      icon: Calendar,
      iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
      href: "/recruitment/interviews",
    },
    {
      label: "Offers sent",
      value: dashboard.offersSent,
      detail: `${dashboard.offersThisMonth} offers created this month`,
      icon: FileText,
      iconClass: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300",
      href: "/recruitment/offers",
    },
    {
      label: "Offers accepted",
      value: dashboard.offersAccepted,
      detail: "All-time accepted offers",
      icon: CheckCircle,
      iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
      href: "/recruitment/offers",
    },
    {
      label: "Candidates / opening",
      value: dashboard.candidatesPerOpening,
      detail: `Across ${dashboard.totalJobs} total jobs`,
      icon: TrendingUp,
      iconClass: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300",
      href: "/recruitment/candidates",
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
            Recruitment · {formatToday()}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-base sm:text-3xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-sec">Here’s the latest across your hiring pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/recruitment/jobs"
            className="inline-flex items-center gap-2 rounded-xl border border-lt bg-card px-3.5 py-2.5 text-sm font-semibold text-base shadow-card-v transition hover:bg-surface-hover"
          >
            <Briefcase size={16} />
            Manage jobs
          </Link>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-lt bg-card text-sec shadow-card-v transition hover:bg-surface-hover hover:text-base disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {metricCards.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Pipeline snapshot"
          description="Candidates currently distributed across each hiring stage."
          count={dashboard.totalCandidates}
        >
          {maxStageCount > 0 && dashboard.hiringFunnel.some((item) => item.count > 0) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {dashboard.hiringFunnel.map((item) => {
                const percentage = Math.round((item.count / maxStageCount) * 100);
                return (
                  <div key={item.stage} className="rounded-xl border border-lt p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-medium text-sec">{STAGE_LABELS[item.stage] ?? item.stage}</span>
                      <span className="font-semibold text-base">{item.count}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.max(percentage, item.count > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No candidates in the pipeline"
              description="Applications will appear here as candidates move through recruitment."
            />
          )}
        </Panel>

        <Panel title="Candidate sources" description="Where your current candidates came from." count={sourceTotal}>
          {sourceTotal > 0 ? (
            <div className="space-y-3">
              {sortedSources.map((item, index) => {
                const percentage = Math.round((item.count / sourceTotal) * 100);
                const dotClasses = [
                  "bg-indigo-500",
                  "bg-emerald-500",
                  "bg-amber-500",
                  "bg-rose-500",
                  "bg-sky-500",
                ][index % 5];
                return (
                  <div key={item.source}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClasses}`} />
                        <span className="truncate font-medium text-sec">{item.source}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-base">
                        {item.count} · {percentage}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(percentage, 4)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={PieChart}
              title="No source data yet"
              description="Source performance appears after candidates are added."
            />
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel
          title="Upcoming interviews"
          description="The next scheduled candidate conversations."
          count={dashboard.upcomingInterviews.length}
        >
          {dashboard.upcomingInterviews.length > 0 ? (
            <div className="task-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1">
              {dashboard.upcomingInterviews.map((interview) => {
                const date = new Date(interview.scheduledAt);
                const candidateName = `${interview.candidate.firstName} ${interview.candidate.lastName}`.trim() || "Unknown candidate";
                return (
                  <div
                    key={interview.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-lt p-3 transition hover:bg-surface-hover sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                  >
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      <span className="text-lg font-bold leading-none">{Number.isNaN(date.getTime()) ? "—" : date.getDate()}</span>
                      <span className="mt-1 text-[9px] font-bold uppercase tracking-wide">
                        {Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-base">{candidateName}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-sec">
                          {ROUND_LABELS[interview.roundType] ?? interview.roundType}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-sec">{interview.job.title || "General interview"}</p>
                      <p className="mt-1 text-[11px] text-dim sm:hidden">{formatInterviewDate(interview.scheduledAt)}</p>
                    </div>
                    <div className="hidden items-center gap-1.5 text-right text-xs font-medium text-sec sm:flex">
                      <Clock size={13} />
                      {formatInterviewDate(interview.scheduledAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={CalendarCheck}
              title="No interviews scheduled"
              description="Upcoming scheduled and rescheduled interviews will appear here."
            />
          )}
        </Panel>

        <Panel
          title="Recent activity"
          description="The latest changes across your candidate records."
          count={dashboard.recentActivity.length}
        >
          {dashboard.recentActivity.length > 0 ? (
            <div className="task-scrollbar max-h-64 overflow-y-auto pr-1">
              {dashboard.recentActivity.map((event, index) => {
                const ActionIcon = ACTION_ICONS[event.action] ?? Activity;
                const candidateName = `${event.candidate.firstName} ${event.candidate.lastName}`.trim() || "Unknown candidate";
                return (
                  <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < dashboard.recentActivity.length - 1 ? (
                      <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-lt" />
                    ) : null}
                    <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${actionTone(event.action)}`}>
                      <ActionIcon size={14} />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs leading-5 text-sec">
                        <span className="font-semibold text-base">{candidateName}</span>{" "}
                        {ACTION_LABELS[event.action] ?? event.action.replace(/-/g, " ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-dim">{relativeTime(event.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="No recent activity"
              description="Candidate updates and recruitment events will appear here."
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Candidate trend"
        description="Applications added during the last 12 months."
        count={monthlyTotal}
      >
        {monthlyTotal > 0 ? (
          <>
            <div className="relative h-44 overflow-hidden rounded-xl bg-muted/50 px-3 pt-3">
              <div className="pointer-events-none absolute inset-x-3 top-1/4 border-t border-dashed border-lt" />
              <div className="pointer-events-none absolute inset-x-3 top-1/2 border-t border-dashed border-lt" />
              <div className="pointer-events-none absolute inset-x-3 top-3/4 border-t border-dashed border-lt" />
              <div className="relative z-10 flex h-full items-end gap-1.5 sm:gap-3">
                {dashboard.monthlyTrends.map((item) => {
                  const key = `${item.year}-${item.month}`;
                  const barHeight = item.count > 0 ? Math.max(10, Math.round((item.count / maxMonthlyCount) * 84)) : 0;
                  return (
                    <div key={key} className="flex h-full min-w-0 flex-1 items-end justify-center" title={`${MONTHS[item.month - 1]} ${item.year}: ${item.count}`}>
                      <div className="group relative flex h-full w-full max-w-9 items-end">
                        {item.count > 0 ? <span className="absolute left-1/2 z-10 -translate-x-1/2 text-[10px] font-semibold text-sec" style={{ bottom: `${barHeight + 4}%` }}>{item.count}</span> : null}
                        <div
                          className="w-full rounded-t-md bg-indigo-500 transition-all group-hover:bg-indigo-600 dark:bg-indigo-500 dark:group-hover:bg-indigo-400"
                          style={{ height: `${barHeight}%` }}
                        />
                        <span className="sr-only">{MONTHS[item.month - 1]} {item.year}: {item.count} candidates</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-12 gap-1.5 text-center text-[9px] font-medium text-dim sm:gap-3 sm:text-[10px]">
              {dashboard.monthlyTrends.map((item) => (
                <span key={`${item.year}-${item.month}`}>{MONTHS[item.month - 1]}</span>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No candidate trend yet"
            description="Monthly application activity will appear after candidates are added."
          />
        )}
      </Panel>
    </div>
  );
}
