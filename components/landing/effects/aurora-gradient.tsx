"use client";

export function AuroraGradient() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full aurora-orb-1" />
      <div className="absolute -top-1/3 -right-1/4 w-[700px] h-[700px] rounded-full aurora-orb-2" />
      <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full aurora-orb-3" />
    </div>
  );
}
