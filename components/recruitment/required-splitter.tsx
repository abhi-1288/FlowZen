"use client";

import { useState } from "react";
import { Shuffle, RotateCcw } from "lucide-react";

/** Fisher-Yates so the chosen "required" positions are a uniform random sample. */
function shuffledFlags(count: number, requiredCount: number): boolean[] {
  const flags = Array.from({ length: count }, (_, i) => i < requiredCount);
  for (let i = flags.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flags[i], flags[j]] = [flags[j], flags[i]];
  }
  return flags;
}

/**
 * Always-visible toolbar at the top of a section for splitting its questions
 * into Required and Optional. The HR drags the slider to pick how many should
 * be required and sees the ratio before applying; Apply shuffles which
 * questions get those flags. The per-question Required/Optional toggle stays
 * available afterwards for fine-tuning.
 */
export function RequiredSplitter({
  count,
  currentRequired,
  onApply,
}: {
  count: number;
  currentRequired: number;
  onApply: (requiredFlags: boolean[]) => void;
}) {
  /** Slider position; null mirrors the section's actual current mix. */
  const [picked, setPicked] = useState<number | null>(null);

  if (count === 0) return null;

  // Clamped so shrinking the section can never leave a stale value out of range.
  const value = Math.max(0, Math.min(picked ?? currentRequired, count));
  const optional = count - value;
  const dirty = picked !== null && value !== currentRequired;

  return (
    <div className={`mt-3 rounded-lg border p-3 transition ${dirty ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-500/10" : "border-slate-200 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
          Required / optional split
        </p>
        <span className="text-[11px] text-slate-400 dark:text-zinc-500">auto random</span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Required</span>
        <input
          type="range"
          min={0}
          max={count}
          step={1}
          value={value}
          onChange={(e) => setPicked(Number(e.target.value))}
          className="flex-1 accent-emerald-600"
          aria-label="How many questions should be required"
        />
        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Optional</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          {value} required
        </span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
          {optional} optional
        </span>
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          of {count} question{count === 1 ? "" : "s"}
        </span>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
        Required questions must be answered by the candidate; optional ones can be skipped. Which
        questions get which flag is applied at random.
      </p>

      <div className="mt-2.5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setPicked(null)}
          disabled={!dirty}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          title="Reset the slider to the section's current mix"
        >
          <RotateCcw size={12} /> Reset
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(shuffledFlags(count, value));
            setPicked(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          <Shuffle size={13} /> Apply random split
        </button>
      </div>
    </div>
  );
}
