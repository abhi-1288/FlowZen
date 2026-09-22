import Link from "next/link";
import type { AttentionItem, AttentionSeverity } from "@/lib/command-center/types";

const SEVERITY_STYLES: Record<
  AttentionSeverity,
  { dot: string; badge: string; ring: string }
> = {
  critical: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    ring: "hover:border-rose-200 hover:bg-rose-50/40 dark:hover:border-rose-900",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ring: "hover:border-amber-200 hover:bg-amber-50/40 dark:hover:border-amber-900",
  },
  info: {
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    ring: "hover:border-sky-200 hover:bg-sky-50/40 dark:hover:border-sky-900",
  },
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#000000]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Needs Attention</h3>
        <p className="mt-3 text-sm text-slate-400 dark:text-zinc-500">All clear — nothing needs your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#000000]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Needs Attention</h3>
        <span className="text-xs text-slate-400 dark:text-zinc-500">{items.length} open</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {items.map((item) => {
          const style = SEVERITY_STYLES[item.severity];
          return (
            <div
              key={item.id}
              className={`rounded-lg border border-slate-100 p-3.5 transition-colors ${style.ring} dark:border-zinc-800`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-200">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">{item.description}</p>
                  </div>
                </div>
                {item.count > 1 ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.badge}`}>
                    {item.count}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                  {item.module}
                </span>
                <Link
                  href={item.actionUrl}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
                >
                  {item.actionLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}