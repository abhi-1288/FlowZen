"use client";

export function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full bg-indigo-400/[0.07] blur-3xl floating-orb-1" />
      <div className="absolute top-40 right-[15%] w-96 h-96 rounded-full bg-purple-400/[0.06] blur-3xl floating-orb-2" />
      <div className="absolute bottom-20 left-[30%] w-80 h-80 rounded-full bg-blue-400/[0.05] blur-3xl floating-orb-3" />
    </div>
  );
}
