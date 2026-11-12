/**
 * Framework-free helpers for task continuity, EOD/EOW compaction and team
 * consolidation. Kept independent of Mongoose so the date/dedupe rules can be
 * unit-tested directly with `node --test`.
 */

import {
  ACTIVE_TODO_STATUSES,
  FINISHED_TODO_STATUSES,
  type BoardTodoStatus,
  type CompactionCategory,
  type CompactionContent,
  type CompactionType,
} from "./work-constants.ts";

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/** Resolve an IANA timezone, falling back to IST when the value is invalid. */
export function resolveTimeZone(value?: string | null): string {
  const candidate = String(value ?? "").trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(value: Date | number | string, timeZone: string): ZonedParts {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Some engines render midnight as 24; normalise it to 0.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
function timeZoneOffsetMs(value: Date, timeZone: string): number {
  const parts = zonedParts(value, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - value.getTime();
}

/** Build the UTC instant for a wall-clock time in `timeZone`. */
function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  let candidate = new Date(guess);
  // Two passes handle DST boundaries in zones that observe them.
  for (let i = 0; i < 2; i += 1) {
    const offset = timeZoneOffsetMs(candidate, timeZone);
    candidate = new Date(guess - offset);
  }
  return candidate;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** Calendar day key (`YYYY-MM-DD`) for an instant in the given timezone. */
export function dateKeyInTimeZone(value: Date | number | string, timeZone?: string | null): string {
  const parts = zonedParts(value, resolveTimeZone(timeZone));
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** The instant at local midnight for a `YYYY-MM-DD` key. */
export function startOfDayInTimeZone(value: Date | number | string, timeZone?: string | null): Date {
  const parts = zonedParts(value, resolveTimeZone(timeZone));
  return zonedTimeToUtc(parts, resolveTimeZone(timeZone));
}

/** The instant at local midnight for an explicit `YYYY-MM-DD` key. */
export function dateFromKey(key: string, timeZone?: string | null): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? "").trim());
  if (!match) return new Date(Number.NaN);
  return zonedTimeToUtc(
    { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) },
    resolveTimeZone(timeZone),
  );
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** ISO week key (`YYYY-Www`) for the local calendar date. */
export function weekKeyInTimeZone(value: Date | number | string, timeZone?: string | null): string {
  const parts = zonedParts(value, resolveTimeZone(timeZone));
  const localMidnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const iso = isoWeek(new Date(localMidnightUtc));
  return `${pad(iso.year, 4)}-W${pad(iso.week)}`;
}

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO-8601: Monday is the first day of the week.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** Monday..Sunday window containing the instant, in local time. */
export function weekRangeInTimeZone(
  value: Date | number | string,
  timeZone?: string | null,
): { start: Date; end: Date; key: string } {
  const zone = resolveTimeZone(timeZone);
  const parts = zonedParts(value, zone);
  const localMidnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const weekday = new Date(localMidnightUtc).getUTCDay() || 7;
  const mondayUtc = new Date(localMidnightUtc);
  mondayUtc.setUTCDate(mondayUtc.getUTCDate() - (weekday - 1));
  const start = zonedTimeToUtc(
    {
      year: mondayUtc.getUTCFullYear(),
      month: mondayUtc.getUTCMonth() + 1,
      day: mondayUtc.getUTCDate(),
    },
    zone,
  );
  const end = new Date(start.getTime() + 7 * 86_400_000 - 1);
  return { start, end, key: weekKeyInTimeZone(value, zone) };
}

/** Stable key that makes carry-forward idempotent per todo/target date. */
export function carryForwardKey(todoId: string, toDateKey: string): string {
  return `cf:${String(todoId)}:${String(toDateKey)}`;
}

/** Stable key for one employee compaction period. */
export function compactionIdempotencyKey(
  type: CompactionType,
  employeeId: string,
  periodKey: string,
  boardId?: string | null,
): string {
  const base = `${type}:${String(employeeId)}:${String(periodKey)}`;
  return boardId ? `${base}:board:${String(boardId)}` : base;
}

/** Stable key for one delivery attempt/event on one channel. */
export function deliveryEventKey(
  scope: "compaction" | "team-compaction",
  id: string,
  recipientId: string,
  channel: "in_app" | "email",
): string {
  return `${scope}:${String(id)}:${String(recipientId)}:${channel}`;
}

export function isFinishedStatus(status?: string | null): boolean {
  return FINISHED_TODO_STATUSES.includes(status as BoardTodoStatus);
}

export function isActiveStatus(status?: string | null): boolean {
  return ACTIVE_TODO_STATUSES.includes(status as BoardTodoStatus);
}

/**
 * Map a todo's live state onto a compaction category. A todo is only ever
 * reported as completed when its status actually says so — a 100% progress
 * value on an unfinished todo still counts as partial work.
 */
export function categoryForTodo(todo: {
  status?: string | null;
  progress?: number | null;
  remainingWork?: string | null;
}): CompactionCategory {
  const status = String(todo.status ?? "");
  if (isFinishedStatus(status)) return "completed";
  if (status === "blocked") return "blocked";
  if (status === "decision_pending") return "decision";
  if (status === "risk_flagged") return "risk";
  if (status === "partially_completed") return "partial";
  const progress = Number(todo.progress ?? 0);
  if (progress > 0 && progress < 100) return "partial";
  if (status === "in_progress" && progress >= 100) return "partial";
  return "pending";
}

export type CompactionTodoSnapshot = {
  todoId: string;
  taskId: string | null;
  title: string;
  project: string;
  category: CompactionCategory;
  statusAtSubmission: string;
  progress: number;
  completedWork: string;
  remainingWork: string;
  pendingWork: string;
  blockerNotes: string;
  waitingOn: string;
  assistanceRequired: string;
  nextAction: string;
  expectedContinuationDate: Date | null;
  priority: string;
  dueDate: Date | null;
  originalAssignedDate: Date | null;
  currentWorkingDate: Date | null;
  assigneeId: string | null;
  originalOwnerId: string | null;
  delegatedFromId: string | null;
  isDelegated: boolean;
  minutesWorked: number | null;
};

export type SnapshotTodoInput = {
  _id?: unknown;
  id?: unknown;
  title?: string | null;
  project?: string | null;
  status?: string | null;
  progress?: number | null;
  completionNotes?: string | null;
  partialWorkNotes?: string | null;
  remainingWork?: string | null;
  nextAction?: string | null;
  expectedContinuationDate?: Date | null;
  priority?: string | null;
  dueDate?: Date | null;
  originalAssignedDate?: Date | null;
  currentWorkingDate?: Date | null;
  assigneeId?: unknown;
  originalOwnerId?: unknown;
  task?: unknown;
  taskId?: unknown;
  blockers?: { reason?: string; waitingOn?: string }[] | null;
  delegationHistory?: { from?: unknown }[] | null;
  isDelegated?: boolean;
  minutesWorked?: number | null;
  progressLog?: { workNotes?: string; remainingWork?: string; blockerNotes?: string; minutesWorked?: number | null } | null;
};

function idString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  const record = value as { _id?: unknown; id?: unknown };
  const id = record._id ?? record.id;
  return id ? String(id) : null;
}

