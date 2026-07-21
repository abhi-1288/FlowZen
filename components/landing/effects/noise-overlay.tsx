"use client";

export function NoiseOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[1]"
      aria-hidden="true"
      style={{ opacity: 0.035 }}
    >
      <svg width="100%" height="100%">
        <filter id="noise-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise-filter)" />
      </svg>
    </div>
  );
}
