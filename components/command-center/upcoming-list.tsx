import Link from "next/link";
import {
  Briefcase,
  Calendar,
  Cake,
  FileText,
  Key,
  Plane,
  UserPlus,
  Wallet,
} from "lucide-react";
import type { UpcomingCategory, UpcomingSection } from "@/lib/command-center/types";

const CATEGORY_ICONS: Record<UpcomingCategory, React.ComponentType<{ size?: number }>> = {
  interview: Briefcase,
  birthday: Cake,
  contract: FileText,
  joining: UserPlus,
  meeting: Calendar,
  holiday: Plane,
  payroll: Wallet,
  deadline: Calendar,
  leave: Plane,
  "it-code": Key,
};

export function UpcomingList({ sections }: { sections: UpcomingSection[] }) {
  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#000000]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Upcoming</h3>
        <p className="mt-3 text-sm text-slate-400 dark:text-zinc-500">Nothing scheduled in the next two weeks.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#000000]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Upcoming</h3>
        <span className="text-xs text-slate-400 dark:text-zinc-500">Next 14 days</span>
      </div>
      <div className="mt-4 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              {section.label}
            </p>
            <ul className="mt-2 space-y-1.5">
              {section.items.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] ?? Calendar;
                const body = (
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-zinc-200">
                        {item.title}
                      </span>
                      {item.time ? (
                        <span className="block text-xs text-slate-400 dark:text-zinc-500">{item.time}</span>
                      ) : null}
                    </span>
                  </div>
                );
                return item.href ? (
                  <li key={item.id}>
                    <Link href={item.href}>{body}</Link>
                  </li>
                ) : (
                  <li key={item.id}>{body}</li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}