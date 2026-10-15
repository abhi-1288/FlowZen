"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function AuthBackground({ passwordFocused }: { passwordFocused: boolean }) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

      <motion.div
        className="absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-teal-700/20 blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-amber-700/15 blur-3xl"
        animate={{ x: [0, -60, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-rose-700/10 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="absolute bottom-8 left-8 hidden lg:block">
        <Mascot passwordFocused={passwordFocused} />
      </div>
    </div>
  );
}

function Mascot({ passwordFocused }: { passwordFocused: boolean }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let unblink: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timeout = setTimeout(() => {
        setBlink(true);
        unblink = setTimeout(() => setBlink(false), 180);
        schedule();
      }, 2500 + Math.random() * 2500);
    };

    schedule();
    return () => {
      clearTimeout(timeout);
      clearTimeout(unblink);
    };
  }, []);

  const eyesClosed = passwordFocused || blink;

  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="relative"
    >
      <svg width="120" height="140" viewBox="0 0 200 200" fill="none">
        <defs>
          <linearGradient id="mascotBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>

        <ellipse cx="100" cy="115" rx="50" ry="52" fill="url(#mascotBody)" />
        <ellipse cx="100" cy="128" rx="30" ry="26" fill="#99f6e4" opacity="0.4" />

        <motion.ellipse
          cx="82"
          cy="100"
          rx="12"
          fill="white"
          animate={{ ry: eyesClosed ? 2 : 14 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
        <motion.ellipse
          cx="118"
          cy="100"
          rx="12"
          fill="white"
          animate={{ ry: eyesClosed ? 2 : 14 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />

        {!eyesClosed && (
          <>
            <circle cx="84" cy="103" r="5" fill="#134e4a" />
            <circle cx="116" cy="103" r="5" fill="#134e4a" />
            <circle cx="86" cy="101" r="1.5" fill="white" />
            <circle cx="118" cy="101" r="1.5" fill="white" />
          </>
        )}

        <motion.path
          d="M 88 128 Q 100 137 112 128"
          stroke="#134e4a"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          animate={{
            d: passwordFocused
              ? "M 88 131 Q 100 125 112 131"
              : "M 88 128 Q 100 137 112 128",
          }}
          transition={{ duration: 0.3 }}
        />

        <motion.circle
          cx="82"
          cy={passwordFocused ? 100 : 152}
          r="13"
          fill="#0d9488"
          animate={{ cy: passwordFocused ? 100 : 152 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        />
        <motion.circle
          cx="118"
          cy={passwordFocused ? 100 : 152}
          r="13"
          fill="#0d9488"
          animate={{ cy: passwordFocused ? 100 : 152 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        />
      </svg>
    </motion.div>
  );
}


