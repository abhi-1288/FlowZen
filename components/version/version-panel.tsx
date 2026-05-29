"use client";

import { useEffect, useState } from "react";

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
  lastUpdate: string;
  commitHash: string;
  totalCommits: number;
  environment?: string;
  status?: string;
  releaseNotes: ReleaseGroup[];
  knownIssues: string[];
}

export function VersionPanel() {
  const [data, setData] = useState<VersionData | null>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Info Bar */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50/80">
        {[
          { label: "Version", value: data.version },
          { label: "Released", value: data.lastUpdate },
          { label: "Commits", value: String(data.totalCommits) },
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
          {data.releaseNotes.map((group) => (
            <div key={group.type} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm leading-none">{group.emoji}</span>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
              <div className="space-y-1">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="inline-flex items-center text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                      {group.prefix}
                    </span>
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
