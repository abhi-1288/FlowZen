"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { KeyRound, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordStatus />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function consumeToken() {
      if (!token) {
        setError("This reset link is missing its token.");
        return;
      }

      const result = await signIn("forgot-password-magic", {
        token,
        redirect: false,
      });

      if (!active) return;

      if (result?.error) {
        setError("This reset link is invalid or has expired. Request a new magic link.");
        return;
      }

      router.replace("/profile");
    }

    void consumeToken();

    return () => {
      active = false;
    };
  }, [router, token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#1a1a1a] px-5 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            {error ? <KeyRound size={24} /> : <Loader2 className="animate-spin" size={24} />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            {error ? "Reset link problem" : "Signing you in"}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            {error || "Please wait while we verify your magic link."}
          </p>
          {error ? (
            <Link
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              href="/forgot-password"
            >
              Request new link
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ResetPasswordStatus() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#1a1a1a] px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#000000] p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <Loader2 className="animate-spin" size={24} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Signing you in</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          Please wait while we verify your magic link.
        </p>
      </div>
    </main>
  );
}
