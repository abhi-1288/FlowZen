"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, Eye, EyeOff, ChevronDown, Database } from "lucide-react";
import { OAuthProviderIcons } from "@/components/auth/oauth-provider-icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials-login", { email, password, rememberMe: String(rememberMe), redirect: false });
    setLoading(false);
    if (result?.error) {
      const msg = decodeURIComponent(result.error);
      if (msg.includes("Too many login attempts")) {
        setError("Too many login attempts. Please try again later.");
      } else if (msg === "CredentialsSignin") {
        setError("Invalid email or password.");
      } else {
        setError(msg);
      }
      return;
    }

    await fetch("/api/auth/session-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rememberMe })
    });
    router.push("/profile");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#1a1a1a] px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">Sign in to your FlowZen account</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-8 shadow-sm">
          <form className="space-y-4" onSubmit={submit}>
            <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" />
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Enter your password" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input suppressHydrationWarning type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-slate-600 dark:text-zinc-400">Remember me</span>
              </label>
            </div>
            {error ? (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            ) : null}
            <button
              suppressHydrationWarning
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
              Sign in
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-slate-100 dark:bg-zinc-700" />
            <span className="text-xs text-slate-400 dark:text-zinc-500">or continue with</span>
            <span className="h-px flex-1 bg-slate-100 dark:bg-zinc-700" />
          </div>

          <OAuthProviderIcons />

          <div className="mt-6 flex items-center justify-center gap-1 text-sm text-slate-500 dark:text-zinc-400">
            <span>Don&apos;t have an account?</span>
            <Link className="font-medium text-slate-900 dark:text-zinc-100 hover:underline" href="/signup">Create one</Link>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link className="text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300" href="/forgot-password">Forgot password?</Link>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-[#000000] p-5">
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className="flex w-full items-center justify-between text-sm font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300"
          >
            Demo accounts
            <ChevronDown size={16} className={`transition-transform duration-200 ${showDemo ? "rotate-180" : ""}`} />
          </button>
          {showDemo && (
            <div className="mt-4 space-y-2">
              {[
                ["Admin", "admin@flowzen.com", "admin@flowzen"],
                ["Project Manager", "manager@flowzen.com", "manager@flowzen"],
                ["HR", "hr@flowzen.com", "hr@flowzen"],
                ["QA Tester", "tester@flowzen.com", "tester@flowzen"],
                ["Employee", "employee@flowzen.com", "employee@flowzen"],
                ["Finance", "finance@flowzen.com", "finance@flowzen"],
                ["Sr. Security", "s_security@flowzen.com", "s_security@flowzen"],
                ["Jr. Security", "j_security@flowzen.com", "j_security@flowzen"],
                ["Others", "other@flowzen.com", "other@flowzen"],
              ].map(([role, mail, pass]) => (
                <div key={mail} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-zinc-700 px-4 py-2.5 transition-colors hover:bg-slate-100 dark:hover:bg-zinc-700">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">{role}</span>
                    <span className="ml-2 text-xs text-slate-400 dark:text-zinc-500">{mail}</span>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span className="rounded-md bg-white dark:bg-zinc-700 px-2 py-0.5 font-mono text-xs text-slate-500 dark:text-zinc-400 ring-1 ring-slate-200 dark:ring-zinc-700">{pass}</span>
                    <button
                      type="button"
                      onClick={() => { setEmail(String(mail)); setPassword(String(pass)); }}
                      className="rounded-md bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      Use
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={async () => {
                  setSeeding(true);
                  setSeedMsg("");
                  try {
                    const res = await fetch("/api/seed/demo", { method: "POST" });
                    const data = await res.json();
                    setSeedMsg(data.success ? `Seeded ${data.seeded} demo accounts` : "Failed to seed");
                  } catch {
                    setSeedMsg("Network error");
                  } finally {
                    setSeeding(false);
                  }
                }}
                disabled={seeding}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-zinc-400 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                {seeding ? <Loader2 className="animate-spin" size={15} /> : <Database size={15} />}
                {seeding ? "Seeding..." : "Populate demo accounts"}
              </button>
              {seedMsg && <p className="text-center text-sm text-slate-500 dark:text-zinc-400">{seedMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type, placeholder }: { label: string; value: string; onChange: (value: string) => void; type: string; placeholder?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</label>
      <div className="relative">
        <input
          suppressHydrationWarning
          className={`w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 ${isPassword ? "pr-12" : ""}`}
          type={isPassword && showPassword ? "text" : type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        {isPassword && (
          <button
            suppressHydrationWarning
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
