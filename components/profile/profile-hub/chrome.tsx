import type { ReactNode } from "react";

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-px bg-slate-100 dark:bg-zinc-700" />
      <div className="grid gap-4 xl:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-slate-100 bg-white p-5 dark:bg-[#000000] dark:border-zinc-800/50">
            <div className="h-5 w-40 rounded-md bg-slate-100 dark:bg-zinc-700" />
            <div className="mt-5 space-y-3">
              {[1, 2, 3, 4].map((line) => (
                <div key={line} className="h-3.5 rounded-md bg-slate-50 dark:bg-zinc-700" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NavButton({
  active,
  label,
  icon,
  onClick,
  after,
}: {
  active: boolean;
  label: string | ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  after?: ReactNode;
}) {
  return (
    <button
      suppressHydrationWarning
      className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
      }`}
      onClick={onClick}
    >
      {icon ? (
        <span
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center transition-colors duration-150 ${
            active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600 dark:text-zinc-500 dark:group-hover:text-zinc-400"
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
      {after || active ? (
        <span className="ml-auto flex items-center gap-1.5">
          {after}
        </span>
      ) : null}
    </button>
  );
}
