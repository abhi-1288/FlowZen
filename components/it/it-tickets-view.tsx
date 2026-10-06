"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  Ticket,
  X,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { ItTicketModal } from "./it-ticket-modal";
import { NewTicketModal } from "./new-ticket-modal";
import { RequestPurchaseModal } from "./request-purchase-modal";
import {
  type ItTicket,
  type ItTicketCategory,
  type ItTicketPriority,
  type ItTicketStatus,
  type ProcurementRequest,
  type ProcurementStatus,
  IT_STATUS_LABELS,
  IT_STATUS_COLORS,
  IT_CATEGORY_LABELS,
  IT_PRIORITY_LABELS,
  IT_PRIORITY_COLORS,
  IT_CANCEL_REASONS,
  PROCUREMENT_STATUS_LABELS,
  PROCUREMENT_STATUS_COLORS,
  PROCUREMENT_CATEGORY_LABELS,
  requesterId,
  requesterName,
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

type StatusFilter = { key: string; label: string; statuses?: readonly string[] };
const STATUS_GROUPS: StatusFilter[] = [
  { key: "", label: "All" },
  { key: "open", label: "Open", statuses: ["PENDING", "ASSIGNED", "QUEUED", "IN_PROGRESS", "WAITING_FOR_USER"] },
  { key: "awaiting", label: "Awaiting", statuses: ["AWAITING_CONFIRMATION"] },
  { key: "resolved", label: "Resolved", statuses: ["RESOLVED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

const PURCHASE_STATUS_GROUPS: StatusFilter[] = [
  { key: "", label: "All" },
  { key: "open", label: "With IT", statuses: ["PENDING_IT", "ASSIGNED_IT"] },
  { key: "awaiting", label: "With finance", statuses: ["IT_APPROVED", "ACCEPTED_FIN"] },
  { key: "paid", label: "Paid", statuses: ["DISBURSED"] },
  { key: "closed", label: "Closed", statuses: ["REJECTED_IT", "REJECTED_FIN", "CANCELLED"] },
];

export function ItTicketsView() {
  const { data: session } = useSession();
  const actorRole = String(session?.user?.role ?? "");
  const currentUserId = String(session?.user?.id ?? "");
  const { showErrorToast } = useNotificationToast();

  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [purchases, setPurchases] = useState<ProcurementRequest[]>([]);
  const [canDecide, setCanDecide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<ItTicket | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<ProcurementRequest | null>(null);
  const [view, setView] = useState<"tickets" | "purchases">("tickets");
  const [statusGroup, setStatusGroup] = useState<string>("");
  const [purchaseStatusGroup, setPurchaseStatusGroup] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [purchaseSearchInput, setPurchaseSearchInput] = useState("");

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);
  const [actingStatus, setActingStatus] = useState<string>("");
  const [actingReason, setActingReason] = useState("");
  const [acting, setActing] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const [ticketRes, purchaseRes] = await Promise.all([
        apiFetch<{ tickets: ItTicket[]; counts: Record<string, number>; canAssign: boolean }>(
          "/api/it/tickets",
          undefined,
          { toast: false },
        ),
        apiFetch<{ requests: ProcurementRequest[]; counts: Record<string, number>; canDecide: boolean }>(
          "/api/procurement",
          undefined,
          { toast: false },
        ),
      ]);
      setTickets(ticketRes.tickets);
      setPurchases(purchaseRes.requests);
      setCanDecide(purchaseRes.canDecide);
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

  async function handleActOnPurchase() {
    if (!actingId || !actingStatus) return;
    setActing(true);
    try {
      await apiFetch(`/api/procurement/${actingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: actingStatus,
          ...(actingReason ? { rejectionReason: actingReason, cancelReason: actingReason } : {}),
        }),
      });
      setActingId(null);
      setActingStatus("");
      setActingReason("");
      await fetchTickets();
    } catch {
      showErrorToast("Failed to update purchase request");
    } finally {
      setActing(false);
    }
  }

  function isOwnPurchase(req: ProcurementRequest): boolean {
    return requesterId(req.requester) === currentUserId;
  }

  const canWithdraw = (req: ProcurementRequest) =>
    isOwnPurchase(req) &&
    ["PENDING_IT", "ASSIGNED_IT"].includes(req.status);

  const itDecision = (req: ProcurementRequest): { label: string; status: ProcurementStatus }[] => {
    const options: { label: string; status: ProcurementStatus }[] = [];
    if (req.status === "PENDING_IT" || req.status === "ASSIGNED_IT") {
      options.push({ label: "Approve & send to finance", status: "IT_APPROVED" });
      options.push({ label: "Reject", status: "REJECTED_IT" });
    }
    return options;
  };

  const filteredPurchases = useMemo(() => {
    let list = purchases;
    if (purchaseStatusGroup) {
      const group = PURCHASE_STATUS_GROUPS.find((g) => g.key === purchaseStatusGroup);
      if (group?.statuses) {
        list = list.filter((r) => group.statuses!.includes(r.status));
      }
    }
    const q = purchaseSearchInput.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.requestNumber.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [purchases, purchaseStatusGroup, purchaseSearchInput]);

  const purchaseCounts = useMemo(() => {
    const c: Record<string, number> = { "": purchases.length };
    for (const group of PURCHASE_STATUS_GROUPS) {
      if (group.statuses) {
        c[group.key] = purchases.filter((r) => group.statuses!.includes(r.status)).length;
      }
    }
    return c;
  }, [purchases]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatMoney(value: number, currency: string) {
    return `${(Number(value) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency || "INR"}`;
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950 dark:bg-[#1a1a1a] dark:text-zinc-100">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 dark:border-zinc-800 dark:bg-[#000000]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-normal">
                IT Support &amp; Purchases
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {tickets.length} tickets
              </span>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                {purchases.length} purchases
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-zinc-400">
              Raise support tickets, and request laptops, software, electronics and
              connectivity. Purchases are reviewed by IT, then paid by finance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              onClick={() => setShowNewPurchase(true)}
              type="button"
            >
              <Plus size={16} />
              Request Purchase
            </button>
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

        <div className="mt-4">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:max-w-xs dark:border-zinc-700 dark:bg-zinc-800/60">
            {(["tickets", "purchases"] as const).map((v) => (
              <button
                key={v}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v
                    ? "bg-slate-950 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
                onClick={() => setView(v)}
                type="button"
              >
                {v === "tickets"
                  ? `Tickets${tickets.length ? ` (${tickets.length})` : ""}`
                  : `Purchases${purchases.length ? ` (${purchases.length})` : ""}`}
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
        ) : (
          <div className="space-y-10">
            {view === "tickets" ? (
              <section>
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                    Support tickets
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                    Login, access, hardware, network and email issues.
                  </p>
                </div>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
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
                {filteredTickets.length === 0 ? (
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
              </section>
            ) : (
              <section>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                    Purchase requests
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                    Laptops, desktops, software, electronics, internet and email.
                    IT reviews, then finance pays.
                  </p>
                </div>
              </div>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-950 focus:ring-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    placeholder="Search purchases..."
                    value={purchaseSearchInput}
                    onChange={(e) => setPurchaseSearchInput(e.target.value)}
                  />
                </div>
                <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/60">
                  {PURCHASE_STATUS_GROUPS.map((group) => (
                    <button
                      key={group.key}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        purchaseStatusGroup === group.key
                          ? "bg-slate-950 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      }`}
                      onClick={() => setPurchaseStatusGroup(group.key)}
                      type="button"
                    >
                      {group.label}
                      {purchaseCounts[group.key] !== undefined && (
                        <span className="ml-1 opacity-60">{purchaseCounts[group.key]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {filteredPurchases.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center dark:border-zinc-700">
                  <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">
                    {purchases.length === 0 ? "No purchase requests yet" : "No purchases match your search"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
                    {purchases.length === 0
                      ? "Use “Request Purchase” to ask for equipment."
                      : "Try a different search or filter."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPurchases.map((req) => {
                    const decisions = canDecide ? itDecision(req) : [];
                    const isActingThis = actingId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="rounded-lg border border-slate-200 bg-white transition-colors dark:border-zinc-700 dark:bg-[#000000]"
                      >
                        <div className="flex w-full items-center gap-4 px-4 py-3">
                          <button
                            className="flex min-w-0 flex-1 items-center gap-4 text-left hover:bg-slate-50 dark:hover:bg-zinc-900"
                            onClick={() => setSelectedPurchase(req)}
                            type="button"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-400 dark:text-zinc-500">
                                  {req.requestNumber}
                                </span>
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                  {PROCUREMENT_CATEGORY_LABELS[req.category]}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-zinc-200">
                                {req.title}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                                {formatMoney(req.amount, req.currency)}
                                {req.quantity > 1 ? ` × ${req.quantity}` : ""}
                                {req.vendor ? ` · ${req.vendor}` : ""} · {formatDate(req.createdAt)}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${PROCUREMENT_STATUS_COLORS[req.status]}`}>
                              {PROCUREMENT_STATUS_LABELS[req.status]}
                            </span>
                          </button>
                          {canWithdraw(req) && !isActingThis && (
                            <button
                              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/40"
                              onClick={() => {
                                setActingId(req.id);
                                setActingStatus("CANCELLED");
                                setActingReason("");
                              }}
                              type="button"
                            >
                              <XCircle size={13} />
                              Withdraw
                            </button>
                          )}
                          {decisions.length > 0 && !isActingThis && (
                            <div className="flex shrink-0 items-center gap-1.5">
                              {decisions.map((d) => (
                                <button
                                  key={d.status}
                                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                                    d.status === "IT_APPROVED"
                                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                      : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                                  }`}
                                  onClick={() => {
                                    setActingId(req.id);
                                    setActingStatus(d.status);
                                    setActingReason("");
                                  }}
                                  type="button"
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {isActingThis && (
                            <div className="flex shrink-0 items-center gap-2">
                              {actingStatus !== "IT_APPROVED" && (
                                <input
                                  className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                  placeholder="Reason"
                                  value={actingReason}
                                  onChange={(e) => setActingReason(e.target.value)}
                                  disabled={acting}
                                />
                              )}
                              <button
                                className="shrink-0 rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                                disabled={acting || (actingStatus !== "IT_APPROVED" && !actingReason)}
                                onClick={handleActOnPurchase}
                                type="button"
                              >
                                {acting ? "..." : "Confirm"}
                              </button>
                              <button
                                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                disabled={acting}
                                onClick={() => {
                                  setActingId(null);
                                  setActingStatus("");
                                  setActingReason("");
                                }}
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
              </section>
            )}
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

      {selectedPurchase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedPurchase(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-[#111]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-slate-400 dark:text-zinc-500">
                  {selectedPurchase.requestNumber}
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-zinc-100">
                  {selectedPurchase.title}
                </h3>
              </div>
              <button
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                onClick={() => setSelectedPurchase(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                {PROCUREMENT_CATEGORY_LABELS[selectedPurchase.category]}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PROCUREMENT_STATUS_COLORS[selectedPurchase.status]}`}>
                {PROCUREMENT_STATUS_LABELS[selectedPurchase.status]}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                {formatMoney(selectedPurchase.amount, selectedPurchase.currency)}
                {selectedPurchase.quantity > 1 ? ` × ${selectedPurchase.quantity}` : ""}
              </span>
            </div>

            {selectedPurchase.vendor && (
              <p className="mt-3 text-sm text-slate-600 dark:text-zinc-300">
                <span className="font-medium">Vendor:</span> {selectedPurchase.vendor}
              </p>
            )}
            {selectedPurchase.reason && (
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
                {selectedPurchase.reason}
              </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400 dark:text-zinc-500">Requested by</dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-zinc-200">
                  {requesterName(selectedPurchase.requester)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 dark:text-zinc-500">Region</dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-zinc-200">
                  {selectedPurchase.regionLabel || "Company-wide"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 dark:text-zinc-500">IT reviewer</dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-zinc-200">
                  {selectedPurchase.itAssignedTo?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 dark:text-zinc-500">Finance</dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-zinc-200">
                  {selectedPurchase.financeAssignedTo?.name ?? "—"}
                </dd>
              </div>
            </dl>

            {selectedPurchase.itRejectionReason && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                Rejected by IT: {selectedPurchase.itRejectionReason}
              </p>
            )}
            {selectedPurchase.financeRejectionReason && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                Rejected by finance: {selectedPurchase.financeRejectionReason}
              </p>
            )}

            {selectedPurchase.activity && selectedPurchase.activity.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                  Activity
                </h4>
                <ul className="mt-2 space-y-2">
                  {selectedPurchase.activity.map((a, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium text-slate-800 dark:text-zinc-200">
                        {a.action}
                      </span>
                      {a.detail && (
                        <span className="text-slate-500 dark:text-zinc-400"> — {a.detail}</span>
                      )}
                      <span className="ml-2 text-xs text-slate-400 dark:text-zinc-500">
                        {formatDate(a.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
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

      {showNewPurchase && (
        <RequestPurchaseModal
          onClose={() => setShowNewPurchase(false)}
          onCreated={async () => {
            setShowNewPurchase(false);
            await fetchTickets();
          }}
        />
      )}
    </div>
  );
}
