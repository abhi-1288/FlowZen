"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  Loader2,
  Ticket,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { ItTicketModal } from "./it-ticket-modal";
import { NewTicketModal } from "./new-ticket-modal";
import {
  type ItTicket,
  type ItTicketCategory,
  type ItTicketPriority,
  type ItTicketStatus,
  IT_STATUS_LABELS,
  IT_STATUS_COLORS,
  IT_CATEGORY_LABELS,
  IT_PRIORITY_LABELS,
  IT_PRIORITY_COLORS,
  IT_CANCEL_REASONS,
  requesterId,
  CANCEL_ALLOWED_STATUSES,
} from "./it-types";

const ALL_CATEGORIES: ItTicketCategory[] = [
  "ACCOUNT_LOGIN",
  "ACCESS_PERMISSION",
  "HARDWARE",
  "SOFTWARE",
  "NETWORK",
  "EMAIL",
  "PRINTER_PERIPHERAL",
  "SECURITY",
  "ACCOUNT_CREATION",
  "OTHER",
];

const ALL_PRIORITIES: ItTicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type StatusFilter = { key: string; label: string; statuses?: readonly ItTicketStatus[] };
const STATUS_GROUPS: StatusFilter[] = [
  { key: "", label: "All" },
  { key: "open", label: "Open", statuses: ["PENDING", "ASSIGNED", "QUEUED", "IN_PROGRESS", "WAITING_FOR_USER"] },
  { key: "awaiting", label: "Awaiting", statuses: ["AWAITING_CONFIRMATION"] },
  { key: "resolved", label: "Resolved", statuses: ["RESOLVED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

export function ItTicketsView() {
  const { data: session } = useSession();
  const actorRole = String(session?.user?.role ?? "");
  const currentUserId = String(session?.user?.id ?? "");
  const { showErrorToast } = useNotificationToast();

  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<ItTicket | null>(null);
  const [statusGroup, setStatusGroup] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ tickets: ItTicket[]; counts: Record<string, number>; canAssign: boolean }>(
        "/api/it/tickets",
        undefined,
        { toast: false },
      );
      setTickets(res.tickets);
    } catch {
      showErrorToast("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [showErrorToast]);

  useEffect(() => { void fetchTickets(); }, [fetchTickets]);

  const filteredTickets = useMemo(() => {
    let list = tickets;
    if (statusGroup) {
      const group = STATUS_GROUPS.find((g) => g.key === statusGroup);
      if (group?.statuses) {
        list = list.filter((t) => group.statuses!.includes(t.status));
      }
    }
    const q = searchInput.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.ticketNumber.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tickets, statusGroup, searchInput]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { "": tickets.length };
    for (const group of STATUS_GROUPS) {
      if (group.statuses) {
        c[group.key] = tickets.filter((t) => group.statuses!.includes(t.status)).length;
      }
    }
    return c;
  }, [tickets]);

  async function handleCancelTicket() {
    if (!cancellingId || !cancelReason) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/it/tickets/${cancellingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancelReason }),
      });
      setCancellingId(null);
      setCancelReason("");
      await fetchTickets();
    } catch {
      showErrorToast("Failed to cancel ticket");
    } finally {
      setCancelling(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950 dark:bg-[#1a1a1a] dark:text-zinc-100">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 dark:border-zinc-800 dark:bg-[#000000]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                href="/profile"
              >
                <ArrowLeft size={16} />
                Profile
              </Link>
              <h2 className="text-2xl font-semibold tracking-normal">
                My IT Tickets
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {tickets.length} tickets
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-zinc-400">
              View and manage your IT support requests.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              onClick={() => setShowNewTicket(true)}
              type="button"
            >
              <Plus size={16} />
              New Ticket
            </button>
          </div>
        </div>

        {/* Search + Status tabs */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-950 focus:ring-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              placeholder="Search tickets..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/60">
            {STATUS_GROUPS.map((group) => (
              <button
                key={group.key}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusGroup === group.key
                    ? "bg-slate-950 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
                onClick={() => setStatusGroup(group.key)}
                type="button"
              >
                {group.label}
                {counts[group.key] !== undefined && (
                  <span className="ml-1 opacity-60">{counts[group.key]}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex h-[50vh] items-center justify-center">
            <Loader2 size={32} className="animate-spin text-slate-400" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-zinc-800">
              <Ticket size={32} className="text-slate-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">
              {tickets.length === 0 ? "No tickets yet" : "No tickets match your search"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
              {tickets.length === 0
                ? "Create a new ticket to get IT support."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTickets.map((ticket) => {
              const requesterEmail =
                typeof ticket.requester === "string" ? "" : ticket.requester.email?.toLowerCase();
              const sessionEmail = session?.user?.email?.toLowerCase();
              const isMyTicket =
                requesterId(ticket.requester) === currentUserId ||
                Boolean(requesterEmail && sessionEmail && requesterEmail === sessionEmail);
              const canCancel = isMyTicket && CANCEL_ALLOWED_STATUSES.includes(ticket.status);
              const isCancellingThis = cancellingId === ticket.id;
              return (
                <div
                  key={ticket.id}
                  className="rounded-lg border border-slate-200 bg-white transition-colors dark:border-zinc-700 dark:bg-[#000000]"
                >
                  <div className="flex w-full items-center gap-4 px-4 py-3">
                    <button
                      className="flex min-w-0 flex-1 items-center gap-4 text-left hover:bg-slate-50 dark:hover:bg-zinc-900"
                      onClick={() => setSelectedTicket(ticket)}
                      type="button"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 dark:text-zinc-500">
                            {ticket.ticketNumber}
                          </span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${IT_PRIORITY_COLORS[ticket.priority]}`}>
                            {IT_PRIORITY_LABELS[ticket.priority]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-zinc-200">
                          {ticket.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                          {IT_CATEGORY_LABELS[ticket.category]} &middot; {formatDate(ticket.createdAt)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${IT_STATUS_COLORS[ticket.status]}`}>
                        {IT_STATUS_LABELS[ticket.status]}
                      </span>
                    </button>
                    {canCancel && !isCancellingThis && (
                      <button
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/40"
                        onClick={() => {
                          setCancellingId(ticket.id);
                          setCancelReason("");
                        }}
                        type="button"
                      >
                        <XCircle size={13} />
                        Withdraw
                      </button>
                    )}
                    {canCancel && isCancellingThis && (
                      <div className="flex shrink-0 items-center gap-2">
                        <select
                          className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          disabled={cancelling}
                        >
                          <option value="">Reason...</option>
                          {IT_CANCEL_REASONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={cancelling || !cancelReason}
                          onClick={handleCancelTicket}
                          type="button"
                        >
                          {cancelling ? "..." : "Confirm"}
                        </button>
                        <button
                          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          disabled={cancelling}
                          onClick={() => setCancellingId(null)}
                          type="button"
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {selectedTicket && (
        <ItTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={fetchTickets}
          actorRole={actorRole}
        />
      )}

      {showNewTicket && (
        <NewTicketModal
          onClose={() => setShowNewTicket(false)}
          onCreated={async () => {
            setShowNewTicket(false);
            await fetchTickets();
          }}
        />
      )}
    </div>
  );
}
