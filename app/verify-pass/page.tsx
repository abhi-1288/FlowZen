"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  User,
  Briefcase,
  CalendarDays,
  MapPin,
  Building2,
  Video,
} from "lucide-react";
import { DEFAULT_ACCENT, hexToRgba } from "@/lib/accent";

type PassState = {
  status: "loading" | "valid" | "invalid" | "idle";
  pass?: {
    candidateName: string;
    role: string;
    company: string;
    roundType: string;
    scheduledAt: string;
    location: string;
    interviewer: string;
  };
  error?: string;
};

function VerifyPassInner() {
  const searchParams = useSearchParams();
  const urlToken = searchParams?.get("token") || "";
  const [token, setToken] = useState(urlToken);
  const [manualCode, setManualCode] = useState("");
  const [state, setState] = useState<PassState>({ status: urlToken ? "loading" : "idle" });
  const accent = DEFAULT_ACCENT;

  useEffect(() => {
    if (!token) {
      setState({ status: "idle" });
      setManualCode("");
      return;
    }
    setState({ status: "loading" });
    let active = true;
    fetch(`/api/public/candidate/pass?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!active) return;
        if (r.ok && data.valid) {
          setState({ status: "valid", pass: data.pass });
        } else {
          setState({ status: "invalid", error: data.error || "This pass could not be verified." });
        }
      })
      .catch(() => {
        if (active) setState({ status: "invalid", error: "Unable to reach the verification service." });
      });
    return () => { active = false; };
  }, [token]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setToken(code);
    setManualCode("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f4] p-6 dark:bg-[#0a0a0a]">
      <div className="w-full max-w-md">
        <div
          className="overflow-hidden rounded-3xl border border-[var(--c-border-light)] bg-[var(--c-bg-card)] shadow-xl dark:bg-[#111111]"
        >
          <div className="flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold text-white" style={{ backgroundColor: accent }}>
            <ShieldCheck size={16} /> FlowZen Access Verification
          </div>

          <div className="p-6">
            {state.status === "idle" && (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <p className="text-sm text-slate-500">Enter the candidate&apos;s guest pass Pass ID to verify:</p>
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="FLOWZ-XXXXXX"
                  className="w-full rounded-xl border border-[var(--c-border-light)] bg-[var(--c-bg-card)] px-4 py-3 text-center font-mono text-lg tracking-widest uppercase outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl py-3 text-sm font-bold text-white"
                  style={{ backgroundColor: accent }}
                >
                  Verify Pass ID
                </button>
              </form>
            )}

            {state.status === "loading" && (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
                <Loader2 size={28} className="animate-spin" />
                <p className="text-sm">Verifying pass…</p>
              </div>
            )}

            {state.status === "invalid" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <XCircle size={48} style={{ color: "#dc2626" }} />
                <p className="text-base font-bold text-slate-800 dark:text-zinc-100">Pass not verified</p>
                <p className="text-sm text-slate-500">{state.error}</p>
                <button
                  onClick={() => { setToken(""); setManualCode(""); setState({ status: "idle" }); }}
                  className="mt-2 rounded-xl border border-[var(--c-border-light)] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-black/5"
                >
                  Try another Pass ID
                </button>
              </div>
            )}

            {state.status === "valid" && state.pass && (
              <div>
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 py-4 dark:bg-emerald-500/10">
                  <CheckCircle2 size={40} style={{ color: "#059669" }} />
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">Access Granted</p>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <Row icon={<User size={15} />} label="Candidate" value={state.pass.candidateName} accent={accent} />
                  <Row icon={<Briefcase size={15} />} label="Role" value={state.pass.role} accent={accent} />
                  <Row icon={<Building2 size={15} />} label="Company" value={state.pass.company} accent={accent} />
                  <Row icon={<Video size={15} />} label="Round" value={state.pass.roundType} accent={accent} />
                  <Row icon={<CalendarDays size={15} />} label="Scheduled" value={state.pass.scheduledAt} accent={accent} />
                  <Row icon={<MapPin size={15} />} label="Location" value={state.pass.location} accent={accent} />
                  {state.pass.interviewer && (
                    <Row icon={<User size={15} />} label="Interviewer" value={state.pass.interviewer} accent={accent} />
                  )}
                </div>
                <button
                  onClick={() => { setToken(""); setManualCode(""); setState({ status: "idle" }); }}
                  className="mt-4 w-full rounded-xl border border-[var(--c-border-light)] py-2.5 text-sm font-semibold text-slate-600 hover:bg-black/5"
                >
                  Verify another Pass ID
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--c-border-light)] pb-2 last:border-b-0">
      <span className="mt-0.5 rounded-md p-1.5" style={{ backgroundColor: hexToRgba(accent, 0.1), color: accent }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="font-medium text-slate-800 dark:text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

export default function VerifyPassPage() {
  return (
    <Suspense fallback={
      <div className="grid min-h-screen place-items-center bg-[#f5f5f4] dark:bg-[#0a0a0a]">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    }>
      <VerifyPassInner />
    </Suspense>
  );
}
