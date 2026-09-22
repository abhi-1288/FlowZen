"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectHealth, TrendMetric } from "@/lib/command-center/types";
import { formatInrFull, formatCount } from "@/lib/command-center/format";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_X = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;

function lineData(points: { label: string; value: number }[]) {
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = PAD_X + (i / Math.max(points.length - 1, 1)) * innerW;
    const y = PAD_TOP + innerH - ((p.value - min) / range) * innerH;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]?.[0] ?? 0},${HEIGHT - PAD_BOTTOM} L${coords[0]?.[0] ?? 0},${HEIGHT - PAD_BOTTOM} Z`;
  return { coords, line, area };
}

function formatPointValue(value: number, unit: string): string {
  if (unit === "₹") return formatInrFull(value);
  return `${formatCount(value)}${unit && unit !== "₹" ? ` ${unit}` : ""}`;
}

export function TrendChart({
  trends,
  projectHealth,
  unit = "",
}: {
  trends: TrendMetric[];
  projectHealth: ProjectHealth[] | null;
  unit?: string;
}) {
  const tabs = useMemo(() => {
    const list: { key: string; label: string }[] = trends.map((t) => ({ key: t.key, label: t.label }));
    if (projectHealth && projectHealth.length > 0) list.push({ key: "projects", label: "Projects" });
    return list;
  }, [trends, projectHealth]);

  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const metric = trends.find((t) => t.key === active);

  if (tabs.length === 0) return null;

  const showProjects = active === "projects" && projectHealth && projectHealth.length > 0;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!metric) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = WIDTH / rect.width;
    const x = (e.clientX - rect.left) * ratio;
    const innerW = WIDTH - PAD_X * 2;
    const n = metric.points.length;
    const idx = Math.round(((x - PAD_X) / innerW) * Math.max(n - 1, 1));
    setHoverIndex(Math.max(0, Math.min(n - 1, idx)));
  };

  const hovered = metric && hoverIndex !== null ? metric.points[hoverIndex] : null;
  const hoveredCoords = metric && hoverIndex !== null ? lineData(metric.points).coords[hoverIndex] : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#000000]">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActive(tab.key);
              setHoverIndex(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active === tab.key
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {showProjects ? (
          <div className="space-y-3">
            {(projectHealth ?? []).map((p) => {
              const pct = Math.max(0, Math.min(100, Math.round(p.pct)));
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  className="block rounded-lg border border-slate-100 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-200">{p.name}</p>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        p.warning ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {pct}% done
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${p.warning ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 dark:text-zinc-500">
                    <span>{p.doneTasks}/{p.totalTasks} tasks</span>
                    {p.overdue > 0 ? <span className="text-rose-500">{p.overdue} overdue</span> : null}
                    {p.blocked > 0 ? <span className="text-amber-500">{p.blocked} blocked</span> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : metric ? (
          <div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
              <span>
                Peak <strong className="text-slate-800 dark:text-zinc-200">{formatCount(Math.max(...metric.points.map((p) => p.value), 0))}</strong>
              </span>
              <span>
                Avg{" "}
                <strong className="text-slate-800 dark:text-zinc-200">
                  {formatCount(Math.round(metric.points.reduce((s, p) => s + p.value, 0) / Math.max(metric.points.length, 1)))}
                </strong>
              </span>
              <span className="text-slate-400 dark:text-zinc-500">Over {unit || metric.unit || "period"}</span>
            </div>
            <div className="relative mt-2">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="cc-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75, 1].map((f) => {
                  const y = PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * f;
                  return <line key={f} x1={PAD_X} x2={WIDTH - PAD_X} y1={y} y2={y} className="stroke-slate-100 dark:stroke-zinc-800" strokeWidth="1" />;
                })}
                {(() => {
                  const { line, area, coords } = lineData(metric.points);
                  return (
                    <>
                      <path d={area} fill="url(#cc-area)" />
                      <path d={line} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {coords.map(([x, y], i) => (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r={hoverIndex === i ? 5 : 2.5}
                          className="fill-indigo-600"
                        >
                          <title>
                            {metric.points[i]?.label}: {formatInrFull(metric.points[i]?.value ?? 0)}
                          </title>
                        </circle>
                      ))}
                      {hoverIndex !== null && (() => {
                        const [hx] = coords[hoverIndex];
                        const [hy] = coords[hoverIndex];
                        return (
                          <>
                            <line
                              x1={hx}
                              x2={hx}
                              y1={PAD_TOP}
                              y2={HEIGHT - PAD_BOTTOM}
                              stroke="#6366f1"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                              className="opacity-60"
                            />
                            <circle cx={hx} cy={hy} r="7" fill="none" stroke="#6366f1" strokeWidth="2" className="opacity-80" />
                          </>
                        );
                      })()}
                    </>
                  );
                })()}
                {metric.points.map((p, i) =>
                  i % Math.max(1, Math.ceil(metric.points.length / 6)) === 0 ? (
                    <text key={i} x={PAD_X + (i / Math.max(metric.points.length - 1, 1)) * (WIDTH - PAD_X * 2)} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-400 text-[10px] dark:fill-zinc-500">
                      {p.label}
                    </text>
                  ) : null,
                )}
              </svg>

              {hovered && hoveredCoords ? (() => {
                const [hx] = hoveredCoords;
                const leftPct = Math.min(90, Math.max(10, (hx / WIDTH) * 100));
                return (
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ left: `${leftPct}%`, top: 0, marginTop: 6 }}
                  >
                    <p className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                      {hovered.label}
                    </p>
                    <p className="whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {formatPointValue(hovered.value, metric.unit)}
                    </p>
                  </div>
                );
              })() : null}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-400 dark:text-zinc-500">No data available yet.</p>
        )}
      </div>
    </div>
  );
}