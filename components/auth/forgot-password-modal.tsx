"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, KeyRound, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
  return (
    <AnimatePresence>
      {open && <ModalContent onClose={onClose} />}
    </AnimatePresence>
  );
}

function ModalContent({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");

    setLoading(true);
    setError("");
    setMessage("");
    const result = await apiFetch<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to send reset link.");
      return null;
    });
    setLoading(false);
    if (!result) return;
    setMessage(result.message);
    event.currentTarget.reset();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 text-violet-300">
          <KeyRound size={24} />
        </div>

        <h2 className="text-xl font-semibold text-white">Forgot password?</h2>
        <p className="mt-1.5 text-sm text-white/50">
          No worries - we&apos;ll send you a magic link to reset your password.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/90">Email address</label>
            <input
              name="email"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-400/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20"
              type="email"
              placeholder="you@company.com"
              required
            />
          </div>
          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
          ) : null}
          {message ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>
          ) : null}
          <button
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110 active:scale-[0.98]"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
            Send magic link
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
