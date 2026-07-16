"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { OAuthProviderIcons } from "@/components/auth/oauth-provider-icons";
import { apiFetch } from "@/lib/client-utils";
import type { UserRole } from "@/lib/types";

const PENDING_EMAIL_KEY = "flowzen_pending_email";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [role, setRole] = useState<UserRole>("employee");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const savedEmail = localStorage.getItem(PENDING_EMAIL_KEY);
    if (!savedEmail) {
      setChecking(false);
      return;
    }
    setEmail(savedEmail);
    apiFetch<{ pending: boolean }>(`/api/auth/check-pending?email=${encodeURIComponent(savedEmail)}`)
      .then((res) => {
        if (res?.pending) {
          setStep("otp");
        } else {
          localStorage.removeItem(PENDING_EMAIL_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(PENDING_EMAIL_KEY);
      })
      .finally(() => setChecking(false));
  }, []);

  function startOver() {
    localStorage.removeItem(PENDING_EMAIL_KEY);
    setStep("details");
    setEmail("");
    setName("");
    setPassword("");
    setOtp(new Array(6).fill(""));
    setError("");
    setNotice("");
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await apiFetch<{ message: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to create account.");
      return null;
    });
    setLoading(false);
    if (!result) return;
    localStorage.setItem(PENDING_EMAIL_KEY, email);
    setNotice(result.message);
    setStep("otp");
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const verifyEmail = email;
    const verifyPassword = password;
    const result = await apiFetch("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email: verifyEmail, otp: otp.join("") }),
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to verify OTP.");
      return null;
    });
    if (!result) {
      setLoading(false);
      return;
    }

    localStorage.removeItem(PENDING_EMAIL_KEY);
    await signIn("credentials-login", { email: verifyEmail, password: verifyPassword, rememberMe: "true", redirect: false });
    await fetch("/api/auth/session-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rememberMe: true })
    });
    router.push("/profile");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#1a1a1a] px-5 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-8 shadow-sm">
          <p className="text-center text-sm text-slate-400 dark:text-zinc-500">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#1a1a1a] px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">
            {step === "details" ? "Get started with FlowZen in seconds." : "Verify your email with a 6-digit code."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-8 shadow-sm">
          {step === "details" ? (
            <>
              <form className="space-y-4" onSubmit={register}>
                <Field label="Full name" value={name} onChange={setName} placeholder="John Doe" />
                <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" />
                <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 8 characters" />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Role</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 outline-none transition-colors focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    value={role}
                    onChange={(event) => setRole(event.target.value as UserRole)}
                  >
                    <option value="employee">Employee</option>
                    <option value="project-manager">Project Manager</option>
                    <option value="qa-tester">QA Tester</option>
                    <option value="human-resource">Human Resource</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Admin</option>
                    <option value="security">Security</option>
                    <option value="others">Others</option>
                  </select>
                </div>
                <Notice error={error} notice={notice} />
                <button
                  className="flex w-full items-center justify-center gap-2.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                  Continue
                </button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <span className="h-px flex-1 bg-slate-100 dark:bg-zinc-700" />
                <span className="text-xs text-slate-400 dark:text-zinc-500">or sign up with</span>
                <span className="h-px flex-1 bg-slate-100 dark:bg-zinc-700" />
              </div>
              <OAuthProviderIcons />
            </>
          ) : (
            <form className="space-y-5" onSubmit={verify}>
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
                We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
              </div>
              <div className="flex items-center justify-between gap-2.5">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!/^\d?$/.test(value)) return;
                      const newOtp = [...otp];
                      newOtp[index] = value;
                      setOtp(newOtp);
                      if (value && index < 5) {
                        document.getElementById(`otp-${index + 1}`)?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[index] && index > 0) {
                        document.getElementById(`otp-${index - 1}`)?.focus();
                      }
                    }}
                    onPaste={(e) => {
                      const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                      if (paste.length === 6) {
                        setOtp(paste.split(""));
                        setTimeout(() => document.getElementById("otp-5")?.focus(), 0);
                      }
                      e.preventDefault();
                    }}
                    id={`otp-${index}`}
                    className="h-14 w-12 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] text-center text-lg font-semibold text-slate-900 dark:text-zinc-100 outline-none transition-colors focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    required
                  />
                ))}
              </div>
              <Field label="Password (for sign in)" value={password} onChange={setPassword} type="password" placeholder="Enter password" />
              <Notice error={error} notice={notice} />
              <button
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                Verify & create account
              </button>
              <button
                className="w-full text-center text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300"
                type="button"
                onClick={startOver}
              >
                Use a different email
              </button>
            </form>
          )}
        </div>

        <div className="mt-5 text-center text-sm text-slate-500 dark:text-zinc-400">
          Already have an account?{" "}
          <Link className="font-medium text-slate-900 dark:text-zinc-100 hover:underline" href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</label>
      <div className="relative">
        <input
          className={`w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 ${isPassword ? "pr-12" : ""}`}
          type={isPassword && showPassword ? "text" : type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          minLength={type === "password" ? 8 : undefined}
          required
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 dark:text-zinc-500 transition-colors hover:bg-slate-100 dark:hover:bg-zinc-700 hover:text-slate-600 dark:hover:text-zinc-300"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Notice({ error, notice }: { error: string; notice: string }) {
  if (error) return <div className="rounded-xl bg-rose-50 dark:bg-rose-950 px-4 py-3 text-sm text-rose-600">{error}</div>;
  if (notice) return <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-600">{notice}</div>;
  return null;
}
