import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard opaque card retained under the legacy component name for callers.
 */
export function GlassCard({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function GlassCardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>{children}</div>;
}

export function GlassCardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("text-lg font-semibold text-slate-900 dark:text-zinc-100", className)}>{children}</h2>;
}
