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
  // Empty means "whatever the server resolves to" — the viewer's own region,
  // or the global rollup for an owner who has not picked one. Only meaningful
  // when the response says `canSwitchRegion`.
  const [region, setRegion] = useState("");
  const [data, setData] = useState<CommandCenterResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ period });
    if (region) params.set("region", region);
    apiFetch<CommandCenterResponse>(`/api/command-center?${params}`, undefined, { toast: false })
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
  }, [period, region]);

  const scopedToRegion = data?.regionScope === "region";
  const title = data?.companyName
    ? `${data.companyName} ${scopedToRegion ? data.regionLabel : ""} Command Centre`
        .replace(/\s+/g, " ")
        .trim()
    : "Command Centre";

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
          {data.canSwitchRegion && data.regionOptions.length > 0 ? (
            <select
              aria-label="Region"
              // With no explicit pick the server resolves to the viewer's own
              // region. The owner resolves to the global rollup instead, which
              // is why "All offices" is the "" option there and absent here.
              value={region || (data.allowGlobalRegion ? "" : data.region)}
              onChange={(e) => {
                setLoading(true);
                setRegion(e.target.value);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {data.allowGlobalRegion ? <option value="">All offices</option> : null}
              {data.regionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
              {scopedToRegion ? data.regionLabel : "All offices"}
            </span>
          )}
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

      {data.regionFallback ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          No members in {data.regionLabel}, so these numbers cover the whole company.
        </p>
      ) : null}

      {data.regionForced ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
          These numbers are limited to {data.regionLabel}.
        </p>
      ) : null}

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