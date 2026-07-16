"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight, Building2, Loader2, Users } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";

type JoinState = "available" | "requested" | "joined";


function normalizeCode(raw: string | null) {
  return String(raw ?? "").trim().toUpperCase();
}

function kindFromCode(code: string) {
  if (code.startsWith("CO-")) return "company";
  if (code.startsWith("TM-")) return "team";
  return "unknown";
}

export default function JoinPage() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const code = useMemo(() => normalizeCode(searchParams?.get("code") ?? null), [searchParams]);
  const kind = kindFromCode(code);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [joinState, setJoinState] = useState<JoinState>("available");

  useEffect(() => {
    if (!code) return;
    let alive = true;
    setPreviewLoading(true);
    setError("");
    setMessage("");
    setJoinState("available");
    void apiFetch<Record<string, unknown>>(`/api/join/preview?code=${encodeURIComponent(code)}`)
      .then((data) => {
        if (!alive) return;
        setPreview(data);
        setJoinState(readJoinState(data));
      })
      .catch((err) => {
        if (!alive) return;
        setPreview(null);
        setError(err instanceof Error ? err.message : "Unable to load invite details.");
      })
      .finally(() => {
        if (!alive) return;
        setPreviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  async function handleJoin() {
    if (!code) return;
    if (status !== "authenticated") {
      await signIn(undefined, { callbackUrl: `/join?code=${encodeURIComponent(code)}` });
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (kind === "company") {
        const data = await apiFetch<{ approvalNotifier?: "hr" | "admin" }>("/api/company/join", {
          method: "POST",
          body: JSON.stringify({ code })
        });
        setMessage(
          data.approvalNotifier === "hr"
            ? "Join request sent to HR for approval."
            : "Join request sent to company admin for approval."
        );
        setJoinState("requested");
      } else if (kind === "team") {
        const data = await apiFetch<{ approvalNotifier?: "hr" | "manager" }>("/api/team/join", {
          method: "POST",
          body: JSON.stringify({ code })
        });
        setMessage(
          data.approvalNotifier === "hr"
            ? "Join request sent to HR for approval."
            : "Join request sent to team manager for approval."
        );
        setJoinState("requested");
      } else {
        setError("Invalid join code format.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send join request.";
      setError(readJoinError(message, code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white">
            {kind === "company" ? <Building2 size={22} /> : <Users size={22} />}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              {kind === "company" ? "Join Company" : kind === "team" ? "Join Team" : "Join Workspace"}
            </h1>
            <p className="text-sm text-slate-500">Use invite code to request access.</p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Invite Code</p>
          <p className="mt-2 font-mono text-sm font-semibold text-indigo-700">{code || "Missing code"}</p>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          {previewLoading ? (
            <p className="text-sm text-slate-500">Loading invite details...</p>
          ) : preview ? (
            <div className="space-y-2 text-sm">
              <MetaRow label="Company" value={readNested(preview, ["company", "name"], "Unknown")} />
              <MetaRow
                label="From"
                value={
                  readNested(preview, ["kind"], "") === "team"
                    ? `${readNested(preview, ["fromUser", "name"], "Manager")}: ${readNested(preview, ["fromRole"], "manager")}`
                    : readNested(preview, ["fromRole"], "-")
                }
              />
              <MetaRow label="To" value={readInviteTarget(preview, code)} />
              {readNested(preview, ["kind"], "") === "team" ? (
                <MetaRow label="Team" value={readNested(preview, ["team", "name"], "Unknown")} />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Invite details unavailable.</p>
          )}
        </div>

        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

        <button
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={joinState !== "available" || !code || loading || kind === "unknown" || !preview || previewLoading}
          onClick={handleJoin}
          type="button"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
          {joinState === "joined" ? "Already Joined" : joinState === "requested" ? "Requested" : "Click to Join"}
        </button>

        <Link className="mt-4 block text-center text-sm font-medium text-slate-500 hover:text-slate-900" href="/profile">
          Back to profile
        </Link>
      </section>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold capitalize text-slate-800">{value}</span>
    </div>
  );
}

function readNested(source: Record<string, unknown>, keys: string[], fallback: string) {
  let current: unknown = source;
  for (const key of keys) {
    if (!current || typeof current !== "object" || !(key in current)) return fallback;
    current = (current as Record<string, unknown>)[key];
  }
  if (current === null || current === undefined || current === "") return fallback;
  return String(current);
}

function readJoinState(preview: Record<string, unknown>): JoinState {
  const state = readNested(preview, ["joinState", "status"], "available");
  if (state === "requested" || state === "joined") return state;
  return "available";
}

function readInviteTarget(preview: Record<string, unknown>, code: string) {
  if (/^(CO|TM)-.+-\d+$/.test(code)) return "Others";
  return readNested(preview, ["toRole"], "-");
}

function readJoinError(message: string, code: string) {
  if (/^CO-.+-\d+$/.test(code) && message.includes("project managers or Q-A testers")) {
    return "This company code is for Others role users.";
  }
  if (/^TM-.+-\d+$/.test(code) && message.includes("Employee role users")) {
    return "This team code is for Others role users.";
  }
  return message;
}
