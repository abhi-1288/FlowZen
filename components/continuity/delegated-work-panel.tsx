"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Check, Clock, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorNote,
  formatDateTime,
  inputClass,
  labelClass,
  LoadingRows,
  memberName,
  Modal,
  PanelHeader,
  StatusPill,
  type HandoverRecord,
} from "./common";

const SCOPE_LABELS = {
  incoming: "Awaiting my acceptance",
  outgoing: "Sent by me",
  team: "Team delegated work",
  all: "All handovers",
} as const;

type Scope = keyof typeof SCOPE_LABELS;

export function DelegatedWorkPanel({ defaultScope = "incoming" }: { defaultScope?: Scope }) {
  const { showSuccessToast } = useNotificationToast();
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState<{ handover: HandoverRecord; action: "accept" | "decline" | "cancel" } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ scope });
      if (statusFilter) query.set("status", statusFilter);
      const result = await apiFetch<{ handovers: HandoverRecord[] }>(
        `/api/boards/todos/handover?${query.toString()}`,
        undefined,
        { toast: false },
      );
      setHandovers(result.handovers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load delegated work.");
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveHandover() {
    if (!resolving) return;
    setBusy(true);
    try {
      await apiFetch(`/api/boards/handover/${resolving.handover.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: resolving.action, reason }),
      });
      showSuccessToast(
        resolving.action === "accept"
          ? "Handover accepted. Ownership has transferred."
          : resolving.action === "decline"
            ? "Handover declined. The original owner keeps the todo."
            : "Handover cancelled.",
      );
      setResolving(null);
      setReason("");
      await load();
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  const pendingIncoming = useMemo(
    () => handovers.filter((item) => item.status === "pending" && scope === "incoming"),
    [handovers, scope],
  );

  return (
    <Card>
      <PanelHeader
        title="Delegated work"
        description="Ownership only moves when the recipient accepts. Declines and cancellations stay in the audit trail."
        actions={
          <button className={btnSecondary} onClick={() => void load()} type="button">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-lg border border-slate-200 p-0.5 dark:border-zinc-700">
          {(Object.keys(SCOPE_LABELS) as Scope[]).map((value) => (
            <button
              key={value}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                scope === value
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
              onClick={() => setScope(value)}
              type="button"
            >
              {SCOPE_LABELS[value]}
            </button>
          ))}
        </div>
        <select className={inputClass + " max-w-[170px]"} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {pendingIncoming.length ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">{pendingIncoming.length}</span> handover request(s) are waiting for your acceptance. The todo stays with its original owner until you accept.
        </div>
      ) : null}

      <ErrorNote message={error} />
      {loading ? <LoadingRows rows={4} /> : null}

      {!loading && handovers.length === 0 ? (
        <EmptyState
          title="No delegated work here"
          description="Delegate a todo from My Todos. The recipient is notified and must accept before ownership changes."
        />
      ) : null}

      <div className="space-y-2">
        {handovers.map((handover) => {
          const todo = handover.todo;
          const canResolve = handover.status === "pending";
          return (
            <div
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-[#0b0b0b]"
              key={handover.id}
            >
              <div className="flex flex-wrap items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <ArrowRightLeft size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {todo && typeof todo === "object" ? todo.title : "Todo"}
                    </span>
                    <StatusPill status={handover.status} />
                    {todo && typeof todo === "object" && todo.status ? <StatusPill status={todo.status} /> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                    {memberName(handover.fromEmployee)} → {memberName(handover.toEmployee)}
                    {handover.requestedBy && memberName(handover.requestedBy) !== memberName(handover.fromEmployee)
                      ? ` · requested by ${memberName(handover.requestedBy)}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">{handover.reason}</p>
                  {handover.instructions ? (
                    <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                      <span className="font-semibold">Instructions: </span>
                      {handover.instructions}
                    </p>
                  ) : null}
                  {handover.declineReason ? (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">Declined: {handover.declineReason}</p>
                  ) : null}
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock size={10} /> {formatDateTime(handover.acceptedAt ?? handover.declinedAt ?? handover.cancelledAt ?? handover.createdAt)}
                  </p>
                </div>

                {canResolve ? (
                  <div className="flex flex-wrap gap-1.5">
                    {scope === "incoming" ? (
                      <>
                        <button
                          className={btnPrimary}
                          onClick={() => {
                            setResolving({ handover, action: "accept" });
                            setReason("");
                          }}
                          type="button"
                        >
                          <Check size={12} /> Accept
                        </button>
                        <button
                          className={btnDanger}
                          onClick={() => {
                            setResolving({ handover, action: "decline" });
                            setReason("");
                          }}
                          type="button"
                        >
                          <X size={12} /> Decline
                        </button>
                      </>
                    ) : (
                      <button
                        className={btnSecondary}
                        onClick={() => {
                          setResolving({ handover, action: "cancel" });
                          setReason("");
                        }}
                        type="button"
                      >
                        <X size={12} /> Cancel request
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={Boolean(resolving)}
        title={
          resolving?.action === "accept"
            ? "Accept handover"
            : resolving?.action === "decline"
              ? "Decline handover"
              : "Cancel handover request"
        }
        onClose={() => setResolving(null)}
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-zinc-300">
            {resolving?.action === "accept"
              ? "Accepting transfers ownership of the todo to you. The original owner and full history remain visible."
              : resolving?.action === "decline"
                ? "The todo stays with its current owner. The requester is notified."
                : "The recipient is notified and the todo returns to its current owner's queue."}
          </p>
          {resolving?.action !== "accept" ? (
            <div>
              <label className={labelClass}>Reason</label>
              <textarea className={inputClass + " min-h-[72px]"} onChange={(event) => setReason(event.target.value)} value={reason} />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setResolving(null)} type="button">
              Back
            </button>
            <button
              className={resolving?.action === "accept" ? btnPrimary : btnDanger}
              disabled={busy || (resolving?.action !== "accept" && !reason.trim())}
              onClick={() => void resolveHandover()}
              type="button"
            >
              {resolving?.action === "accept" ? "Accept ownership" : resolving?.action === "decline" ? "Decline" : "Cancel request"}
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
