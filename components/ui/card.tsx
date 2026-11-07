import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Generic card surface matching the store/feature-delegation look:
 * neumorphic container, rounded-2xl, slate/zinc dark variants.
 */
export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("neu-card rounded-2xl", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-4", className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("text-lg font-semibold text-slate-900 dark:text-zinc-100", className)}>{children}</h2>;
}

export function CardSubtitle({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("mt-0.5 text-sm text-slate-500 dark:text-zinc-400", className)}>{children}</p>;
}
