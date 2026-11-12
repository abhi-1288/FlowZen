"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MinusCircle,
  Plus,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { TEAM_COMPACTION_STATUSES } from "@/lib/work-constants";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorNote,
  formatDate,
  formatDateTime,
  inputClass,
  labelClass,
  LoadingRows,
  Modal,
  PanelHeader,
  StatusPill,
  type TeamCompactionRecord,
} from "./common";

type TeamSource = {
  id: string;
  employeeCompaction: string | { id?: string; _id?: string; compactionType?: string; reportingDate?: string; status?: string; summary?: string };
  employee?: { id?: string; name?: string } | string | null;
  employeeName?: string;
  compactionType?: string;
  reportingDate?: string | null;
  inclusionStatus?: "included" | "excluded" | string;
  exclusionReason?: string;
  sourceSummary?: string;
  sourceContent?: Record<string, any>;
  todos?: Record<string, any>[];
  createdAt?: string;
};

type DeliveryRecord = {
  id: string;
  deliveryChannel: "in_app" | "email";
  deliveryStatus: string;
  recipientName?: string;
  errorDetails?: string;
  deliveredAt?: string | null;
};

type TeamDetail = {
  compaction: TeamCompactionRecord & Record<string, any>;
  sources: TeamSource[];
  deliveries: DeliveryRecord[];
  revisions: Record<string, any>[];
  permissions: { canEdit: boolean; canSubmit: boolean; canReview: boolean; isTeamOwner: boolean };
};

type TeamOption = { id: string; name: string };

function sourceCompactionId(source: TeamSource): string {
  if (typeof source.employeeCompaction === "string") return source.employeeCompaction;
  return String(source.employeeCompaction?.id ?? source.employeeCompaction?._id ?? "");
}

function sourceEmployeeName(source: TeamSource): string {
  if (source.employeeName) return source.employeeName;
  if (source.employee && typeof source.employee === "object") return String(source.employee.name ?? "");
  return "Team member";
}

