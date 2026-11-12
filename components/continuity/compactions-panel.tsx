"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import {
  EMPLOYEE_COMPACTION_STATUSES,
  EMPLOYEE_EDITABLE_STATUSES,
  type CompactionContent,
} from "@/lib/work-constants";
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
  newlineList,
  PanelHeader,
  StatusPill,
  type CompactionRecord,
  type Member,
} from "./common";

type BoardOption = { id: string; title: string };

type CompactionDetail = {
  compaction: CompactionRecord & Record<string, any>;
  todos: Record<string, any>[];
  deliveries: DeliveryRecord[];
  revisions: Record<string, any>[];
  permissions: { canEdit: boolean; canReview: boolean; canRetryDelivery: boolean };
};

type DeliveryRecord = {
  id: string;
  deliveryChannel: "in_app" | "email";
  deliveryStatus: "pending" | "sent" | "failed";
  recipient?: Member | string | null;
  recipientName?: string;
  recipientEmail?: string;
  errorDetails?: string;
  attempts?: number;
  deliveredAt?: string | null;
  lastAttemptAt?: string | null;
};

type EodStatus = {
  timeZone: string;
  dayKey: string;
  hasCheckout: boolean;
  canGenerateRecovery: boolean;
  activeTodoCount: number;
  hasReport: boolean;
  needsConfirmation: boolean;
  reminder: string;
  draft: { id: string; status: string } | null;
  states: Record<string, boolean>;
};

const CONTENT_SECTIONS: {
  key: keyof CompactionContent;
  title: string;
  hint: string;
  list: boolean;
}[] = [
  { key: "completedWork", title: "A · Completed work", hint: "Only work actually finished.", list: true },
  { key: "partialWork", title: "B · Partially completed", hint: "Started but unfinished.", list: true },
  { key: "pendingWork", title: "C · Pending / not started", hint: "Planned but untouched.", list: true },
  { key: "blockers", title: "D · Blockers", hint: "What is stopping progress and who it waits on.", list: true },
  { key: "decisions", title: "E · Decisions & dependencies", hint: "Decisions made or needed.", list: false },
  { key: "handoverNotes", title: "F · Handover notes", hint: "Context for whoever picks this up.", list: false },
  { key: "risks", title: "G · Risks", hint: "Risks to flag to the Team Owner.", list: false },
  { key: "nextActions", title: "Next actions", hint: "One action per line.", list: false },
  { key: "additionalNotes", title: "Additional notes", hint: "Anything else worth recording.", list: false },
];

function emptyContent(): CompactionContent {
  return {
    completedWork: [],
    partialWork: [],
    pendingWork: [],
    blockers: [],
    decisions: "",
    handoverNotes: "",
    risks: "",
    nextActions: "",
    additionalNotes: "",
    attachmentIds: [],
  };
}

function normalizeContent(content: unknown): CompactionContent {
  const raw = (content && typeof content === "object" ? content : {}) as Record<string, unknown>;
  return {
    completedWork: newlineList(raw.completedWork),
    partialWork: newlineList(raw.partialWork),
    pendingWork: newlineList(raw.pendingWork),
    blockers: newlineList(raw.blockers),
    decisions: String(raw.decisions ?? ""),
    handoverNotes: String(raw.handoverNotes ?? ""),
    risks: String(raw.risks ?? ""),
    nextActions: String(raw.nextActions ?? ""),
    additionalNotes: String(raw.additionalNotes ?? ""),
    attachmentIds: Array.isArray(raw.attachmentIds) ? raw.attachmentIds.map(String) : [],
  };
}