function firstText(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

/** Build the immutable todo snapshot stored against a compaction. */
export function buildTodoSnapshot(todo: SnapshotTodoInput): CompactionTodoSnapshot {
  const category = categoryForTodo(todo);
  const blocker = Array.isArray(todo.blockers) ? todo.blockers[todo.blockers.length - 1] : null;
  const delegatedFrom = Array.isArray(todo.delegationHistory) ? todo.delegationHistory[todo.delegationHistory.length - 1] : null;
  const progressLog = todo.progressLog ?? null;
  const completedWork =
    category === "completed"
      ? firstText(progressLog?.workNotes, todo.completionNotes)
      : "";
  const pendingWork =
    category === "pending"
      ? firstText(progressLog?.workNotes, todo.partialWorkNotes, todo.remainingWork)
      : firstText(todo.remainingWork);
  return {
    todoId: idString(todo._id) ?? idString(todo.id) ?? "",
    taskId: idString(todo.task) ?? idString(todo.taskId) ?? null,
    title: String(todo.title ?? "").trim(),
    project: String(todo.project ?? "").trim(),
    category,
    statusAtSubmission: String(todo.status ?? "not_started"),
    progress: Math.max(0, Math.min(100, Number(todo.progress ?? 0))),
    completedWork,
    remainingWork: firstText(progressLog?.remainingWork, todo.remainingWork),
    pendingWork,
    blockerNotes: firstText(progressLog?.blockerNotes, blocker?.reason),
    waitingOn: String(blocker?.waitingOn ?? "").trim(),
    assistanceRequired: String(todo.remainingWork ?? "").trim(),
    nextAction: String(todo.nextAction ?? "").trim(),
    expectedContinuationDate: todo.expectedContinuationDate ?? null,
    priority: String(todo.priority ?? "medium"),
    dueDate: todo.dueDate ?? null,
    originalAssignedDate: todo.originalAssignedDate ?? null,
    currentWorkingDate: todo.currentWorkingDate ?? null,
    assigneeId: idString(todo.assigneeId),
    originalOwnerId: idString(todo.originalOwnerId),
    delegatedFromId: idString(delegatedFrom?.from),
    isDelegated: Boolean(todo.isDelegated),
    minutesWorked:
      todo.minutesWorked ?? progressLog?.minutesWorked ?? null,
  };
}

export type CompactionRollup = {
  completed: CompactionTodoSnapshot[];
  partial: CompactionTodoSnapshot[];
  pending: CompactionTodoSnapshot[];
  blocked: CompactionTodoSnapshot[];
  decision: CompactionTodoSnapshot[];
  risk: CompactionTodoSnapshot[];
  metrics: {
    total: number;
    completed: number;
    partial: number;
    pending: number;
    blocked: number;
    decision: number;
    risk: number;
  };
  hasWork: boolean;
};

export function rollupSnapshots(snapshots: CompactionTodoSnapshot[]): CompactionRollup {
  const completed = snapshots.filter((item) => item.category === "completed");
  const partial = snapshots.filter((item) => item.category === "partial");
  const pending = snapshots.filter((item) => item.category === "pending");
  const blocked = snapshots.filter((item) => item.category === "blocked");
  const decision = snapshots.filter((item) => item.category === "decision");
  const risk = snapshots.filter((item) => item.category === "risk");
  return {
    completed,
    partial,
    pending,
    blocked,
    decision,
    risk,
    metrics: {
      total: snapshots.length,
      completed: completed.length,
      partial: partial.length,
      pending: pending.length,
      blocked: blocked.length,
      decision: decision.length,
      risk: risk.length,
    },
    // A compaction with no todo content must never be persisted/delivered.
    hasWork: snapshots.length > 0,
  };
}

/** Build the employee-editable section content from todo snapshots. */
export function contentFromSnapshots(snapshots: CompactionTodoSnapshot[]): CompactionContent {
  const rollup = rollupSnapshots(snapshots);
  const line = (item: CompactionTodoSnapshot) => {
    const base = item.project ? `[${item.project}] ${item.title}` : item.title;
    if (item.remainingWork) return `${base} — ${item.remainingWork}`;
    return base;
  };
  const decisionLine = (item: CompactionTodoSnapshot) => {
    const base = line(item);
    const extras = [item.waitingOn ? `waiting on ${item.waitingOn}` : "", item.assistanceRequired ? `needs ${item.assistanceRequired}` : "", item.nextAction ? `next: ${item.nextAction}` : ""].filter(Boolean).join("; ");
    return extras ? `${base} — ${extras}` : base;
  };
  const riskLine = (item: CompactionTodoSnapshot) => {
    const base = line(item);
    const extras = [item.remainingWork && item.remainingWork !== "" ? "" : "", item.nextAction ? `mitigation: ${item.nextAction}` : "", item.blockerNotes ? `note: ${item.blockerNotes}` : ""].filter(Boolean).join("; ");
    return extras ? `${base} — ${extras}` : base;
  };
  return {
    completedWork: rollup.completed.map(line),
    partialWork: rollup.partial.map(line),
    pendingWork: rollup.pending.map(line),
    blockers: rollup.blocked.map((item) =>
      item.waitingOn ? `${line(item)} — waiting on ${item.waitingOn}` : line(item),
    ),
    decisions: rollup.decision.map(decisionLine).join("\n"),
    handoverNotes: "",
    risks: rollup.risk.map(riskLine).join("\n"),
    nextActions: snapshots
      .map((item) => item.nextAction)
      .filter(Boolean)
      .join("\n"),
    additionalNotes: "",
    attachmentIds: [],
  };
}

/** True when the editable content has anything worth delivering. */
export function hasCompactionContent(content: CompactionContent | null | undefined): boolean {
  if (!content) return false;
  return Boolean(
    (content.completedWork?.length ?? 0) ||
      (content.partialWork?.length ?? 0) ||
      (content.pendingWork?.length ?? 0) ||
      (content.blockers?.length ?? 0) ||
      String(content.decisions ?? "").trim() ||
      String(content.handoverNotes ?? "").trim() ||
      String(content.risks ?? "").trim() ||
      String(content.nextActions ?? "").trim() ||
      String(content.additionalNotes ?? "").trim(),
  );
}

export type TeamSourceLike = {
  employee: string;
  employeeName: string;
  sourceCompactionId: string;
  compactionType: string;
  summary: string;
  content: CompactionContent;
  todos: CompactionTodoSnapshot[];
};

export type ConsolidatedTodo = CompactionTodoSnapshot & {
  employees: string[];
  sourceCompactionIds: string[];
  sourceLinks: string[];
};

/**
 * Deduplicate todos that appear in more than one employee report (the same
 * lineage/task worked on across a week) while preserving every contributor and
 * source link. The first occurrence supplies the todo details; later reports
 * only add ownership/source metadata.
 */
export function consolidateTodos(sources: TeamSourceLike[]): ConsolidatedTodo[] {
  const byKey = new Map<string, ConsolidatedTodo>();
  for (const source of sources) {
    for (const todo of source.todos) {
      const key = todo.todoId || `${todo.taskId ?? "task"}:${todo.title}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.employees.includes(source.employee)) existing.employees.push(source.employee);
        if (!existing.sourceCompactionIds.includes(source.sourceCompactionId)) {
          existing.sourceCompactionIds.push(source.sourceCompactionId);
        }
        const link = `/profile/team-compactions/source/${source.sourceCompactionId}`;
        if (!existing.sourceLinks.includes(link)) existing.sourceLinks.push(link);
        continue;
      }
      byKey.set(key, {
        ...todo,
        employees: [source.employee],
        sourceCompactionIds: [source.sourceCompactionId],
        sourceLinks: [`/profile/team-compactions/source/${source.sourceCompactionId}`],
      });
    }
  }
  return Array.from(byKey.values());
}

export type MissingReport = {
  employee: string;
  employeeName: string;
  employeeCode: string;
};

export type TeamConsolidationInput = {
  teamName: string;
  teamOwnerName: string;
  periodStart: Date;
  periodEnd: Date;
  expectedEmployees: MissingReport[];
  sources: TeamSourceLike[];
  excludedSourceIds?: string[];
  exclusionReasons?: string[];
};

export type TeamConsolidationContent = {
  overview: {
    teamName: string;
    teamOwnerName: string;
    reportingPeriodStart: Date;
    reportingPeriodEnd: Date;
    participatingEmployees: number;
    receivedReports: number;
    missingReports: string[];
    exclusionReasons: string[];
  };
  overallSummary: string;
  employeeSummaries: {
    employee: string;
    employeeName: string;
    employeeCode: string;
    sourceCompactionId: string;
    eodSummary: string;
    eowSummary: string;
    completedWork: string[];
    partialWork: string[];
    pendingWork: string[];
    blockers: string[];
    nextActions: string[];
    delegatedWork: string[];
    sourceLinks: string[];
  }[];
  pendingWork: {
    title: string;
    employee: string;
    employeeId: string | null;
    originalOwner: string;
    currentWorkingDate: Date | null;
    dueDate: Date | null;
    dependencies: string;
    nextAction: string;
  }[];
  blockers: {
    summary: string;
    employees: string[];
    waitingOn: string;
    escalationRequired: boolean;
    sourceCompactionId: string | null;
  }[];
  handovers: {
    summary: string;
    fromEmployee: string;
    toEmployee: string;
    status: string;
    sourceHandoverId: string | null;
  }[];
  nextPeriodPlan: string;
  metrics: {
    totalCompleted: number;
    totalPartial: number;
    totalPending: number;
    totalBlocked: number;
    pendingHandovers: number;
  };
  adminSupportRequired: string;
};

export type TeamConsolidation = {
  content: TeamConsolidationContent;
  consolidatedTodos: ConsolidatedTodo[];
};

/**
 * Build the Team Owner consolidation view. Reports are only treated as
 * received when present in `sources`; missing team members are listed rather
 * than silently ignored.
 */
export function consolidateTeamReports(input: TeamConsolidationInput): TeamConsolidation {
  const included = input.sources.filter(
    (source) => !(input.excludedSourceIds ?? []).includes(source.sourceCompactionId),
  );
  const consolidatedTodos = consolidateTodos(included);
  const rollup = rollupSnapshots(consolidatedTodos);
  // "Missing" means no report was received at all. A report that was received
  // but deliberately excluded by the Team Owner is tracked through
  // `exclusionReasons`, not reported as missing.
  const receivedEmployeeIds = new Set(input.sources.map((source) => source.employee));
  const missingReports = input.expectedEmployees
    .filter((employee) => !receivedEmployeeIds.has(employee.employee))
    .map((employee) => `${employee.employeeName}${employee.employeeCode ? ` (${employee.employeeCode})` : ""}`);

  const pendingWork = rollup.pending.concat(rollup.partial).map((todo) => ({
    title: todo.title,
    employee: todo.assigneeId ?? "",
    employeeId: todo.assigneeId,
    originalOwner: todo.originalOwnerId ?? "",
    currentWorkingDate: todo.currentWorkingDate,
    dueDate: todo.dueDate,
    dependencies: todo.waitingOn,
    nextAction: todo.nextAction,
  }));

  return {
    content: {
      overview: {
        teamName: input.teamName,
        teamOwnerName: input.teamOwnerName,
        reportingPeriodStart: input.periodStart,
        reportingPeriodEnd: input.periodEnd,
        participatingEmployees: included.length,
        receivedReports: input.sources.length,
        missingReports,
        exclusionReasons: input.exclusionReasons ?? [],
      },
      overallSummary: "",
      employeeSummaries: included.map((source) => ({
        employee: source.employee,
        employeeName: source.employeeName,
        employeeCode: "",
        sourceCompactionId: source.sourceCompactionId,
        eodSummary: source.compactionType === "EOD" ? source.summary : "",
        eowSummary: source.compactionType === "EOW" ? source.summary : "",
        completedWork: source.content.completedWork ?? [],
        partialWork: source.content.partialWork ?? [],
        pendingWork: source.content.pendingWork ?? [],
        blockers: source.content.blockers ?? [],
        nextActions: String(source.content.nextActions ?? "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
        delegatedWork: [],
        sourceLinks: [`/profile/team-compactions/source/${source.sourceCompactionId}`],
      })),
      pendingWork,
      blockers: (rollup.blocked as ConsolidatedTodo[]).map((todo) => ({
        summary: todo.blockerNotes || todo.title,
        employees: todo.employees ?? [],
        waitingOn: todo.waitingOn,
        escalationRequired: Boolean(todo.waitingOn),
        sourceCompactionId: todo.sourceCompactionIds[0] ?? null,
      })),
      handovers: [],
      nextPeriodPlan: "",
      metrics: {
        totalCompleted: rollup.metrics.completed,
        totalPartial: rollup.metrics.partial,
        totalPending: rollup.metrics.pending,
        totalBlocked: rollup.metrics.blocked,
        pendingHandovers: 0,
      },
      adminSupportRequired: "",
    },
    consolidatedTodos,
  };
}

/** Normalise a comma/newline separated textarea into a bounded string list. */
export function toLines(value: unknown, limit = 100): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .slice(0, limit);
  }
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function clampText(value: unknown, maxLength: number): string {
  return String(value ?? "").slice(0, maxLength);
}
