import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Glassmorphism surface — frosted translucent card over the aurora/neumorphic
 * background. Use for hero sections, floating panels and emphasis cards.
 */
export function GlassCard({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/30 bg-white/60 p-5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60",
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
