"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  Loader2,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { ItKanbanBoard, ProcurementBoard } from "./it-kanban-board";
import { ItTicketModal } from "./it-ticket-modal";
import { NewTicketModal } from "./new-ticket-modal";
import {
  type ItTicket,
  type ItTeamMember,
  type ItTicketStatus,
  type ItTicketPriority,
  type ItTicketCategory,
  type ProcurementRequest,
  IT_STATUS_LABELS,
  IT_CATEGORY_LABELS,
  IT_PRIORITY_LABELS,
  PROCUREMENT_CATEGORY_LABELS,
  ALL_IT_STATUSES,
  requesterName,
} from "./it-types";

function formatMoney(value: number, currency: string) {
  return `${(Number(value) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency || "INR"}`;
}

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

export function ItShell() {
  const { data: session } = useSession();
  const actorRole = String(session?.user?.role ?? "");

  const { showErrorToast } = useNotificationToast();
  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [purchases, setPurchases] = useState<ProcurementRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [canAssign, setCanAssign] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<ItTicket | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<ProcurementRequest | null>(null);

  const [team, setTeam] = useState<{ itAdmins: ItTeamMember[]; itStaff: ItTeamMember[] }>({ itAdmins: [], itStaff: [] });
  const assignees = useMemo(() => [...team.itStaff], [team]);

  const [statusFilter, setStatusFilter] = useState<ItTicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<ItTicketPriority | "">("");
  const [categoryFilter, setCategoryFilter] = useState<ItTicketCategory | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [board, setBoard] = useState<"tickets" | "purchases">("tickets");

  const [showNewTicket, setShowNewTicket] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
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
      setCounts(ticketRes.counts);
      setCanAssign(ticketRes.canAssign);
      setPurchases(purchaseRes.requests);
    } catch { /* ignore */ }
  }, []);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await apiFetch<{ itAdmins: ItTeamMember[]; itStaff: ItTeamMember[] }>(
        "/api/it/team",
        undefined,
        { toast: false },
      );
      setTeam(res);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTickets(), fetchTeam()]);
    setLoading(false);
  }, [fetchTickets, fetchTeam]);

  useEffect(() => { void fetchAll(); }, []);

  const filteredTickets = useMemo(() => {
    let list = tickets;
    if (statusFilter) list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter) list = list.filter((t) => t.priority === priorityFilter);
    if (categoryFilter) list = list.filter((t) => t.category === categoryFilter);
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.ticketNumber.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tickets, statusFilter, priorityFilter, categoryFilter, searchQuery]);

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
                IT Support
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {tickets.length} tickets
              </span>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                {purchases.length} purchases
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-zinc-400">
              Manage support tickets and track purchase requests.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/60">
              {(["tickets", "purchases"] as const).map((b) => (
                <button
                  key={b}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    board === b
                      ? "bg-slate-950 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                  onClick={() => setBoard(b)}
                  type="button"
                >
                  {b === "tickets" ? "Tickets" : "Purchases"}
                </button>
              ))}
            </div>
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

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-950 focus:ring-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              placeholder="Search tickets..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearchQuery(searchInput.trim());
              }}
            />
          </div>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ItTicketStatus | "")}
          >
            <option value="">All Status</option>
            {ALL_IT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {IT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as ItTicketPriority | "")}
          >
            <option value="">All Priority</option>
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {IT_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ItTicketCategory | "")}
          >
            <option value="">All Categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {IT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="flex h-[60vh] items-center justify-center">
              <Loader2 size={32} className="animate-spin text-slate-400" />
            </div>
          ) : board === "purchases" ? (
            <ProcurementBoard
              requests={purchases}
              onSelect={setSelectedPurchase}
            />
          ) : (
            <ItKanbanBoard
              tickets={filteredTickets}
              onSelectTicket={setSelectedTicket}
              canAssign={canAssign}
            />
          )}
        </div>
      </div>

      {/* Ticket Modal */}
      {selectedTicket && (
        <ItTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={fetchTickets}
          actorRole={actorRole}
          assignees={assignees}
          requesterCanConfirm={
            Boolean(session?.user?.id) &&
            typeof selectedTicket.requester !== "string" &&
            selectedTicket.requester.id === session?.user?.id
          }
        />
      )}

      {/* New Ticket Modal */}
      {showNewTicket && (
        <NewTicketModal
          onClose={() => setShowNewTicket(false)}
          onCreated={async () => {
            setShowNewTicket(false);
            await fetchTickets();
          }}
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
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                {formatMoney(selectedPurchase.amount, selectedPurchase.currency)}
                {selectedPurchase.quantity > 1 ? ` × ${selectedPurchase.quantity}` : ""}
              </span>
            </div>
            {selectedPurchase.reason && (
              <p className="mt-3 text-sm text-slate-600 dark:text-zinc-300">
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
          </div>
        </div>
      )}
    </div>
  );
}
