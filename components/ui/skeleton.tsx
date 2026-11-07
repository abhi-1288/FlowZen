import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ rows = 3, grid = false, className }: { rows?: number; grid?: boolean; className?: string }) {
  const blocks = Array.from({ length: rows });
  if (grid) {
    return (
      <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
        {blocks.map((_, i) => (
          <div key={i} className="neu-card h-36 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((_, i) => (
        <div key={i} className="neu-card h-24 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}
