"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { OAuthProviderIcons } from "@/components/auth/oauth-provider-icons";
import { apiFetch } from "@/lib/client-utils";
import type { UserRole } from "@/lib/types";

const PENDING_EMAIL_KEY = "flowzen_pending_email";

interface SignupFormProps {
  onSwitchToLogin: () => void;
  onPasswordFocus: () => void;
  onPasswordBlur: () => void;
}

export function SignupForm({ onSwitchToLogin, onPasswordFocus, onPasswordBlur }: SignupFormProps) {
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
    apiFetch<{ pending: boolean }>(
      `/api/auth/check-pending?email=${encodeURIComponent(savedEmail)}`,
    )
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
    }, { toast: false }).catch((err) => {
      setError(
        err instanceof Error ? err.message : "Unable to create account.",
      );
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
    }, { toast: false }).catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to verify OTP.");
      return null;
    });
    if (!result) {
      setLoading(false);
      return;
    }

    localStorage.removeItem(PENDING_EMAIL_KEY);
    const signInResult = await signIn("credentials-login", {
      email: verifyEmail,
      password: verifyPassword,
      rememberMe: "true",
      redirect: false,
    });
    if (signInResult?.error) {
      setError(signInResult.error);
      setLoading(false);
      return;
    }
    await fetch("/api/auth/session-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rememberMe: true }),
    });
    router.push("/profile");
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-white/50" size={32} />
      </div>
    );
  }

  return (
    <>
      {step === "details" ? (
        <>
          <form className="space-y-5" onSubmit={register}>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">Full name</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-400/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">Email</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-400/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">Password</label>
              <PasswordField
                value={password}
                onChange={setPassword}
                onFocus={onPasswordFocus}
                onBlur={onPasswordBlur}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">Role</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition-all focus:border-violet-400/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="employee" className="bg-slate-900">Employee</option>
                <option value="project-manager" className="bg-slate-900">Project Manager</option>
                <option value="qa-tester" className="bg-slate-900">QA Tester</option>
                <option value="human-resource" className="bg-slate-900">Human Resource</option>
                <option value="finance" className="bg-slate-900">Finance</option>
                <option value="admin" className="bg-slate-900">Admin</option>
                <option value="security" className="bg-slate-900">Security</option>
                <option value="it-admin" className="bg-slate-900">IT Admin</option>
                <option value="it-administration" className="bg-slate-900">IT Administration</option>
                <option value="warehouse" className="bg-slate-900">Warehouse</option>
                <option value="others" className="bg-slate-900">Others</option>
              </select>
            </div>
            <Notice error={error} notice={notice} />
            <button
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110 active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Continue
            </button>
          </form>

          <div className="flex items-center gap-4 my-2.5">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/40">or sign up with</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <OAuthProviderIcons />
        </>
      ) : (
        <form className="space-y-5" onSubmit={verify}>
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-300">
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
                  const paste = e.clipboardData
                    .getData("text")
                    .replace(/\D/g, "")
                    .slice(0, 6);
                  if (paste.length === 6) {
                    setOtp(paste.split(""));
                    setTimeout(
                      () => document.getElementById("otp-5")?.focus(),
                      0,
                    );
                  }
                  e.preventDefault();
                }}
                id={`otp-${index}`}
                className="h-14 w-12 rounded-xl border border-white/10 bg-white/5 text-center text-lg font-semibold text-white outline-none transition-all focus:border-violet-400/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20"
                required
              />
            ))}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/90">Password (for sign in)</label>
            <PasswordField
              value={password}
              onChange={setPassword}
              onFocus={onPasswordFocus}
              onBlur={onPasswordBlur}
              placeholder="Enter password"
            />
          </div>
          <Notice error={error} notice={notice} />
          <button
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110 active:scale-[0.98]"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            Verify & create account
          </button>
          <button
            className="w-full text-center text-sm text-white/50 transition-colors hover:text-white/70"
            type="button"
            onClick={startOver}
          >
            Use a different email
          </button>
        </form>
      )}

      <div className="mt-5 text-center text-sm text-white/50">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-violet-300 transition-colors hover:text-violet-200"
        >
          Sign in
        </button>
      </div>
    </>
  );
}

function PasswordField({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-4 pr-12 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-400/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20"
        type={showPassword ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        minLength={8}
        required
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function Notice({ error, notice }: { error: string; notice: string }) {
  if (error)
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
        {error}
      </div>
    );
  if (notice)
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
        {notice}
      </div>
    );
  return null;
}
