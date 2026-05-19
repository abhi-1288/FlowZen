"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, Eye, EyeOff } from "lucide-react";
import { OAuthProviderIcons } from "@/components/auth/oauth-provider-icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials-login", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError(
        result.error === "CredentialsSignin"
          ? "Invalid email or password."
          : result.error
      );
      return;
    }

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
          {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60" disabled={loading}>
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
      <input className={`w-full rounded-lg border border-slate-200 px-3 py-2.5 ${isPassword ? "pr-10" : ""} outline-none ring-emerald-500 focus:ring-2`} type={isPassword && showPassword ? "text" : type} value={value} onChange={(event) => onChange(event.target.value)} required />
      {isPassword && (<button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-[38px] text-slate-500 hover:text-slate-800"> {showPassword ? <EyeOff size={18} /> : <Eye size={18} />} </button> )}
    </label>
  );
}
