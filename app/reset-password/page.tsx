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
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white">
          {error ? <KeyRound size={22} /> : <Loader2 className="animate-spin" size={22} />}
        </div>
        <h1 className="text-2xl font-semibold text-slate-950">
          {error ? "Reset link problem" : "Signing you in"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {error || "Please wait while we verify your magic link."}
        </p>
        {error ? (
          <Link
            className="mt-6 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            href="/forgot-password"
          >
            Request new link
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function ResetPasswordStatus() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white">
          <Loader2 className="animate-spin" size={22} />
        </div>
        <h1 className="text-2xl font-semibold text-slate-950">Signing you in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Please wait while we verify your magic link.
        </p>
      </section>
    </main>
  );
}
