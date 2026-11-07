import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
} as const;

export function Alert({
  tone = "rose",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={cn("mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm", TONES[tone], className)}>
      {children}
    </p>
  );
}
