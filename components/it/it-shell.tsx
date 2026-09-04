"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { ItKanbanBoard } from "./it-kanban-board";
import { ItTicketModal } from "./it-ticket-modal";
import { NewTicketModal } from "./new-ticket-modal";
import {
  type ItTicket,
  type ItTeamMember,
  type ItTicketStatus,
  type ItTicketPriority,
  type ItTicketCategory,
  IT_STATUS_LABELS,
  IT_CATEGORY_LABELS,
  IT_PRIORITY_LABELS,
  ALL_IT_STATUSES,
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

export function ItShell() {
  const { data: session } = useSession();
  const actorRole = String(session?.user?.role ?? "");

  const { showErrorToast } = useNotificationToast();
  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [canAssign, setCanAssign] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<ItTicket | null>(null);

  const [team, setTeam] = useState<{ itAdmins: ItTeamMember[]; itStaff: ItTeamMember[] }>({ itAdmins: [], itStaff: [] });
  const assignees = useMemo(
    () => [...team.itAdmins, ...team.itStaff],
    [team],
  );

  const [statusFilter, setStatusFilter] = useState<ItTicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<ItTicketPriority | "">("");
  const [categoryFilter, setCategoryFilter] = useState<ItTicketCategory | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [showNewTicket, setShowNewTicket] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await apiFetch<{ tickets: ItTicket[]; counts: Record<string, number>; canAssign: boolean }>(
        "/api/it/tickets",
        undefined,
        { toast: false },
      );
      setTickets(res.tickets);
      setCounts(res.counts);
      setCanAssign(res.canAssign);
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
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-zinc-400">
              Manage support tickets and track requests.
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
    </div>
  );
}
