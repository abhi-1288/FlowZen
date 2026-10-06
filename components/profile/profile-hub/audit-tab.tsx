import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Cpu,
  Download,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { EmptyState, SectionHeader } from "./shared";

type AuditItem = {
  id: string;
  action: string;
  actionLabel: string;
  actor?: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  target?: string;
  targetName: string;
  entityType: string;
  entityId: string;
  from?: unknown;
  to?: unknown;
  metadata: Record<string, unknown>;
  ip: string;
  device: string;
  result: "success" | "failed";
  createdAt: string;
};

type AuditResponse = {
  items: AuditItem[];
  total: number;
  page: number;
  limit: number;
};

const CATEGORIES: { prefix: string; label: string }[] = [
  { prefix: "auth.", label: "Authentication" },
  { prefix: "member.", label: "Members" },
  { prefix: "it.", label: "IT" },
  { prefix: "company.", label: "Company settings" },
  { prefix: "data.", label: "Exports & documents" },
  { prefix: "approval.", label: "Approvals" },
];

const ICONS: Record<string, typeof ShieldCheck> = {
  "auth.": ShieldCheck,
  "member.": UserCog,
  "it.": Cpu,
  "company.": Building2,
  "data.": Download,
  "approval.": CheckCircle2,
};

function iconFor(action: string) {
  const prefix = Object.keys(ICONS).find((key) => action.startsWith(key));
  const Icon = prefix ? ICONS[prefix] : KeyRound;
  return Icon;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function scalar(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return value.toLocaleString("en-IN");
  return String(value);
}

function prettyAction(action: string) {
  const label = action.replace(/\./g, " ").replace(/-/g, " ");
  return label.length ? label.charAt(0).toUpperCase() + label.slice(1) : action;
}

export function AuditTab() {
  const limit = 25;
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [failedTotal, setFailedTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q) params.set("q", q);
    if (category) params.set("action", category);
    if (result) params.set("result", result);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const failedParams = new URLSearchParams(params.toString());
    failedParams.set("result", "failed");
    failedParams.set("page", "1");

    Promise.all([
      apiFetch<AuditResponse>(`/api/profile/audit?${params.toString()}`),
      apiFetch<AuditResponse>(`/api/profile/audit?${failedParams.toString()}`).catch(() => null),
    ])
      .then(([data, failedData]) => {
        if (!active) return;
        setItems(data.items);
        setTotal(data.total);
        setFailedTotal(Number(failedData?.total ?? 0));
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load the audit log.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [q, category, result, from, to, page, limit, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function submitSearch() {
    setPage(1);
    setQ(query.trim());
  }

  function selectCategory(prefix: string) {
    setPage(1);
    setCategory((current) => (current === prefix ? "" : prefix));
  }

  const inputClass =
    "rounded-lg border border-[var(--c-border-light)] bg-[var(--c-bg-input)] px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-indigo-400/60 dark:border-zinc-700 dark:bg-[#1f1f1f] dark:text-zinc-200";

  return (
    <section className="rounded-xl neu-card p-5 dark:border-zinc-800 dark:bg-[#000000]">
      <SectionHeader
        title="Audit &amp; Security Center"
        description="Searchable record of security, administrative, and approval events."
        action={
          <button
            aria-label="Refresh audit log"
            className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--c-border-light)] bg-[var(--c-bg-muted)] text-slate-600 transition hover:bg-[var(--c-bg-hover)] dark:border-zinc-700 dark:bg-[#161616] dark:text-zinc-300 dark:hover:bg-zinc-700"
            onClick={() => setRefreshKey((current) => current + 1)}
            title="Refresh"
            type="button"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              className={`${inputClass} w-full pl-9`}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, or action..."
              value={query}
            />
          </div>
          <button
            className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-sm font-medium"
            onClick={submitSearch}
            type="button"
          >
            Search
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <button
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                category === ""
                  ? "bg-indigo-600 text-white"
                  : "bg-[var(--c-bg-muted)] text-slate-600 hover:bg-[var(--c-bg-hover)] dark:text-zinc-300"
              }`}
              onClick={() => selectCategory("")}
              type="button"
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  category === cat.prefix
                    ? "bg-indigo-600 text-white"
                    : "bg-[var(--c-bg-muted)] text-slate-600 hover:bg-[var(--c-bg-hover)] dark:text-zinc-300"
                }`}
                key={cat.prefix}
                onClick={() => selectCategory(cat.prefix)}
                type="button"
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} py-1.5`}
              onChange={(event) => {
                setPage(1);
                setResult(event.target.value);
              }}
              value={result}
            >
              <option value="">All results</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
            </select>
            <input
              aria-label="From date"
              className={`${inputClass} py-1.5`}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
              type="date"
              value={from}
            />
            <input
              aria-label="To date"
              className={`${inputClass} py-1.5`}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
              type="date"
              value={to}
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        {!error && !loading ? (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-xs">
            <div className="rounded-xl neu-inset p-3 text-center">
              <p className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
                {total.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Events
              </p>
            </div>
            <div className="rounded-xl neu-inset p-3 text-center">
              <p
                className={`text-xl font-semibold ${
                  failedTotal > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-900 dark:text-zinc-100"
                }`}
              >
                {failedTotal.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Failed
              </p>
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-sm">Loading audit log...</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState message="No audit events match your filters." />
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = iconFor(item.action);
              const who = item.actorName || item.actorEmail || "System";
              const hasDiff = item.from !== null && item.from !== undefined ||
                item.to !== null && item.to !== undefined;
              return (
                <div
                  className="rounded-xl neu-card px-4 py-3"
                  key={item.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                          item.result === "failed"
                            ? "bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-300"
                            : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-300"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-medium text-slate-900 dark:text-zinc-100">
                            {item.actionLabel || prettyAction(item.action)}
                          </p>
                          {item.result === "failed" ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                              Failed
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                              Successful
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
                          <span className="font-medium text-slate-700 dark:text-zinc-300">{who}</span>
                          {item.actorRole ? <span className="text-slate-400"> · {item.actorRole}</span> : null}
                          {item.targetName ? (
                            <span className="text-slate-400"> → {item.targetName}</span>
                          ) : null}
                        </p>
                        {item.entityType ? (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {item.entityType}
                            {item.entityId ? ` · ${item.entityId}` : ""}
                          </p>
                        ) : null}
                        {hasDiff ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-md bg-[var(--c-bg-muted)] px-2 py-1 font-mono text-slate-500 dark:text-zinc-400">
                              From: {scalar(item.from)}
                            </span>
                            <span className="rounded-md bg-[var(--c-bg-muted)] px-2 py-1 font-mono text-slate-500 dark:text-zinc-400">
                              To: {scalar(item.to)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                        {formatDate(item.createdAt)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.ip ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {item.ip}
                          </span>
                        ) : null}
                        {item.device ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {item.device}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!error && !loading && items.length > 0 ? (
        <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {total} {total === 1 ? "event" : "events"} · Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              className="neu-btn rounded-lg px-4 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="neu-btn rounded-lg px-4 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}