export function CompactionsPanel({
  defaultScope = "mine",
  focusId = "",
}: {
  defaultScope?: "mine" | "team" | "received";
  focusId?: string;
}) {
  const { showSuccessToast } = useNotificationToast();
  const [scope, setScope] = useState(defaultScope);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [compactions, setCompactions] = useState<CompactionRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eod, setEod] = useState<EodStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [boardPickerType, setBoardPickerType] = useState<"EOD" | "EOW" | null>(null);

  const [detail, setDetail] = useState<CompactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState<CompactionContent>(emptyContent());
  const [draftSummary, setDraftSummary] = useState("");
  const [draftReason, setDraftReason] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [expanded, setExpanded] = useState<string | null>(focusId || null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ scope, limit: "200" });
      if (typeFilter) query.set("type", typeFilter);
      if (statusFilter) query.set("status", statusFilter);
      const result = await apiFetch<{ compactions: CompactionRecord[]; counts: Record<string, number> }>(
        `/api/compactions?${query.toString()}`,
        undefined,
        { toast: false },
      );
      setCompactions(result.compactions ?? []);
      setCounts(result.counts ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load compactions.");
    } finally {
      setLoading(false);
    }
  }, [scope, typeFilter, statusFilter]);

  const loadEod = useCallback(async () => {
    try {
      const result = await apiFetch<EodStatus>("/api/compactions/eod", undefined, { toast: false });
      setEod(result);
    } catch {
      setEod(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadEod();
  }, [loadEod]);

  useEffect(() => {
    void apiFetch<{ boards: BoardOption[] }>("/api/boards", undefined, { toast: false })
      .then((result) => setBoards(result.boards ?? []))
      .catch(() => setBoards([]));
  }, []);

  const openDetail = useCallback(async (id: string) => {
    setExpanded(id);
    setDetailLoading(true);
    setEditing(false);
    try {
      const result = await apiFetch<CompactionDetail>(`/api/compactions/${id}`, undefined, { toast: false });
      setDetail(result);
      const content = normalizeContent(result.compaction.content);
      setDraftContent(content);
      setDraftSummary(String(result.compaction.summary ?? ""));
      setDraftReason(String(result.compaction.reasonForContinuing ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the compaction.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focusId) void openDetail(focusId);
  }, [focusId, openDetail]);

  async function generate(type: "EOD" | "EOW", boardId: string) {
    setBusy(true);
    try {
      const result = await apiFetch<{ compaction: CompactionRecord | null; created?: boolean; message?: string }>(
        "/api/compactions",
        {
          method: "POST",
          body: JSON.stringify({
            type,
            boardId,
            reportingDate: new Date().toISOString(),
            allowMultipleSessions: true,
          }),
        },
      );
      if (!result.compaction) {
        setError(result.message ?? "No compaction was generated.");
        return;
      }
      showSuccessToast(result.created ? `${type} draft created.` : `${type} compaction already exists.`);
      await load();
      if (type === "EOD") await loadEod();
      await openDetail(result.compaction.id);
    } catch {
      // apiFetch showed the failure.
    } finally {
      setBusy(false);
    }
  }

  function requestGenerate(type: "EOD" | "EOW") {
    setBoardPickerType(type);
  }

  async function recoverEod() {
    setBusy(true);
    try {
      const result = await apiFetch<{ compaction: CompactionRecord | null; message?: string }>(
        "/api/compactions/eod",
        { method: "POST", body: JSON.stringify({ reportingDate: new Date().toISOString() }) },
      );
      if (!result.compaction) {
        setError(result.message ?? "The EOD draft could not be recovered.");
        return;
      }
      showSuccessToast("EOD draft recovered. Review and confirm it before it is delivered.");
      await load();
      await loadEod();
      await openDetail(result.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  async function saveDetail(changeReason: string) {
    if (!detail) return;
    setBusy(true);
    try {
      await apiFetch(`/api/compactions/${detail.compaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          content: draftContent,
          summary: draftSummary,
          reasonForContinuing: draftReason,
          changeReason,
        }),
      });
      showSuccessToast("Compaction draft saved.");
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
      await apiFetch(`/api/compactions/${detail.compaction.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          content: draftContent,
          summary: draftSummary,
          reasonForContinuing: draftReason,
        }),
      });
      showSuccessToast("Compaction confirmed and delivered to your Team Owner.");
      await load();
      await loadEod();
      await openDetail(detail.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  async function review(action: "comment" | "reviewed" | "correction_requested") {
    if (!detail) return;
    setBusy(true);
    try {
      await apiFetch(`/api/compactions/${detail.compaction.id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, body: reviewBody }),
      });
      showSuccessToast(
        action === "correction_requested"
          ? "Correction requested."
          : action === "reviewed"
            ? "Compaction marked reviewed."
            : "Comment added.",
      );
      setReviewBody("");
      await openDetail(detail.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  async function retryDelivery() {
    if (!detail) return;
    setBusy(true);
    try {
      await apiFetch(`/api/compactions/${detail.compaction.id}/delivery`, { method: "POST" });
      showSuccessToast("Delivery retried. Failed channels can be retried again safely.");
      await openDetail(detail.compaction.id);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (!typeFilter) return compactions;
    return compactions.filter((item) => item.compactionType === typeFilter);
  }, [compactions, typeFilter]);

  const isEditable = Boolean(detail && EMPLOYEE_EDITABLE_STATUSES.includes(detail.compaction.status as any));
  const showEod = scope === "mine";

  return (
    <div className="space-y-4">
      {showEod ? (
        <Card className="border-l-4 border-l-emerald-400">
          <PanelHeader
            title="Today's EOD"
            description="Generated after your official attendance checkout. Nothing is auto-marked complete."
            actions={
              <>
                {eod?.canGenerateRecovery ? (
                  <button className={btnSecondary} disabled={busy} onClick={() => void recoverEod()} type="button">
                    <RotateCcw size={13} /> Recover draft
                  </button>
                ) : null}
                <button className={btnPrimary} disabled={busy} onClick={() => requestGenerate("EOD")} type="button">
                  <Clock size={13} /> Generate EOD
                </button>
                <button className={btnSecondary} disabled={busy} onClick={() => requestGenerate("EOW")} type="button">
                  <ShieldCheck size={13} /> New EOW
                </button>
              </>
            }
          />
          {eod ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatusTile
                label="Attendance checkout"
                value={eod.hasCheckout ? "Checked out" : "Not checked out"}
                tone={eod.hasCheckout ? "ok" : "muted"}
              />
              <StatusTile
                label="EOD state"
                value={
                  eod.needsConfirmation
                    ? "Awaiting confirmation"
                    : eod.hasReport
                      ? String(eod.draft?.status ?? "Saved").replace(/_/g, " ")
                      : eod.canGenerateRecovery
                        ? "Draft pending"
                        : "Not started"
                }
                tone={eod.needsConfirmation ? "warn" : eod.hasReport ? "ok" : "muted"}
              />
              <StatusTile
                label="Open todos"
                value={`${eod.activeTodoCount} unfinished`}
                tone={eod.activeTodoCount ? "warn" : "ok"}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">EOD status is unavailable right now.</p>
          )}
          {eod?.reminder ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 shrink-0" size={13} />
              {eod.reminder}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <PanelHeader
          title={scope === "received" ? "Compactions received" : scope === "team" ? "Team EOD / EOW reports" : "My compactions"}
          description="EOD and EOW reports keep their own history. Corrections create revisions instead of overwriting the original."
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
            </>
          }
        />

        {defaultScope === "mine" ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-zinc-700">
              {(["mine", "team", "received"] as const).map((value) => (
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
                  {value === "mine" ? "Mine" : value === "team" ? "Team" : "Received"}
                </button>
              ))}
            </div>
            <select className={inputClass + " max-w-[130px]"} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">EOD + EOW</option>
              <option value="EOD">EOD only</option>
              <option value="EOW">EOW only</option>
            </select>
            <select className={inputClass + " max-w-[170px]"} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {EMPLOYEE_COMPACTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Awaiting confirmation" value={counts.awaitingConfirmation ?? 0} />
          <Metric label="Submitted" value={counts.submitted ?? 0} />
          <Metric label="Corrections" value={counts.correctionRequested ?? 0} />
          <Metric label="Delivery failed" value={counts.deliveryFailed ?? 0} />
        </div>

        <ErrorNote message={error} />
        {loading ? <LoadingRows rows={4} /> : null}

        {!loading && filtered.length === 0 ? (
          <EmptyState
            title="No compactions yet"
            description="Your EOD is prepared automatically after checkout. EOW reports are created manually whenever you need a weekly summary."
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
                  onClick={() => (isOpen ? setExpanded(null) : void openDetail(item.id))}
                  type="button"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {item.compactionType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {item.compactionType} · {formatDate(item.reportingDate)}
                      </span>
                      <StatusPill status={item.status} />
                      {item.hasOpenCorrection ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                          Correction open
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
                      {item.boardName ? `${item.boardName} · ` : "All boards · "}
                      {item.employeeName ? `${item.employeeName} · ` : ""}
                      {item.summary || "No summary yet"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-3 text-[10px] text-slate-400 sm:flex">
                    <span>{item.emailSentAt ? "Email sent" : item.deliveredToTeamOwnerAt ? "Delivered" : "Not delivered"}</span>
                    {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-200 px-4 py-4 dark:border-zinc-800">
                    {detailLoading ? (
                      <LoadingRows rows={2} />
                    ) : detail && detail.compaction.id === item.id ? (
                      <CompactionDetailBody
                        detail={detail}
                        editing={editing}
                        draftContent={draftContent}
                        draftSummary={draftSummary}
                        draftReason={draftReason}
                        reviewBody={reviewBody}
                        busy={busy}
                        isEditable={isEditable}
                        onEdit={() => {
                          setEditing(true);
                          setDraftContent(normalizeContent(detail.compaction.content));
                          setDraftSummary(String(detail.compaction.summary ?? ""));
                          setDraftReason(String(detail.compaction.reasonForContinuing ?? ""));
                        }}
                        onCancel={() => setEditing(false)}
                        onSave={() => void saveDetail("Employee edited draft")}
                        onSubmit={() => void submitDetail()}
                        onReview={(action) => void review(action)}
                        onRetry={() => void retryDelivery()}
                        setDraftContent={setDraftContent}
                        setDraftSummary={setDraftSummary}
                        setDraftReason={setDraftReason}
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

      <Modal
        open={Boolean(boardPickerType)}
        title={`Choose a board for ${boardPickerType ?? "compaction"}`}
        onClose={() => setBoardPickerType(null)}
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Only work from the selected board will be included in this {boardPickerType ?? ""} report.
          </p>
          {boards.length ? (
            <div className="space-y-2">
              {boards.map((board) => (
                <button
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  key={board.id}
                  onClick={() => {
                    const type = boardPickerType;
                    setBoardPickerType(null);
                    if (type) void generate(type, board.id);
                  }}
                  type="button"
                >
                  <span>{board.title}</span>
                  <span className="text-[11px] font-medium text-slate-400">Create report</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
              No accessible boards were found.
            </p>
          )}
        </div>
      </Modal>

    </div>
  );
}

function CompactionDetailBody({
  detail,
  editing,
  draftContent,
  draftSummary,
  draftReason,
  reviewBody,
  busy,
  isEditable,
  onEdit,
  onCancel,
  onSave,
  onSubmit,
  onReview,
  onRetry,
  setDraftContent,
  setDraftSummary,
  setDraftReason,
  setReviewBody,
}: {
  detail: CompactionDetail;
  editing: boolean;
  draftContent: CompactionContent;
  draftSummary: string;
  draftReason: string;
  reviewBody: string;
  busy: boolean;
  isEditable: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onReview: (action: "comment" | "reviewed" | "correction_requested") => void;
  onRetry: () => void;
  setDraftContent: (value: CompactionContent) => void;
  setDraftSummary: (value: string) => void;
  setDraftReason: (value: string) => void;
  setReviewBody: (value: string) => void;
}) {
  const compaction = detail.compaction;
  const content = editing ? draftContent : normalizeContent(compaction.content);

  function updateList(key: keyof CompactionContent, value: string) {
    setDraftContent({ ...draftContent, [key]: newlineList(value) });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          status={compaction.status}
          label={
            compaction.status === "delivered_to_team_owner" && detail.deliveries.length
              ? `Delivered to ${detail.deliveries.find((delivery) => delivery.deliveryChannel === "in_app")?.recipientName ?? "recipient"}`
              : undefined
          }
        />
        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
          Board: {compaction.boardName || "All boards"}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          Revision {Number(compaction.revisionNumber ?? 1)} · Created {formatDateTime(compaction.createdAt)}
        </span>
        {compaction.submittedAt ? (
          <span className="text-[11px] text-slate-500 dark:text-zinc-400">Submitted {formatDateTime(compaction.submittedAt)}</span>
        ) : null}
      </div>

      {detail.permissions.canEdit && isEditable ? (
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button className={btnPrimary} disabled={busy} onClick={onSave} type="button">
                <Check size={13} /> Save draft
              </button>
              <button className={btnSecondary} disabled={busy} onClick={onCancel} type="button">
                Cancel
              </button>
            </>
          ) : (
            <button className={btnSecondary} onClick={onEdit} type="button">
              Edit draft
            </button>
          )}
          <button className={btnPrimary} disabled={busy} onClick={onSubmit} type="button">
            <Send size={13} /> Confirm & send to Team Owner
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Summary</label>
          {editing ? (
            <textarea
              className={inputClass + " min-h-[72px]"}
              onChange={(event) => setDraftSummary(event.target.value)}
              value={draftSummary}
            />
          ) : (
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-zinc-950 dark:text-zinc-300">
              {compaction.summary || "No summary provided."}
            </p>
          )}
        </div>
        {compaction.compactionType === "EOD" ? (
          <div className="sm:col-span-2">
            <label className={labelClass}>Reason for continuing</label>
            {editing ? (
              <textarea
                className={inputClass + " min-h-[64px]"}
                onChange={(event) => setDraftReason(event.target.value)}
                value={draftReason}
              />
            ) : (
              <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-zinc-950 dark:text-zinc-300">
                {compaction.reasonForContinuing || "—"}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {CONTENT_SECTIONS.map((section) => {
          const value = content[section.key];
          return (
            <div key={section.key} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{section.title}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{section.hint}</p>
              {editing ? (
                <textarea
                  className={inputClass + " mt-2 min-h-[80px] text-xs"}
                  onChange={(event) =>
                    section.list ? updateList(section.key, event.target.value) : setDraftContent({ ...draftContent, [section.key]: event.target.value })
                  }
                  value={section.list ? newlineList(value).join("\n") : String(value ?? "")}
                />
              ) : section.list ? (
                newlineList(value).length ? (
                  <ul className="mt-2 space-y-1">
                    {newlineList(value).map((line, index) => (
                      <li className="flex gap-2 text-xs text-slate-700 dark:text-zinc-300" key={`${section.key}-${index}`}>
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">Nothing recorded.</p>
                )
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700 dark:text-zinc-300">
                  {String(value ?? "") || "Nothing recorded."}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {detail.todos.length ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Work-item snapshots ({detail.todos.length})
          </p>
          <div className="space-y-1.5">
            {detail.todos.map((todo) => (
              <div
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-zinc-800"
                key={String(todo.id)}
              >
                <span className="font-medium text-slate-800 dark:text-zinc-200">{String(todo.title ?? "")}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {String(todo.category ?? "")}
                </span>
                <span className="text-slate-400">{Number(todo.progress ?? 0)}%</span>
                <span className="ml-auto text-[10px] text-slate-400">
                  Original {formatDate(todo.originalAssignedDate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Delivery
          </p>
          {detail.permissions.canRetryDelivery && detail.deliveries.some((row) => row.deliveryStatus !== "sent") ? (
            <button className={btnSecondary} disabled={busy} onClick={onRetry} type="button">
              <RefreshCw size={12} /> Retry delivery
            </button>
          ) : null}
        </div>
        {detail.deliveries.length ? (
          <div className="space-y-1.5">
            {detail.deliveries.map((delivery) => (
              <div
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] dark:border-zinc-800"
                key={delivery.id}
              >
                {delivery.deliveryChannel === "email" ? <Mail size={12} /> : <Send size={12} />}
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  {delivery.deliveryChannel === "email" ? "Email" : "In-app"} · {delivery.recipientName || "recipient"}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 font-semibold uppercase ${
                    delivery.deliveryStatus === "sent"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : delivery.deliveryStatus === "failed"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  }`}
                >
                  {delivery.deliveryStatus}
                </span>
                {delivery.errorDetails ? (
                  <span className="text-rose-600 dark:text-rose-300">{delivery.errorDetails}</span>
                ) : delivery.deliveredAt ? (
                  <span className="text-slate-400">{formatDateTime(delivery.deliveredAt)}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Delivery starts after you confirm the report.</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Review comments
          </p>
          {Array.isArray(compaction.reviewComments) && compaction.reviewComments.length ? (
            <div className="space-y-1.5">
              {compaction.reviewComments.map((comment: Record<string, any>, index: number) => (
                <div className="rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-950" key={String(comment._id ?? index)}>
                  <p className="text-slate-700 dark:text-zinc-300">{String(comment.body ?? "")}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {String(comment.action ?? "comment").replace(/_/g, " ")} · {formatDateTime(comment.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No comments yet.</p>
          )}
        </div>

        {detail.permissions.canReview ? (
          <div>
            <label className={labelClass}>Team Owner review</label>
            <textarea
              className={inputClass + " min-h-[72px] text-xs"}
              onChange={(event) => setReviewBody(event.target.value)}
              placeholder="Add a comment or request a correction."
              value={reviewBody}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btnSecondary} disabled={busy || !reviewBody.trim()} onClick={() => onReview("comment")} type="button">
                Comment
              </button>
              <button className={btnPrimary} disabled={busy} onClick={() => onReview("reviewed")} type="button">
                <Check size={12} /> Mark reviewed
              </button>
              <button className={btnDanger} disabled={busy || !reviewBody.trim()} onClick={() => onReview("correction_requested")} type="button">
                Request correction
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {detail.revisions.length ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Revision history</p>
          <div className="space-y-1">
            {detail.revisions.slice(0, 8).map((revision) => (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400" key={String(revision.id)}>
                <span className="font-semibold">#{Number(revision.revisionNumber ?? 0)}</span>
                <span>{String(revision.action ?? "edited").replace(/_/g, " ")}</span>
                <span className="truncate">{String(revision.changeReason ?? "")}</span>
                <span className="ml-auto">{formatDateTime(revision.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "muted" }) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-sm font-semibold capitalize">{value}</p>
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
