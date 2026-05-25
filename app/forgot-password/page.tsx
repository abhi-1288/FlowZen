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
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-8">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white">
            <KeyRound size={22} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">Forgot password</h1>
          <p className="mt-1 text-sm text-slate-500">
            We will email you a secure magic link to sign in and update your password.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
            Send magic link
          </button>
        </form>
        <Link className="mt-6 block text-center text-sm font-medium text-slate-500 hover:text-slate-900" href="/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
