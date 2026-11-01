// Google AdSense configuration.
//
// 1. Loader: app/layout.tsx (and app/docs/layout.tsx, which renders its own
//    document) inject the global loader script using AD_LOADER_SRC.
// 2. Slots: every placement below maps to one ad unit. Create "Display"
//    responsive ad units in https://adsense.google.com (Ads → By ad unit),
//    then paste each unit's numeric slot ID into AD_SLOT_IDS.
//    Placements with an empty slot ID render nothing in production.
//
// NEXT_PUBLIC_ADSENSE_CLIENT can override the publisher ID without a code change.

export const AD_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-9295957067074459";

export const AD_LOADER_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

export type AdPlacement =
  | "landing-after-features"
  | "landing-after-testimonials"
  | "careers"
  | "recruitment"
  | "board"
  | "it"
  | "profile";

export const AD_SLOT_IDS: Record<AdPlacement, string> = {
  "landing-after-features": "",
  "landing-after-testimonials": "",
  careers: "",
  recruitment: "",
  board: "",
  it: "",
  profile: "",
};
