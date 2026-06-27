"use client";

import { useEffect } from "react";
import {
  Briefcase, Users, Calendar, FileText, CheckCircle, TrendingUp,
  CalendarCheck, Activity, BarChart3,
  UserPlus, UserCheck, ArrowRight, XCircle, Send,
} from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { STAGE_LABELS, type Stage } from "@/lib/recruitment-types";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today ${timeStr}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${timeStr}`;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ` ${timeStr}`;
}

const ROUND_LABELS: Record<string, string> = {
  screening: "Screening",
  technical: "Technical",
  manager: "Manager",
  hr: "HR",
};

const ACTION_LABELS: Record<string, string> = {
  applied: "Applied for a position",
  "resume-uploaded": "Uploaded resume",
  "interview-scheduled": "Interview scheduled",
  "interview-completed": "Interview completed",
  "offer-generated": "Offer generated",
  "offer-accepted": "Offer accepted",
  "offer-rejected": "Offer rejected",
  "stage-changed": "Stage changed",
  joined: "Joined the company",
  rejected: "Rejected",
  "note-added": "Note added",
};

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  applied: UserPlus,
  "resume-uploaded": FileText,
  "interview-scheduled": Calendar,
  "interview-completed": CheckCircle,
  "offer-generated": Send,
  "offer-accepted": CheckCircle,
  "offer-rejected": XCircle,
  "stage-changed": ArrowRight,
  joined: UserCheck,
  rejected: XCircle,
  "note-added": FileText,
};

export function DashboardTab() {
  const { dashboard, loading, fetchDashboard } = useRecruitmentStore();

  useEffect(() => { if (!dashboard) void fetchDashboard(); }, [dashboard, fetchDashboard]);

  if (loading || !dashboard) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
      </div>
    );
  }

  const greeting = getGreeting();

  const metricCards = [
    { label: "Open Positions", value: dashboard.openPositions, icon: Briefcase, color: "bg-sky-50 text-sky-600", trend: null },
    { label: "Total Candidates", value: dashboard.totalCandidates, icon: Users, color: "bg-violet-50 text-violet-600", trend: `+${dashboard.candidatesThisMonth} this month` },
    { label: "Interviews This Week", value: dashboard.interviewsThisWeek, icon: Calendar, color: "bg-amber-50 text-amber-600", trend: `+${dashboard.interviewsThisMonth} this month` },
    { label: "Offers Sent", value: dashboard.offersSent, icon: FileText, color: "bg-indigo-50 text-indigo-600", trend: `+${dashboard.offersThisMonth} this month` },
    { label: "Offers Accepted", value: dashboard.offersAccepted, icon: CheckCircle, color: "bg-emerald-50 text-emerald-600", trend: null },
    { label: "Candidates / Opening", value: dashboard.candidatesPerOpening, icon: TrendingUp, color: "bg-rose-50 text-rose-600", trend: `${dashboard.totalJobs} total jobs` },
  ];

  const maxFunnel = Math.max(...dashboard.hiringFunnel.map((f) => f.count), 1);
  const sourceTotal = dashboard.sourcePerformance.reduce((s, i) => s + i.count, 0) || 1;

  return (
    <div className="space-y-6 p-6">
      {/* Greeting */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shadow-sm">
        <h1 className="text-2xl font-bold">{greeting}, {dashboard.userName}!</h1>
        <p className="mt-1 text-indigo-100">Here&rsquo;s your recruitment overview for today.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex rounded-lg p-2.5 ${c.color}`}>
              <c.icon size={18} />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-sm text-slate-500">{c.label}</p>
            {c.trend && (
              <p className="mt-1 text-xs font-medium text-emerald-600">{c.trend}</p>
            )}
          </div>
        ))}
      </div>

      {/* Hiring Funnel + Source Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <BarChart3 size={16} /> Hiring Funnel
          </h2>
          <div className="mt-4 space-y-3">
            {dashboard.hiringFunnel.map((item) => {
              const pct = Math.round((item.count / maxFunnel) * 100);
              return (
                <div key={item.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{STAGE_LABELS[item.stage as Stage]}</span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-slate-950 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <BarChart3 size={16} /> Source Performance
          </h2>
          <div className="mt-4 space-y-3">
            {dashboard.sourcePerformance.map((item) => {
              const pct = Math.round((item.count / sourceTotal) * 100);
              return (
                <div key={item.source}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.source}</span>
                    <span className="font-semibold text-slate-900">{item.count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upcoming Interviews + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <CalendarCheck size={16} /> Upcoming Interviews
          </h2>
          {dashboard.upcomingInterviews.length > 0 ? (
            <div className="mt-4 space-y-3">
              {dashboard.upcomingInterviews.map((interview) => (
                <div key={interview.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {interview.candidate.firstName?.[0]}{interview.candidate.lastName?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {interview.candidate.firstName} {interview.candidate.lastName}
                    </p>
                    <p className="truncate text-xs text-slate-500">{interview.job.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {ROUND_LABELS[interview.roundType] ?? interview.roundType}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(interview.scheduledAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No upcoming interviews scheduled.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Activity size={16} /> Recent Activity
          </h2>
          {dashboard.recentActivity.length > 0 ? (
            <div className="mt-4 space-y-1">
              {dashboard.recentActivity.map((event) => {
                const ActionIcon = ACTION_ICONS[event.action] ?? Activity;
                return (
                  <div key={event.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <ActionIcon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">
                          {event.candidate.firstName} {event.candidate.lastName}
                        </span>
                        {" "}{ACTION_LABELS[event.action] ?? event.action}
                      </p>
                      <p className="text-xs text-slate-400">{relativeTime(event.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No recent activity.</p>
          )}
        </div>
      </div>

      {/* Monthly Trends */}
      {dashboard.monthlyTrends.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <BarChart3 size={16} /> Monthly Candidates (Last 12 Months)
          </h2>
          <div className="mt-6 flex h-32 items-end gap-2" style={{ minHeight: "8rem" }}>
            {dashboard.monthlyTrends.map((m) => {
              const maxM = Math.max(...dashboard.monthlyTrends.map((t) => t.count), 1);
              const heightPct = Math.max(Math.round((m.count / maxM) * 100), m.count > 0 ? 8 : 4);
              return (
                <div key={`${m.year}-${m.month}`} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium text-slate-500">{m.count}</span>
                  <div
                    className="w-full rounded-t bg-indigo-500 transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
              <span className="text-[10px] text-slate-400">
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m.month - 1]}
              </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
