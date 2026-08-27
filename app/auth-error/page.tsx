"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNotificationToast } from "@/lib/toast-context";

const FRIENDLY_MESSAGES: Record<string, string> = {
  Configuration: "Sign-in is temporarily unavailable. Please try again later.",
  AccessDenied: "Access was denied. Please try signing in again.",
  Verification: "Your sign-in link has expired. Please try again.",
  OAuthAccountNotLinked:
    "That account is already linked to a different sign-in method. Please use that method.",
  OAuthCallback: "We couldn't complete the sign-in. Please try again.",
  Default: "Unable to sign in right now. Please try again.",
};

function messageForError(error: string | null): string {
  if (!error) return FRIENDLY_MESSAGES.Default;
  return FRIENDLY_MESSAGES[error] || FRIENDLY_MESSAGES.Default;
}

export default function AuthErrorPage() {
  const router = useRouter();
  const { showErrorToast } = useNotificationToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    showErrorToast(messageForError(error));

    const timer = setTimeout(() => {
      router.replace("/login");
    }, 1800);
    return () => clearTimeout(timer);
  }, [router, showErrorToast]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--c-bg)] dark:bg-[#1a1a1a] px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="neu-card rounded-3xl p-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            Redirecting you to sign in…
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            If you are not redirected automatically,{" "}
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="font-medium text-slate-900 dark:text-zinc-100 underline hover:opacity-80"
            >
              return to login
            </button>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
