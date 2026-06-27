import type { ReactNode } from "react";

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-48 rounded-2xl bg-gradient-to-r from-slate-200 to-slate-300" />
      <div className="grid gap-5 xl:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="h-6 w-44 rounded bg-slate-200" />
            <div className="mt-6 space-y-4">
              {[1, 2, 3, 4].map((line) => (
                <div key={line} className="h-4 rounded bg-slate-100" />
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
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-white/15 text-white shadow-sm"
          : "text-slate-400 hover:bg-white/10 hover:text-white"
      }`}
      onClick={onClick}
    >
      {icon ? (
        <span
          className={`flex h-5 w-5 items-center justify-center transition-colors duration-200 ${
            active ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300"
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
      {after || active ? (
        <span className="ml-auto flex items-center gap-1.5">
          {after}
          {active ? <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> : null}
        </span>
      ) : null}
    </button>
  );
}



