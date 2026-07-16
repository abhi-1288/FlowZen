"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
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
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#1a1a1a] px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Forgot password?</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">
            No worries — we&apos;ll send you a magic link to reset your password.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-8 shadow-sm">
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Email address</label>
              <input
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            {error ? <div className="rounded-xl bg-rose-50 dark:bg-rose-950 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
            {message ? <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-600">{message}</div> : null}
            <button
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
              Send magic link
            </button>
          </form>
        </div>

        <div className="mt-5 text-center text-sm text-slate-500 dark:text-zinc-400">
          Remember your password?{" "}
          <Link className="font-medium text-slate-900 dark:text-zinc-100 hover:underline" href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
