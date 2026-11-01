"use client";

import { useEffect, useRef } from "react";
import { AD_CLIENT, AD_SLOT_IDS, type AdPlacement } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  /** Which configured slot to render (see lib/ads.ts). */
  placement: AdPlacement;
  /** banner = responsive horizontal strip · box = taller block */
  variant?: "banner" | "box";
  /** Explicit minimum height override (in px). Defaults to 110 (banner) / 280 (box). */
  height?: number;
  className?: string;
};

/**
 * One AdSense ad unit. The global loader script lives in app/layout.tsx.
 * Production-only: dev/localhost renders a labeled placeholder and never
 * contacts Google, so you never see (or click) live ads while developing.
 *
 * Pushes that happen before the loader finishes are fine — window.adsbygoogle
 * is a queue until Google's script processes it.
 */
export function AdSlot({ placement, variant = "banner", height, className = "" }: AdSlotProps) {
  const slotId = AD_SLOT_IDS[placement];
  const isProduction = process.env.NODE_ENV === "production";
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isProduction || !slotId || pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Loader missing or blocked — nothing recoverable to do.
    }
    pushedRef.current = true;
  }, [isProduction, slotId]);

  // Tailwind needs static class names — spacer height guards against CLS.
  const minHeight = height ?? (variant === "banner" ? 110 : 280);

  if (!isProduction) {
    return (
      <div
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-center dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
        style={{ minHeight }}
        aria-hidden
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          Ad space
        </span>
        <span className="text-[10px] text-zinc-400">
          {placement} · live only on the deployed site
        </span>
      </div>
    );
  }

  // No slot ID configured yet → render nothing in production.
  if (!slotId) return null;

  return (
    <div className={`w-full ${className}`}>
      <span
        aria-hidden
        className="mb-1 block text-center text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600"
      >
        Advertisement
      </span>
      <ins
        className="adsbygoogle block w-full"
        style={{ display: "block", minHeight }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

export default AdSlot;
