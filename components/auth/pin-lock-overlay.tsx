"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Lock, LogOut, Unlock } from "lucide-react";
import { signOut } from "next-auth/react";

export function PinLockOverlay({
  length,
  lockoutUntil: initialLockoutUntil,
  onUnlocked,
  onStatus,
}: {
  length: number;
  lockoutUntil: number | null;
  onUnlocked: () => void;
  onStatus?: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(initialLockoutUntil);
  const [remaining, setRemaining] = useState(0);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryReason, setRecoveryReason] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!lockoutUntil) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) setLockoutUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lockoutUntil]);

async function requestRecovery() {
    setRecovering(true);
    setRecoveryError("");
    setRecoveryMessage("");
    try {
      const response = await fetch("/api/auth/pin/recovery/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: recoveryReason.trim() }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Unable to send recovery request.");
      setRecoveryMessage("Recovery request sent to your region's HR. Check your email for the replacement Green PIN.");
      setRecoveryReason("");
    } catch (caught) {
      setRecoveryError(caught instanceof Error ? caught.message : "Unable to send recovery request.");
    } finally {
      setRecovering(false);
    }
  }

  const busy = remaining > 0 || submitting || unlocking;

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    setValue(digits);
    if (error) setError("");
  }

  async function submit() {
    if (value.length !== length || busy) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/pin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setValue("");
        setUnlocking(true);
        window.setTimeout(() => onUnlocked(), 900);
        return;
      }
      setValue("");
      setError(typeof data?.error === "string" ? data.error : "Incorrect Green PIN.");
      setShake((n) => n + 1);
      if (data?.lockoutUntil) setLockoutUntil(Number(data.lockoutUntil));
      onStatus?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const content = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Screen locked"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) inputRef.current?.focus();
      }}
    >
      {/* Full-screen blur so the app behind is visible but obscured. */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl dark:bg-black/70" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="relative w-full max-w-sm rounded-3xl border border-white/70 bg-white/95 p-7 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-[#111111]/95"
      >
        <div className="flex flex-col items-center">
          <motion.div
            key={unlocking ? "unlock" : "lock"}
            animate={
              unlocking
                ? { rotate: [0, -10, 10, 0], scale: [1, 1.18, 1], y: 0 }
                : { y: [0, -4, 0] }
            }
            transition={
              unlocking
                ? { duration: 0.7, ease: "easeInOut" }
                : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
            }
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
              unlocking
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
            }`}
          >
            {unlocking ? <Unlock size={30} /> : <Lock size={30} />}
          </motion.div>

          <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-zinc-100">
            {unlocking ? "Unlocking\u2026" : "Screen locked"}
          </h2>
          <p className="mt-1 text-center text-sm text-slate-500 dark:text-zinc-400">
            {unlocking
              ? "Welcome back"
              : remaining > 0
                ? `Too many attempts. Try again in ${remaining}s`
                : `Enter your ${length}-digit Green PIN to continue`}
          </p>

          <motion.div
            key={shake}
            animate={{ x: shake ? [0, -9, 9, -7, 7, 0] : 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 flex items-center justify-center gap-2.5"
            onClick={() => inputRef.current?.focus()}
          >
            {Array.from({ length }).map((_, index) => {
              const filled = index < value.length;
              const active = index === value.length && !busy;
              return (
                <div
                  key={index}
                  className={`flex h-12 w-10 items-center justify-center rounded-xl border-2 text-xl font-semibold transition-colors ${
                    error
                      ? "border-rose-300 dark:border-rose-800"
                      : filled
                        ? "border-slate-800 dark:border-zinc-200"
                        : "border-slate-200 dark:border-zinc-700"
                  } ${active ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-[#111111]" : ""}`}
                >
                  {filled ? <span className="text-slate-900 dark:text-zinc-100">&#9679;</span> : null}
                </div>
              );
            })}
          </motion.div>

          <input
            ref={inputRef}
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]*"
            maxLength={length}
            disabled={busy}
            aria-label={`${length}-digit Green PIN`}
            className="absolute h-0 w-0 opacity-0"
          />

{error ? (
            <p className="mt-3 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>
          ) : null}

          <div className="mt-4 text-center">
            {!recoveryOpen ? (
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
                onClick={() => setRecoveryOpen(true)}
                disabled={busy || remaining > 0}
              >
                Forgot your Green PIN?
              </button>
            ) : (
              <div className="mt-2 space-y-3 rounded-2xl border border-[var(--c-border-light)] p-4 text-left dark:border-zinc-800">
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">
                  Ask your region&apos;s HR to reset it
                </p>
                <textarea
                  className="w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm dark:border-zinc-800 dark:bg-[#000000]"
                  placeholder="Optional reason"
                  rows={2}
                  value={recoveryReason}
                  onChange={(event) => setRecoveryReason(event.target.value.slice(0, 240))}
                  disabled={recovering}
                />
                {recoveryError ? (
                  <p className="text-sm text-rose-600 dark:text-rose-400">{recoveryError}</p>
                ) : null}
                {recoveryMessage ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{recoveryMessage}</p>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    onClick={() => void requestRecovery()}
                    disabled={recovering}
                  >
                    {recovering ? "Sending..." : "Send request"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--c-border-light)] px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300"
                    onClick={() => {
                      setRecoveryOpen(false);
                      setRecoveryError("");
                      setRecoveryMessage("");
                    }}
                    disabled={recovering}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={value.length !== length || busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {submitting || unlocking ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
            ) : (
              <Unlock size={16} />
            )}
            Enter
          </button>

          <div className="mt-4 flex items-center justify-center text-xs text-slate-400 dark:text-zinc-500">
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
