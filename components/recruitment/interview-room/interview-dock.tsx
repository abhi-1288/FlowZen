"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Floats a panel in the bottom-right corner without taking the page away.
 *
 * The interview room used to be a full-screen replacement, which meant joining a
 * call hid the candidate's resume, the feedback form and the action buttons
 * behind it. This keeps the room on screen while the page underneath stays
 * mounted, scrollable and interactive — there is deliberately no backdrop.
 *
 * z-40 keeps it underneath the page's own z-50 dialogs and the z-[60] end-call
 * confirmation, so those still cover it properly.
 *
 * The parent unmounts this when the call ends, which is also what resets the
 * expanded state.
 */
export function InterviewDock({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return (
    <div
      className={
        expanded
          ? "fixed inset-3 z-40 sm:inset-8"
          : "fixed inset-x-3 bottom-3 z-40 h-[440px] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[440px] sm:w-[384px]"
      }
    >
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl ${
          expanded ? "" : "ring-1 ring-black/10"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
          <span className="min-w-0 truncate text-[11px] font-semibold text-slate-300">
            {title}
            <span className="ml-1.5 font-normal text-slate-500">
              {expanded ? "Full screen · Esc to shrink" : "Docked"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-label={expanded ? "Shrink the call panel" : "Expand the call panel"}
            title={expanded ? "Shrink" : "Expand"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
