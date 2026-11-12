"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { BOARD_TODO_STATUS_LABELS, EMPLOYEE_COMPACTION_STATUS_LABELS, TEAM_COMPACTION_STATUS_LABELS } from "@/lib/work-constants";

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400";
export const textareaClass = `${inputClass} min-h-[84px] resize-y`;
export const labelClass =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400";
export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
export const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";
export const btnDanger =
  "inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";

export type Member = {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
  employeeCode?: string;
  team?: string | null;
};

export type TodoRecord = {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  status: string;
  progress: number;
  priority: string;
  dueDate?: string | null;
  originalAssignedDate?: string | null;
  currentWorkingDate?: string | null;
  remainingWork?: string;
  partialWorkNotes?: string;
  nextAction?: string;
  completionNotes?: string;
  expectedContinuationDate?: string | null;
  isContinuation?: boolean;
  lineageRootId?: string | null;
  continuationOf?: string | null;
  carryForwardHistory?: Record<string, any>[];
  delegationHistory?: Record<string, any>[];
  assigneeId?: Member | string | null;
  originalOwnerId?: Member | string | null;
  task?: { id?: string; _id?: string; title?: string } | string | null;
  board?: { id?: string; _id?: string; title?: string } | string | null;
  taskDetail?: Record<string, any> | null;
  resumeNote?: string;
  workingDateKey?: string | null;
};

export type HandoverRecord = {
  id: string;
  status: string;
  reason: string;
  instructions?: string;
  createdAt?: string;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  cancelledAt?: string | null;
  declineReason?: string;
  fromEmployee?: Member | string | null;
  toEmployee?: Member | string | null;
  requestedBy?: Member | string | null;
  todo?: { id?: string; title?: string; status?: string } | string | null;
};

export type CompactionRecord = {
  id: string;
  compactionType: "EOD" | "EOW";
  status: string;
  reviewStatus?: string;
  reportingDate: string;
  reportingDateKey?: string;
  summary?: string;
  reasonForContinuing?: string;
  employee?: Member | string | null;
  employeeName?: string;
  employeeCode?: string;
  teamName?: string;
  teamOwnerName?: string;
  board?: { id?: string; _id?: string; title?: string } | string | null;
  boardName?: string;
  content?: Record<string, any>;
  reviewComments?: Record<string, any>[];
  revisionNumber?: number;
  submittedAt?: string | null;
  deliveredToTeamOwnerAt?: string | null;
  emailSentAt?: string | null;
  hasOpenCorrection?: boolean;
  createdAt?: string;
};

export type TeamCompactionRecord = {
  id: string;
  status: string;
  teamName?: string;
  teamOwnerName?: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  reportingPeriodKey?: string;
  summary?: string;
  content?: Record<string, any>;
  adminReview?: Record<string, any>;
  revisionNumber?: number;
  submittedToAdminAt?: string | null;
  deliveredAt?: string | null;
  emailSentAt?: string | null;
  hasSourceCorrections?: boolean;
  createdAt?: string;
};

export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dateInputValue(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function memberName(value?: Member | string | null): string {
  if (!value) return "Unassigned";
  if (typeof value === "string") return value;
  return value.name || value.email || "Unassigned";
}

export function memberId(value?: Member | string | null): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.id ?? value._id ?? "";
}

export function taskTitle(todo: TodoRecord): string {
  const task = todo.task;
  if (task && typeof task === "object") return task.title ?? "";
  if (todo.taskDetail?.title) return String(todo.taskDetail.title);
  return "";
}

export function newlineList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).filter(Boolean);
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  delivered_to_team_owner: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  email_sent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  acknowledged: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  in_progress: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  partially_completed: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  pending_review: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  awaiting_confirmation: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  awaiting_team_owner_confirmation: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  draft: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
  draft_ready: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
  pending_generation: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
  blocked: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  taken: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  decision_pending: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  risk_flagged: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  decision: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  risk: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  correction_requested: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  declined: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  carried_forward: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  delegation_pending: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  delegated: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  submitted: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  submitted_to_admin: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  under_admin_review: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
};

export function StatusPill({ status, label: customLabel }: { status: string; label?: string }) {
  const label = customLabel ??
    BOARD_TODO_STATUS_LABELS[status as keyof typeof BOARD_TODO_STATUS_LABELS] ??
    EMPLOYEE_COMPACTION_STATUS_LABELS[status as keyof typeof EMPLOYEE_COMPACTION_STATUS_LABELS] ??
    TEAM_COMPACTION_STATUS_LABELS[status as keyof typeof TEAM_COMPACTION_STATUS_LABELS] ??
    status.replace(/_/g, " ");
  const tone = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#0b0b0b] ${className}`}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center dark:border-zinc-700">
      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-zinc-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800/70" />
      ))}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full transition-all ${safe >= 100 ? "bg-emerald-500" : safe > 0 ? "bg-sky-500" : "bg-slate-300 dark:bg-zinc-600"}`}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm sm:p-8">
      <div
        className={`relative my-4 w-full ${wide ? "max-w-4xl" : "max-w-xl"} rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0b0b0b]`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{title}</h3>
          <button
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
      {message}
    </div>
  );
}
