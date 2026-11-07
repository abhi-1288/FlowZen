import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageNavItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
};

export function PageShell({
  icon,
  title,
  subtitle,
  actions,
  nav,
  activeKey,
  onNav,
  children,
  maxWidth = "max-w-6xl",
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  nav?: PageNavItem[];
  activeKey?: string;
  onNav?: (key: string) => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  const HeaderIcon = icon;
  return (
    <div className={`mx-auto flex w-full ${maxWidth} flex-col px-4 py-6 md:px-8`}>
      <header className="glass-surface mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl py-4 pl-4 pr-4 shadow-sm md:pl-5">
        <div className="flex min-w-0 items-center gap-3">
          {HeaderIcon ? (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <HeaderIcon size={20} />
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-100">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-zinc-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      {nav && nav.length ? (
        <nav aria-label="Sections" className="glass-surface mb-4 flex gap-1 overflow-x-auto rounded-2xl p-1.5 shadow-sm">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeKey;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNav?.(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                )}
              >
                {Icon ? <Icon size={15} /> : null}
                {item.label}
                {item.badge ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] font-bold leading-4",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      ) : null}

      {children}
    </div>
  );
}
