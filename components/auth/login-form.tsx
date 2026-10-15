"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Eye, EyeOff, ChevronDown, Database } from "lucide-react";
import { OAuthProviderIcons } from "@/components/auth/oauth-provider-icons";

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onOpenForgot: () => void;
  onPasswordFocus: () => void;
  onPasswordBlur: () => void;
}

export function LoginForm({ onSwitchToSignup, onOpenForgot, onPasswordFocus, onPasswordBlur }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pendingDemo, setPendingDemo] = useState<string | null>(null);
  const [demoError, setDemoError] = useState("");

  async function performLogin(loginEmail: string, loginPassword: string): Promise<LoginResult> {
    const result = await signIn("credentials-login", {
      email: loginEmail,
      password: loginPassword,
      rememberMe: String(rememberMe),
      redirect: false
    });

    if (result?.error) {
      return { ok: false, raw: result.error, message: describeLoginError(result.error) };
    }

    await fetch("/api/auth/session-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rememberMe })
    });
    router.push("/profile");
    return { ok: true };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await performLogin(email, password);
    setLoading(false);

    if (!result.ok) setError(result.message);
  }

  async function loginAsDemo(demoEmail: string, demoPassword: string) {
    setPendingDemo(demoEmail);
    setDemoError("");
    setError("");

    let result = await performLogin(demoEmail, demoPassword);

    if (!result.ok && isCredentialRejection(result.raw)) {
      try {
        const seedRes = await fetch("/api/seed/demo", { method: "POST" });
        if (seedRes.ok) result = await performLogin(demoEmail, demoPassword);
      } catch {
        // fall through to the original failure below
      }
    }

    setPendingDemo(null);
    if (!result.ok) setDemoError(result.message);
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-white/90">Email</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-400/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20"
            type="email"
            value={email}
            placeholder="you@company.com"
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white/90">Password</label>
        <PasswordField
          value={password}
          onChange={setPassword}
          onFocus={onPasswordFocus}
          onBlur={onPasswordBlur}
          placeholder="Enter your password"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/30"
          />
          <span className="text-sm text-white/60">Remember me</span>
        </label>
        <button
          type="button"
          onClick={onOpenForgot}
          className="text-sm text-violet-300 transition-colors hover:text-violet-200"
        >
          Forgot password?
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <button
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110 active:scale-[0.98]"
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
        Sign in
      </button>

      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-white/40">or continue with</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <OAuthProviderIcons />

      <div className="flex items-center justify-center gap-1 text-sm text-white/50">
        <span>Don&apos;t have an account?</span>
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="font-medium text-violet-300 transition-colors hover:text-violet-200"
        >
          Create one
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <button
          type="button"
          onClick={() => { setShowDemo(!showDemo); setDemoError(""); }}
          className="flex w-full items-center justify-between text-sm font-medium text-white/70 transition-colors hover:text-white/90"
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
              ["IT Admin", "it_admin@flowzen.com", "it_admin@flowzen"],
              ["IT Support", "it_support@flowzen.com", "it_support@flowzen"],
              ["Others", "other@flowzen.com", "other@flowzen"],
              ["Warehouse", "warehouse@flowzen.com", "warehouse@flowzen"],
            ].map(([role, mail, pass]) => (
              <div key={mail} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 transition-colors hover:bg-white/10">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white/80">{role}</span>
                  <span className="ml-2 text-xs text-white/40">{mail}</span>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-white/50">{pass}</span>
                  <button
                    type="button"
                    onClick={() => loginAsDemo(String(mail), String(pass))}
                    disabled={pendingDemo !== null}
                    className="rounded-md bg-violet-600/30 px-2.5 py-0.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-600/50 disabled:opacity-50"
                  >
                    {pendingDemo === String(mail) ? <Loader2 className="animate-spin" size={12} /> : null}
                    Sign in
                  </button>
                </div>
              </div>
            ))}
            {demoError ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {demoError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                setSeeding(true);
                setSeedMsg("");
                setDemoError("");
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
              disabled={seeding || pendingDemo !== null}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {seeding ? <Loader2 className="animate-spin" size={15} /> : <Database size={15} />}
              {seeding ? "Seeding..." : "Populate demo accounts"}
            </button>
            {seedMsg && <p className="text-center text-sm text-white/50">{seedMsg}</p>}
          </div>
        )}
      </div>
    </form>
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

type LoginResult = { ok: true } | { ok: false; raw?: string; message: string };

function describeLoginError(raw?: string) {
  if (!raw) return "Something went wrong. Please try again.";
  const msg = decodeURIComponent(raw);
  if (msg.includes("Too many login attempts")) return "Too many login attempts. Please try again later.";
  if (msg === "CredentialsSignin") return "Invalid email or password.";
  return msg;
}

function isCredentialRejection(raw?: string) {
  return raw ? decodeURIComponent(raw) === "CredentialsSignin" : false;
}
