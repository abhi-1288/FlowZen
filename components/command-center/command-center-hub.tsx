"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import type { CommandCenterResponse, Period } from "@/lib/command-center/types";
import { AttentionList } from "./attention-list";
import { KpiCards } from "./kpi-cards";
import { QuickActions } from "./quick-actions";
import { TrendChart } from "./trend-chart";
import { UpcomingList } from "./upcoming-list";

const PERIODS: { id: Period; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "3m", label: "3 months" },
  { id: "1y", label: "1 year" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function CommandCenterHub() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<CommandCenterResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<CommandCenterResponse>(`/api/command-center?period=${period}`, undefined, { toast: false })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const title = data?.companyName ? `${data.companyName} Command Centre` : "Command Centre";

  if (loading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
            {getGreeting()}, {data.userName}! <span className="text-slate-400 dark:text-zinc-500">&middot; {formatToday()}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {data.variantLabel}
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 p-1 dark:border-zinc-700">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setPeriod(p.id);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p.id
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <KpiCards kpis={data.kpis} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <TrendChart trends={data.trends} projectHealth={data.projectHealth} />
          <UpcomingList sections={data.upcoming} />
        </div>
        <div className="space-y-6">
          <QuickActions actions={data.quickActions} />
          <AttentionList items={data.attention} />
        </div>
      </div>
    </div>
  );
}