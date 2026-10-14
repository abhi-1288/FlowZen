"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord } from "../shared";

type Request = {
  id: string;
  status: string;
  region: string;
  reason: string;
  createdAt: string;
  requester: { id: string; name: string; email: string; region: string };
};

export function GreenPinRecoverySection({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [generate, setGenerate] = useState<Record<string, boolean>>({});
  const [manualPin, setManualPin] = useState<Record<string, string>>({});
  const [lengths, setLengths] = useState<Record<string, 4 | 6>>({});

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ requests: Request[] }>("/api/hr/pin-reset-requests", undefined, { toast: false });
      setRequests(data.requests ?? []);
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Unable to load recovery requests.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function fulfill(request: Request) {
    const useGenerate = generate[request.id] ?? true;
    const length = lengths[request.id] ?? 6;
    setActingId(request.id);
    try {
      const result = await apiFetch<{ emailSent: boolean; targetEmail?: string }>(`/api/hr/pin-reset-requests/${request.id}/reset`, {
        method: "POST",
        body: JSON.stringify({
          generate: useGenerate,
          pin: useGenerate ? null : manualPin[request.id] ?? null,
          length,
        }),
      }, { toast: false });
      showToast(result.emailSent ? `Green PIN reset and emailed to ${result.targetEmail ?? request.requester.email}.` : "Green PIN reset; email delivery failed.", result.emailSent ? "success" : "error");
      await load();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Unable to approve recovery request.", "error");
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="rounded-xl neu-card p-5 dark:border-zinc-800 dark:bg-[#000000]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Green PIN recovery requests</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Regional requests routed to you by region.</p>
        </div>
        <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" disabled={loading} onClick={() => void load()}>
          {loading ? "Loading..." : "Refresh"}
        </ActionButton>
      </div>
      {requests.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">No pending Green PIN recovery requests.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const useGenerate = generate[request.id] ?? true;
            return (
              <div key={request.id} className="rounded-xl neu-inset p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{request.requester.name}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{request.requester.email} · {request.region || request.requester.region}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{request.reason || "No reason provided."}</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">{request.createdAt ? new Date(request.createdAt).toLocaleString() : ""}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={useGenerate}
                      onChange={(event) => setGenerate((prev) => ({ ...prev, [request.id]: event.target.checked }))}
                    />
                    Generate PIN automatically
                  </label>
                  {!useGenerate ? (
                    <>
                      <select
                        className="neu-inset rounded-md px-2 py-1.5 text-xs"
                        value={lengths[request.id] ?? 6}
                        onChange={(event) => setLengths((prev) => ({ ...prev, [request.id]: Number(event.target.value) === 4 ? 4 : 6 }))}
                      >
                        <option value={4}>4 digits</option>
                        <option value={6}>6 digits</option>
                      </select>
                      <input
                        className="neu-inset w-40 rounded-md px-2.5 py-1.5 text-xs tracking-[0.3em]"
                        placeholder="Manual PIN"
                        value={manualPin[request.id] ?? ""}
                        onChange={(event) => setManualPin((prev) => ({ ...prev, [request.id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
                      />
                    </>
                  ) : null}
                </div>
                <ActionButton variant="primary" className="px-4 py-2 text-xs" disabled={actingId === request.id} onClick={() => void fulfill(request)}>
                  {actingId === request.id ? "Approving..." : "Approve and send PIN"}
                </ActionButton>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
