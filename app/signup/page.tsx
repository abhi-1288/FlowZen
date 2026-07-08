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
      body: JSON.stringify({
        email: verifyEmail,
        otp: otp.join(""),
      }),
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
      <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4 py-8">
        <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
          <p className="text-center text-sm text-slate-500">Loading...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
              Create account
            </h1>
            <p className="text-sm text-slate-500">
              Verify your email with a 6-digit OTP.
            </p>
          </div>
        </div>

        {step === "details" ? (
          <>
            <form className="space-y-4" onSubmit={register}>
              <Field label="Name" value={name} onChange={setName} />
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
              />
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
              />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Role
                </span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2"
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                >
                  <option value="employee">Employee</option>
                  <option value="project-manager">Project manager</option>
                  <option value="qa-tester">Q-A Tester</option>
                  <option value="human-resource">Human Resource</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                  <option value="security">Security</option>
                  <option value="others">Others</option>
                </select>
              </label>
              <Notice error={error} notice={notice} />
              <Submit loading={loading} label="Send OTP" />
            </form>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              OAuth Accounts
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <OAuthProviderIcons />
          </>
        ) : (
          <form className="space-y-4" onSubmit={verify}>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Enter the OTP sent to {email}.
            </div>
            <div className="flex items-center justify-between gap-2">
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
                      const next = document.getElementById(`otp-${index + 1}`);
                      next?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !otp[index] && index > 0) {
                      const prev = document.getElementById(`otp-${index - 1}`);
                      prev?.focus();
                    }
                  }}
                  onPaste={(e) => {
                    const paste = e.clipboardData
                      .getData("text")
                      .replace(/\D/g, "")
                      .slice(0, 6);

                    if (paste.length === 6) {
                      const newOtp = paste.split("");
                      setOtp(newOtp);

                      setTimeout(() => {
                        const last = document.getElementById("otp-5");
                        last?.focus();
                      }, 0);
                    }

                    e.preventDefault();
                  }}
                  id={`otp-${index}`}
                  className="h-12 w-12 rounded-xl border border-slate-300 text-center text-lg font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  required
                />
              ))}
            </div>
            <Field
              label="Password (for sign in)"
              value={password}
              onChange={setPassword}
              type="password"
            />
            <Notice error={error} notice={notice} />
            <Submit loading={loading} label="Verify account" />
            <button
              className="mt-2 w-full text-center text-sm font-medium text-slate-500 hover:text-slate-900"
              type="button"
              onClick={startOver}
            >
              Use a different email
            </button>
          </form>
        )}

        <Link
          className="mt-6 block text-center text-sm font-medium text-slate-500 hover:text-slate-900"
          href="/login"
        >
          Already have an account?
        </Link>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  pattern,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "numeric";
  pattern?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <label
      className="block relative
    "
    >
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <input
        className={`w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2${isPassword ? "pr-10" : ""}`}
        type={isPassword && showPassword ? "text" : type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={type === "password" ? 8 : undefined}
        inputMode={inputMode}
        pattern={pattern}
        required
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-3 top-[38px] text-slate-500 hover:text-slate-800"
        >
          {" "}
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}{" "}
        </button>
      )}
    </label>
  );
}

function Notice({ error, notice }: { error: string; notice: string }) {
  if (error)
    return (
      <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error}
      </p>
    );
  if (notice)
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {notice}
      </p>
    );
  return null;
}

function Submit({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={18} />
      ) : (
        <ShieldCheck size={18} />
      )}
      {label}
    </button>
  );
}
