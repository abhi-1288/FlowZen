"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ReleaseGroup {
  type: string;
  label: string;
  emoji: string;
  prefix: string;
  items: string[];
}

interface VersionData {
  version: string;
  tag: string | null;
  released: string;
  lastUpdate: string;
  rawDate: string;
  commitHash: string;
  totalCommits: number;
  releaseNotes: ReleaseGroup[];
  knownIssues: string[];
}

const prefixColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  FIX: "bg-red-100 text-red-700",
  IMPROVED: "bg-emerald-100 text-emerald-700",
  DEV: "bg-purple-100 text-purple-700",
  UPDATE: "bg-slate-200 text-slate-600",
};

function timeAgo(raw: string): string {
  const now = Date.now();
  const then = new Date(raw).getTime();
  if (isNaN(then)) return raw;
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} day ago`;
  return `${Math.floor(diff / 604800)} wk ago`;
}

export function VersionPanel() {
  const [data, setData] = useState<VersionData | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const toggle = (type: string) => setOpen((prev) => prev[type] ? {} : { [type]: true });

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Info Bar */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50/80">
        {[
          { label: "Version", value: data.version },
          { label: "Released", value: data.released || "N/A" },
          { label: "Last updated", value: timeAgo(data.rawDate) },
        ].map((item) => (
          <div key={item.label} className="px-4 py-3">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-0.5">
              {item.label}
            </p>
            <p className="text-sm font-semibold text-slate-900 truncate">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Release Notes */}
      {data.releaseNotes.length > 0 && (
        <div className="divide-y divide-slate-100">
          {data.releaseNotes.map((group) => {
            const isOpen = open[group.type] ?? false;
            return (
              <div key={group.type}>
                <button
                  type="button"
                  onClick={() => toggle(group.type)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none">{group.emoji}</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {group.label}
                    </span>
                    <span className="inline-flex items-center justify-center h-4 min-w-[18px] px-1 rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      {group.items.length}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={14} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 space-y-1">
                    {group.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span
                          className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${prefixColors[group.prefix] ?? "bg-slate-100 text-slate-500"}`}
                        >
                          {group.prefix}
                        </span>
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Known Issues */}
      {data.knownIssues.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm leading-none">📌</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Known Issues
            </span>
          </div>
          <ul className="space-y-1">
            {data.knownIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="text-slate-300 leading-snug">•</span>
                <span className="leading-snug">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
