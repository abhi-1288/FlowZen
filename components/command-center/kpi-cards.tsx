import Link from "next/link";
import type { Kpi } from "@/lib/command-center/types";
import { CommandIcon } from "./icons";

export function KpiCards({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const trend = kpi.trend;
        return (
          <div key={kpi.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#000000]">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex rounded-lg bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                <CommandIcon name={kpi.icon} size={18} />
              </div>
              {trend ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    trend.direction === "up"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : trend.direction === "down"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  <CommandIcon
                    name={trend.direction === "up" ? "arrow-up" : trend.direction === "down" ? "arrow-down" : undefined}
                    size={12}
                  />
                  {trend.label}
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              {kpi.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-zinc-100">{kpi.value}</p>
            {kpi.href ? (
              <Link
                href={kpi.href}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
              >
                View
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}