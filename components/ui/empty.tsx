import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Empty({
  icon: Icon,
  title,
  message,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("neu-card grid place-items-center gap-2.5 rounded-2xl px-6 py-14 text-center", className)}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{title}</p>
      {message ? (
        <p className="max-w-sm text-xs leading-relaxed text-slate-500 dark:text-zinc-400">{message}</p>
      ) : null}
      {children ? <div className="mt-1.5">{children}</div> : null}
    </div>
  );
}
