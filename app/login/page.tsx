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
      setError(
        result.error === "CredentialsSignin"
          ? "Invalid email or password."
          : result.error
      );
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
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
        <Brand />
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <Field label="Password" value={password} onChange={setPassword} type="password" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input suppressHydrationWarning type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm text-slate-600">Remember me</span>
          </label>
          {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          <button suppressHydrationWarning className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
            Login
          </button>
        </form>

        {/* <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          Project manager OAuth
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <OAuthProviderIcons /> */}

        <div className="mt-6 flex justify-between text-sm">
          <Link className="font-medium text-emerald-700 hover:underline" href="/signup">Create account</Link>
          <Link className="font-medium text-slate-500 hover:text-slate-900" href="/forgot-password">Forgot password?</Link>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <button suppressHydrationWarning
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className="flex w-full items-center justify-between text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Demo Accounts
            <ChevronDown size={16} className={`transition-transform ${showDemo ? "rotate-180" : ""}`} />
          </button>
          {showDemo && (
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p className="mb-2 text-slate-400">Use any of these accounts to test the app:</p>
              {[
                ["Admin", "admin@flowzen.com", "admin@flowzen"],
                ["Project Manager", "manager@flowzen.com", "manager@flowzen"],
                ["HR", "hr@flowzen.com", "hr@flowzen"],
                ["QA Tester", "tester@flowzen.com", "tester@flowzen"],
                ["Employee", "employee@flowzen.com", "employee@flowzen"],
                ["Finance", "finance@flowzen.com", "finance@flowzen"],
                ["Others", "other@flowzen.com", "other@flowzen"],
              ].map(([role, mail, pass]) => (
                <div key={mail} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <div>
                    <span className="font-medium text-slate-700">{role}</span>
                    <span className="ml-2 text-slate-400">{mail}</span>
                  </div>
                  <span className="font-mono text-slate-400">{pass}</span>
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
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {seeding ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
                {seeding ? "Seeding..." : "Populate demo accounts"}
              </button>
              {seedMsg && <p className="text-center text-slate-500">{seedMsg}</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white">
        <CheckCircle2 size={24} />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">FlowZen</h1>
        <p className="text-sm text-slate-500">Secure task boards for teams.</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type }: { label: string; value: string; onChange: (value: string) => void; type: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="block relative">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input suppressHydrationWarning className={`w-full rounded-lg border border-slate-200 px-3 py-2.5 ${isPassword ? "pr-10" : ""} outline-none ring-emerald-500 focus:ring-2`} type={isPassword && showPassword ? "text" : type} value={value} onChange={(event) => onChange(event.target.value)} required />
      {isPassword && (<button suppressHydrationWarning type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-[38px] text-slate-500 hover:text-slate-800"> {showPassword ? <EyeOff size={18} /> : <Eye size={18} />} </button> )}
    </label>
  );
}
