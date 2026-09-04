"use client";

import { useEffect } from "react";

export function DevCronProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const interval = setInterval(async () => {
      try {
        await fetch("/api/dev/contract-end-disconnect", { credentials: "include" });
      } catch (e) {
        console.error("Dev cron failed:", e);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}