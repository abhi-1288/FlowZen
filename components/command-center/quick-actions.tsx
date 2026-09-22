import Link from "next/link";
import type { QuickAction } from "@/lib/command-center/types";
import { CommandIcon } from "./icons";

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#000000]">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Quick Actions</h3>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {actions.map((action) => (
          <Link
            key={action.key}
            href={action.href}
            className="group flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-indigo-950 dark:group-hover:text-indigo-300">
              <CommandIcon name={action.icon} size={15} />
            </span>
            <span className="truncate text-xs font-medium text-slate-700 group-hover:text-slate-900 dark:text-zinc-300 dark:group-hover:text-zinc-100">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}