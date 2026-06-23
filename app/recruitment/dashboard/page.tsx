"use client";

import { useEffect } from "react";
import { Briefcase, Users, Calendar, FileText, CheckCircle } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { STAGE_LABELS, type Stage } from "@/lib/recruitment-types";

export default function RecruitmentDashboardPage() {
  const { dashboard, loading, fetchDashboard } = useRecruitmentStore();

  useEffect(() => { if (!dashboard) void fetchDashboard(); }, [dashboard, fetchDashboard]);

  if (loading || !dashboard) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
      </div>
    );
  }

  const widgets = [
    { label: "Open Positions", value: dashboard.openPositions, icon: Briefcase, color: "bg-sky-50 text-sky-700" },
    { label: "Total Candidates", value: dashboard.totalCandidates, icon: Users, color: "bg-violet-50 text-violet-700" },
    { label: "Interviews This Week", value: dashboard.interviewsThisWeek, icon: Calendar, color: "bg-amber-50 text-amber-700" },
    { label: "Offers Sent", value: dashboard.offersSent, icon: FileText, color: "bg-indigo-50 text-indigo-700" },
    { label: "Offers Accepted", value: dashboard.offersAccepted, icon: CheckCircle, color: "bg-emerald-50 text-emerald-700" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Recruitment Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Overview of your hiring pipeline</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {widgets.map((w) => (
          <div key={w.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className={`rounded-lg p-2 ${w.color}`}>
                <w.icon size={20} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{w.value}</p>
            <p className="mt-1 text-sm text-slate-500">{w.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Hiring Funnel</h2>
          <div className="mt-4 space-y-3">
            {dashboard.hiringFunnel.map((item) => {
              const maxCount = Math.max(...dashboard.hiringFunnel.map((f) => f.count), 1);
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={item.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{STAGE_LABELS[item.stage as Stage]}</span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-950 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Source Performance</h2>
          <div className="mt-4 space-y-3">
            {dashboard.sourcePerformance.map((item) => {
              const total = dashboard.sourcePerformance.reduce((s, i) => s + i.count, 0) || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.source}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.source}</span>
                    <span className="font-semibold text-slate-900">{item.count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