export function TeamCompactionsPanel({
  defaultScope = "owned",
  focusId = "",
}: {
  defaultScope?: "owned" | "received" | "team";
  focusId?: string;
}) {
  const { showSuccessToast } = useNotificationToast();
  const [scope, setScope] = useState(defaultScope);
  const [statusFilter, setStatusFilter] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [compactions, setCompactions] = useState<TeamCompactionRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ teamId: "", periodStart: "", periodEnd: "" });
  const [expanded, setExpanded] = useState<string>(focusId);

  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    overallSummary: "",
    nextPeriodPlan: "",
    adminSupportRequired: "",
  });
  const [reviewBody, setReviewBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ scope, limit: "150" });
      if (statusFilter) query.set("status", statusFilter);
      const result = await apiFetch<{
        compactions: TeamCompactionRecord[];
        teams: TeamOption[];
        counts: Record<string, number>;
      }>(`/api/team-compactions?${query.toString()}`, undefined, { toast: false });
      setCompactions(result.compactions ?? []);
      setTeams(result.teams ?? []);
      setCounts(result.counts ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load team compactions.");
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setExpanded(id);
    setDetailLoading(true);
    setEditing(false);
    try {
      const result = await apiFetch<TeamDetail>(`/api/team-compactions/${id}`, undefined, { toast: false });
      setDetail(result);
      setDraft({
        overallSummary: String(result.compaction.content?.overallSummary ?? ""),
        nextPeriodPlan: String(result.compaction.content?.nextPeriodPlan ?? ""),
        adminSupportRequired: String(result.compaction.content?.adminSupportRequired ?? ""),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the team compaction.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focusId) void openDetail(focusId);
  }, [focusId, openDetail]);

  async function createDraft() {
    if (!createForm.teamId) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ compaction: TeamCompactionRecord }>("/api/team-compactions", {
        method: "POST",
        body: JSON.stringify({
          teamId: createForm.teamId,
          periodStart: createForm.periodStart || undefined,
          periodEnd: createForm.periodEnd || undefined,
        }),
      });
      showSuccessToast("Team consolidation draft created.");
      setCreateOpen(false);
      await load();
      await openDetail(result.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  async function saveDetail() {
    if (!detail) return;
    setBusy(true);
    try {
      await apiFetch(`/api/team-compactions/${detail.compaction.id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      showSuccessToast("Team consolidation saved.");
      setEditing(false);
      await openDetail(detail.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  async function submitDetail() {
    if (!detail) return;
    setBusy(true);
    try {
      await apiFetch(`/api/team-compactions/${detail.compaction.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          overallSummary: draft.overallSummary,
          nextPeriodPlan: draft.nextPeriodPlan,
          adminSupportRequired: draft.adminSupportRequired,
        }),
      });
      showSuccessToast("Team compaction submitted to the Admin and Board-Task Owners.");
      await load();
      await openDetail(detail.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  async function toggleSource(source: TeamSource, include: boolean) {
    if (!detail) return;
    const id = sourceCompactionId(source);
    if (!id) return;
    const reason = include
      ? ""
      : window.prompt("Why is this employee report excluded? The reason is kept in the audit trail.") ?? "";
    if (!include && !reason.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/team-compactions/${detail.compaction.id}/sources`, {
        method: "PATCH",
        body: JSON.stringify({
          sources: [
            {
              employeeCompactionId: id,
              inclusionStatus: include ? "included" : "excluded",
              exclusionReason: reason,
            },
          ],
        }),
      });
      showSuccessToast(include ? "Report included in the consolidation." : "Report excluded with a recorded reason.");
      await openDetail(detail.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  async function review(action: "comment" | "acknowledged" | "correction_requested" | "follow_up") {
    if (!detail) return;
    setBusy(true);
    try {
      await apiFetch(`/api/team-compactions/${detail.compaction.id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, body: reviewBody }),
      });
      showSuccessToast("Team compaction review saved.");
      setReviewBody("");
      await openDetail(detail.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(
    () => compactions.filter((item) => !statusFilter || item.status === statusFilter),
    [compactions, statusFilter],
  );

  return (
    <div className="space-y-4">
      <Card>
        <PanelHeader
          title="Team compactions"
          description="Consolidate confirmed employee reports. Source links, ownership and exclusion reasons stay attached to the team report."
          actions={
            <>
              <button className={btnSecondary} onClick={() => void load()} type="button">
                <RefreshCw size={13} /> Refresh
              </button>
          {Number(counts.actionRequired ?? 0) > 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Needs attention: {Number(counts.actionRequired)}
            </span>
          ) : null}
              <button className={btnPrimary} onClick={() => setCreateOpen(true)} type="button">
                <Plus size={13} /> New consolidation
              </button>
            </>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {defaultScope === "owned" ? (
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-zinc-700">
              {(["owned", "team", "received"] as const).map((value) => (
                <button
                  key={value}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold capitalize transition ${
                    scope === value
                      ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => setScope(value)}
                  type="button"
                >
                  {value === "owned" ? "My teams" : value === "team" ? "All team" : "Received"}
                </button>
              ))}
            </div>
          ) : null}
          <select className={inputClass + " max-w-[220px]"} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {TEAM_COMPACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="Draft" value={counts.draft ?? 0} />
          <Metric label="Awaiting confirmation" value={counts.awaitingConfirmation ?? 0} />
          <Metric label="Submitted" value={counts.submitted ?? 0} />
          <Metric label="Corrections" value={counts.correctionRequested ?? 0} />
          <Metric label="Acknowledged" value={counts.acknowledged ?? 0} />
        </div>

        <ErrorNote message={error} />
        {loading ? <LoadingRows rows={4} /> : null}

        {!loading && filtered.length === 0 ? (
          <EmptyState
            title="No team compactions yet"
            description="Build a consolidation from the confirmed EOD/EOW reports of your team for the selected week."
            action={
              <button className={btnPrimary} onClick={() => setCreateOpen(true)} type="button">
                <Plus size={13} /> Build the first consolidation
              </button>
            }
          />
        ) : null}

        <div className="space-y-2">
          {filtered.map((item) => {
            const isOpen = expanded === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-xl border transition ${
                  isOpen
                    ? "border-slate-300 bg-slate-50/60 dark:border-zinc-600 dark:bg-zinc-900/60"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-[#0b0b0b] dark:hover:border-zinc-700"
                }`}
              >
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() => (isOpen ? setExpanded("") : void openDetail(item.id))}
                  type="button"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                    <Users size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {item.teamName || "Team"} · {formatDate(item.reportingPeriodStart)} – {formatDate(item.reportingPeriodEnd)}
                      </span>
                      <StatusPill status={item.status} />
                      {item.hasSourceCorrections ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                          Source corrections
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
                      {item.teamOwnerName || "Team Owner"} · {item.summary || "No overall summary yet"}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-200 px-4 py-4 dark:border-zinc-800">
                    {detailLoading ? (
                      <LoadingRows rows={2} />
                    ) : detail && detail.compaction.id === item.id ? (
                      <TeamDetailBody
                        detail={detail}
                        editing={editing}
                        draft={draft}
                        reviewBody={reviewBody}
                        busy={busy}
                        onEdit={() => setEditing(true)}
                        onCancel={() => setEditing(false)}
                        onSave={() => void saveDetail()}
                        onSubmit={() => void submitDetail()}
                        onToggleSource={(source, include) => void toggleSource(source, include)}
                        onReview={(action) => void review(action)}
                        setDraft={setDraft}
                        setReviewBody={setReviewBody}
                      />
                    ) : (
                      <p className="text-xs text-slate-500">Select the report again to reload it.</p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={createOpen} title="Build team consolidation" onClose={() => setCreateOpen(false)} wide>
        <div className="space-y-3">
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
            Only confirmed employee reports from the selected period are consolidated. Missing reports are listed explicitly, and each source keeps its link.
          </div>
          <div>
            <label className={labelClass}>Team</label>
            <select className={inputClass} value={createForm.teamId} onChange={(event) => setCreateForm({ ...createForm, teamId: event.target.value })}>
              <option value="">Select a team you own</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {!teams.length ? (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                You are not the Team Owner of any team yet, so there is nothing to consolidate.
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Period start (optional)</label>
              <input className={inputClass} type="date" value={createForm.periodStart} onChange={(event) => setCreateForm({ ...createForm, periodStart: event.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Period end (optional)</label>
              <input className={inputClass} type="date" value={createForm.periodEnd} onChange={(event) => setCreateForm({ ...createForm, periodEnd: event.target.value })} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Leave both dates empty to consolidate the current week.</p>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setCreateOpen(false)} type="button">
              Cancel
            </button>
            <button className={btnPrimary} disabled={busy || !createForm.teamId} onClick={() => void createDraft()} type="button">
              Build draft
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TeamDetailBody({
  detail,
  editing,
  draft,
  reviewBody,
  busy,
  onEdit,
  onCancel,
  onSave,
  onSubmit,
  onToggleSource,
  onReview,
  setDraft,
  setReviewBody,
}: {
  detail: TeamDetail;
  editing: boolean;
  draft: { overallSummary: string; nextPeriodPlan: string; adminSupportRequired: string };
  reviewBody: string;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onToggleSource: (source: TeamSource, include: boolean) => void;
  onReview: (action: "comment" | "acknowledged" | "correction_requested" | "follow_up") => void;
  setDraft: (value: { overallSummary: string; nextPeriodPlan: string; adminSupportRequired: string }) => void;
  setReviewBody: (value: string) => void;
}) {
  const compaction = detail.compaction;
  const content = compaction.content ?? {};
  const overview = content.overview ?? {};
  const metrics = content.metrics ?? {};
  const included = detail.sources.filter((source) => source.inclusionStatus !== "excluded");
  const excluded = detail.sources.filter((source) => source.inclusionStatus === "excluded");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={compaction.status} />
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          Revision {Number(compaction.revisionNumber ?? 1)} · {Number(overview.participatingEmployees ?? included.length)} reports included
        </span>
        {compaction.hasSourceCorrections ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertTriangle size={10} /> A source report has an open correction
          </span>
        ) : null}
      </div>

      {detail.permissions.canEdit || detail.permissions.canSubmit ? (
        <div className="flex flex-wrap items-center gap-2">
          {detail.permissions.canEdit ? (
            editing ? (
              <>
                <button className={btnPrimary} disabled={busy} onClick={onSave} type="button">
                  <Check size={13} /> Save consolidation
                </button>
                <button className={btnSecondary} disabled={busy} onClick={onCancel} type="button">
                  Cancel
                </button>
              </>
            ) : (
              <button className={btnSecondary} onClick={onEdit} type="button">
                Edit commentary
              </button>
            )
          ) : null}
          {detail.permissions.canSubmit ? (
            <button className={btnPrimary} disabled={busy} onClick={onSubmit} type="button">
              <Send size={13} /> Confirm & deliver to Admin
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-4">
        <Metric label="Completed" value={Number(metrics.totalCompleted ?? 0)} />
        <Metric label="Partial" value={Number(metrics.totalPartial ?? 0)} />
        <Metric label="Pending" value={Number(metrics.totalPending ?? 0)} />
        <Metric label="Blocked" value={Number(metrics.totalBlocked ?? 0)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Team overview</label>
          <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-zinc-950 dark:text-zinc-300">
            <p className="font-semibold">{String(overview.teamName ?? "")}</p>
            <p className="mt-0.5">Owner: {String(overview.teamOwnerName ?? compaction.teamOwnerName ?? "—")}</p>
            <p className="mt-0.5 inline-flex items-center gap-1">
              <CalendarRange size={11} /> {formatDate(compaction.reportingPeriodStart)} – {formatDate(compaction.reportingPeriodEnd)}
            </p>
          </div>
        </div>
        <div>
          <label className={labelClass}>Missing reports</label>
          <div className="min-h-[68px] rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-zinc-950 dark:text-zinc-300">
            {Array.isArray(overview.missingReports) && overview.missingReports.length ? (
              <ul className="space-y-1">
                {overview.missingReports.map((name: string) => (
                  <li className="flex items-center gap-1.5" key={name}>
                    <MinusCircle size={11} className="text-amber-500" /> {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400">Every expected team member has a report.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Overall summary</label>
        {editing ? (
          <textarea
            className={inputClass + " min-h-[90px] text-xs"}
            onChange={(event) => setDraft({ ...draft, overallSummary: event.target.value })}
            value={draft.overallSummary}
          />
        ) : (
          <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-zinc-950 dark:text-zinc-300">
            {draft.overallSummary || "No overall summary yet."}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Employee reports and sources
        </p>
        <div className="space-y-2">
          {detail.sources.map((source) => {
            const isExcluded = source.inclusionStatus === "excluded";
            return (
              <div
                className={`rounded-xl border px-3 py-2.5 ${
                  isExcluded
                    ? "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20"
                    : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                }`}
                key={source.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{sourceEmployeeName(source)}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {source.compactionType ?? "EOD"}
                  </span>
                  <span className="text-[10px] text-slate-400">{formatDate(source.reportingDate)}</span>
                  <Link
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                    href={`/profile/compactions?focus=${sourceCompactionId(source)}`}
                  >
                    <ExternalLink size={10} /> Source
                  </Link>
                  {detail.permissions.canEdit ? (
                    <button
                      className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                        isExcluded
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                      }`}
                      disabled={busy}
                      onClick={() => onToggleSource(source, isExcluded)}
                      type="button"
                    >
                      {isExcluded ? "Include" : "Exclude"}
                    </button>
                  ) : null}
                </div>
                {isExcluded ? (
                  <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">Excluded: {source.exclusionReason || "No reason recorded."}</p>
                ) : (
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-zinc-400">
                    {source.sourceSummary || "No summary provided."}
                  </p>
                )}
                {source.todos?.length ? (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 dark:bg-zinc-900">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Todos ({source.todos.length})</p>
                    <div className="mt-1 space-y-1">
                      {source.todos.map((todo, index) => (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-300" key={String(todo.id ?? todo._id ?? index)}>
                          <span className="font-medium">{String(todo.title ?? "Untitled todo")}</span>
                          <StatusPill status={String(todo.statusAtSubmission ?? todo.status ?? "pending")} />
                          <span className="text-slate-400">{Number(todo.progress ?? 0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {!detail.sources.length ? (
            <p className="text-xs text-slate-400">No employee reports were attached to this consolidation.</p>
          ) : null}
        </div>
        {excluded.length ? (
          <p className="mt-2 text-[10px] text-slate-400">{excluded.length} excluded report(s) recorded with an exclusion reason.</p>
        ) : null}
      </div>

      {Array.isArray(content.blockers) && content.blockers.length ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Blockers</p>
          <div className="space-y-1.5">
            {content.blockers.map((blocker: Record<string, any>, index: number) => (
              <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs dark:border-rose-900 dark:bg-rose-950/20" key={index}>
                <p className="font-medium text-rose-800 dark:text-rose-200">{String(blocker.summary ?? "")}</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-300">
                  Waiting on {String(blocker.waitingOn || "—")} · {Array.isArray(blocker.employees) ? blocker.employees.length : 0} contributor(s)
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {Array.isArray(content.pendingWork) && content.pendingWork.length ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Pending work</p>
          <div className="space-y-1.5">
            {content.pendingWork.map((item: Record<string, any>, index: number) => (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-zinc-800" key={index}>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{String(item.title ?? "")}</span>
                <span className="text-slate-400">{String(item.employee ?? "")}</span>
                {item.dueDate ? <span className="ml-auto text-[10px] text-slate-400">Due {formatDate(item.dueDate)}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Next period plan</label>
          {editing ? (
            <textarea
              className={inputClass + " min-h-[80px] text-xs"}
              onChange={(event) => setDraft({ ...draft, nextPeriodPlan: event.target.value })}
              value={draft.nextPeriodPlan}
            />
          ) : (
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-zinc-950 dark:text-zinc-300">
              {draft.nextPeriodPlan || "—"}
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>Admin support required</label>
          {editing ? (
            <textarea
              className={inputClass + " min-h-[80px] text-xs"}
              onChange={(event) => setDraft({ ...draft, adminSupportRequired: event.target.value })}
              value={draft.adminSupportRequired}
            />
          ) : (
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-zinc-950 dark:text-zinc-300">
              {draft.adminSupportRequired || "—"}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Delivery</p>
        </div>
        {detail.deliveries.length ? (
          <div className="space-y-1.5">
            {detail.deliveries.map((delivery) => (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] dark:border-zinc-800" key={delivery.id}>
                {delivery.deliveryChannel === "email" ? <Mail size={12} /> : <Send size={12} />}
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  {delivery.deliveryChannel === "email" ? "Email" : "In-app"} · {delivery.recipientName || "recipient"}
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-semibold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {delivery.deliveryStatus}
                </span>
                {delivery.errorDetails ? <span className="text-rose-600 dark:text-rose-300">{delivery.errorDetails}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Delivery starts when the Team Owner confirms the report.</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Admin review</p>
          {Array.isArray(compaction.adminReview?.comments) && compaction.adminReview.comments.length ? (
            <div className="space-y-1.5">
              {compaction.adminReview.comments.map((comment: Record<string, any>, index: number) => (
                <div className="rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-950" key={index}>
                  <p className="text-slate-700 dark:text-zinc-300">{String(comment.body ?? "")}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {String(comment.action ?? "comment").replace(/_/g, " ")} · {formatDateTime(comment.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No admin comments yet.</p>
          )}
        </div>

        {detail.permissions.canReview ? (
          <div>
            <label className={labelClass}>Admin response</label>
            <textarea
              className={inputClass + " min-h-[72px] text-xs"}
              onChange={(event) => setReviewBody(event.target.value)}
              placeholder="Comment, acknowledge or request a correction."
              value={reviewBody}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btnSecondary} disabled={busy || !reviewBody.trim()} onClick={() => onReview("comment")} type="button">
                Comment
              </button>
              <button className={btnSecondary} disabled={busy || !reviewBody.trim()} onClick={() => onReview("follow_up")} type="button">
                Follow up
              </button>
              <button className={btnPrimary} disabled={busy} onClick={() => onReview("acknowledged")} type="button">
                <Check size={12} /> Acknowledge
              </button>
              <button className={btnDanger} disabled={busy || !reviewBody.trim()} onClick={() => onReview("correction_requested")} type="button">
                Request correction
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-zinc-800">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
