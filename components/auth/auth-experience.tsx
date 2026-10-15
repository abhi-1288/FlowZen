"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Database, Loader2 } from "lucide-react";
import { AuthBackground } from "@/components/auth/auth-background";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type AuthView = "login" | "signup";

interface AuthExperienceProps {
  initialView?: AuthView;
  initialForgotOpen?: boolean;
}

export function AuthExperience({ initialView = "login", initialForgotOpen = false }: AuthExperienceProps) {
  const [view, setView] = useState<AuthView>(initialView);
  const [forgotOpen, setForgotOpen] = useState(initialForgotOpen);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const desired = forgotOpen ? "/forgot-password" : view === "signup" ? "/signup" : "/login";
      if (window.location.pathname !== desired) {
        window.history.replaceState(null, "", desired);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [view, forgotOpen]);

  const switchToSignup = useCallback(() => setView("signup"), []);
  const switchToLogin = useCallback(() => setView("login"), []);
  const openForgot = useCallback(() => setForgotOpen(true), []);
  const closeForgot = useCallback(() => setForgotOpen(false), []);

  const handlePasswordFocus = useCallback(() => setPasswordFocused(true), []);
  const handlePasswordBlur = useCallback(() => setPasswordFocused(false), []);

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden">
      <AuthBackground passwordFocused={passwordFocused} />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 py-10">
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="mb-8 text-center">
            <motion.div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/20"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
            >
              <CheckCircle2 size={28} />
            </motion.div>
            <motion.h1
              className="text-2xl font-bold tracking-tight text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              {view === "login" ? "Welcome back" : "Create your account"}
            </motion.h1>
            <motion.p
              className="mt-1.5 text-sm text-white/50"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
            >
              {view === "login"
                ? "Sign in to your FlowZen account"
                : "Get started with FlowZen in seconds."}
            </motion.p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <AnimatePresence mode="wait" initial={false}>
              {view === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                >
                  <LoginForm
                    onSwitchToSignup={switchToSignup}
                    onOpenForgot={openForgot}
                    onPasswordFocus={handlePasswordFocus}
                    onPasswordBlur={handlePasswordBlur}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                >
                  <SignupForm
                    onSwitchToLogin={switchToLogin}
                    onPasswordFocus={handlePasswordFocus}
                    onPasswordBlur={handlePasswordBlur}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {view === "login" && <DemoAccounts />}
        </motion.div>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={closeForgot} />
    </div>
  );
}

function DemoAccounts() {
  const router = useRouter();
  const [showDemo, setShowDemo] = useState(false);
  const [pendingDemo, setPendingDemo] = useState<string | null>(null);
  const [demoError, setDemoError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  async function performLogin(loginEmail: string, loginPassword: string) {
    const result = await signIn("credentials-login", {
      email: loginEmail,
      password: loginPassword,
      rememberMe: "false",
      redirect: false,
    });

    if (result?.error) {
      return { ok: false as const, message: describeLoginError(result.error) };
    }

    await fetch("/api/auth/session-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rememberMe: false }),
    });
    router.push("/profile");
    return { ok: true as const };
  }

  async function loginAsDemo(demoEmail: string, demoPassword: string) {
    setPendingDemo(demoEmail);
    setDemoError("");

    let result = await performLogin(demoEmail, demoPassword);

    if (!result.ok) {
      try {
        const seedRes = await fetch("/api/seed/demo", { method: "POST" });
        if (seedRes.ok) result = await performLogin(demoEmail, demoPassword);
      } catch {
        // fall through
      }
    }

    setPendingDemo(null);
    if (!result.ok) setDemoError(result.message);
  }

  const demos: [string, string, string][] = [
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
  ];

  return (
    <motion.div
      className="mt-6 w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => { setShowDemo(!showDemo); setDemoError(""); }}
          className="flex w-full items-center justify-between text-sm font-medium text-white/70 transition-colors hover:text-white/90"
        >
          Demo accounts
          <ChevronDown size={16} className={`transition-transform duration-200 ${showDemo ? "rotate-180" : ""}`} />
        </button>
        {showDemo && (
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {demos.map(([role, mail, pass]) => (
              <div key={mail} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 transition-colors hover:bg-white/10">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white/80">{role}</span>
                  <span className="ml-2 text-xs text-white/40">{mail}</span>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-white/50">{pass}</span>
                  <button
                    type="button"
                    onClick={() => loginAsDemo(mail, pass)}
                    disabled={pendingDemo !== null}
                    className="rounded-md bg-teal-600/30 px-2.5 py-0.5 text-xs font-medium text-teal-200 transition-colors hover:bg-teal-600/50 disabled:opacity-50"
                  >
                    {pendingDemo === mail ? <Loader2 className="animate-spin" size={12} /> : null}
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
    </motion.div>
  );
}

function describeLoginError(raw?: string) {
  if (!raw) return "Something went wrong. Please try again.";
  const msg = decodeURIComponent(raw);
  if (msg.includes("Too many login attempts")) return "Too many login attempts. Please try again later.";
  if (msg === "CredentialsSignin") return "Invalid email or password.";
  return msg;
}
