"use client";

import { useState } from "react";
import { Eye, PencilLine } from "lucide-react";
import { JobDescription } from "@/components/recruitment/job-description";

export function MarkdownTextarea({
  value,
  defaultValue,
  onChange,
  name,
  rows = 4,
  hint = "Supports Markdown — headings, bullets, bold, tables. Paste from ChatGPT/Gemini for a rich layout.",
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  name?: string;
  rows?: number;
  hint?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? value ?? "");
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const current = value !== undefined ? value : internal;

  const commit = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1 rounded-lg border border-[var(--c-border-light)] p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "edit"
              ? "bg-[var(--c-bg-muted)] text-slate-900 dark:text-zinc-100 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
          }`}
        >
          <PencilLine size={13} /> Edit
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "preview"
              ? "bg-[var(--c-bg-muted)] text-slate-900 dark:text-zinc-100 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
          }`}
        >
          <Eye size={13} /> Preview
        </button>
      </div>

      {mode === "edit" ? (
        <textarea
          name={name}
          value={current}
          onChange={(e) => commit(e.target.value)}
          rows={rows}
          className="w-full resize-y rounded-lg border border-[var(--c-border-light)] px-3 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
          placeholder="e.g. **About the role**..."
        />
      ) : (
        <div className="min-h-[120px] rounded-lg border border-[var(--c-border-light)] bg-[var(--c-bg-card)] px-4 py-3">
          {current.trim() ? (
            <JobDescription content={current} />
          ) : (
            <p className="text-sm text-slate-400 dark:text-zinc-500">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <p className="mt-1.5 text-xs text-slate-400 dark:text-zinc-500">{hint}</p>
    </div>
  );
}