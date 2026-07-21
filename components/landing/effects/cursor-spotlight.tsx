"use client";

import { useEffect, useRef, useCallback } from "react";
import { useReducedMotion } from "framer-motion";

export function CursorSpotlight() {
  const reducedMotion = useReducedMotion();
  const spotlightRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate(${e.clientX - 400}px, ${e.clientY - 400}px)`;
      }
    });
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const isTouchDevice = window.matchMedia("(hover: none)").matches;
    if (isTouchDevice) return;

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, handleMouseMove]);

  if (reducedMotion) return null;

  return (
    <div
      ref={spotlightRef}
      className="fixed top-0 left-0 w-[800px] h-[800px] pointer-events-none z-[2] hidden md:block"
      aria-hidden="true"
      style={{
        background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
        willChange: "transform",
      }}
    />
  );
}
