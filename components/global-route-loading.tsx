"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Global route-level loading state. Whenever the pathname changes (i.e. the user
 * navigates to a new route while data is still fetching), a full-screen overlay
 * shows "Please wait" until the new route has mounted and rendered.
 */
export function GlobalRouteLoading() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setPending(pathname);
    const timer = setTimeout(() => setPending(null), 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl neu-card border border-zinc-800/60 bg-[var(--c-bg)] px-6 py-5 shadow-xl">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">Please wait…</p>
      </div>
    </div>
  );
}
