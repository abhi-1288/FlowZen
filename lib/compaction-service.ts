/**
 * Server-side orchestration for task continuity compactions. Every function in
 * here re-derives authorization and organisation scope from the database; no
 * caller-supplied role/owner id is trusted.
 */

import { connectDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mailer";
import {
  employeeCompactionEmailContent,
  teamCompactionEmailContent,
} from "@/lib/email-templates";
import { emitToUser } from "@/lib/socket-emit";
import {
  buildTodoSnapshot,
  compactionIdempotencyKey,
  consolidateTeamReports,
  contentFromSnapshots,
  dateFromKey,
  dateKeyInTimeZone,
  deliveryEventKey,
  hasCompactionContent,
  resolveTimeZone,
  rollupSnapshots,
  startOfDayInTimeZone,
  weekKeyInTimeZone,
  weekRangeInTimeZone,
  type CompactionTodoSnapshot,
  type TeamSourceLike,
} from "@/lib/compaction";
import {
  EMPLOYEE_EDITABLE_STATUSES,
  TEAM_EDITABLE_STATUSES,
  emptyCompactionContent,
  type CompactionContent,
  type CompactionType,
} from "@/lib/work-constants";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Team } from "@/models/Team";
import { Task } from "@/models/Task";
import { Board } from "@/models/Board";
import { Attendance } from "@/models/Attendance";
import { Notification } from "@/models/Notification";
import { BoardTodo } from "@/models/BoardTodo";
import { TodoProgressLog } from "@/models/TodoProgressLog";
import { CompactionTodo } from "@/models/CompactionTodo";
import { TaskCompaction } from "@/models/TaskCompaction";
import { CompactionDelivery } from "@/models/CompactionDelivery";
import { CompactionRevision } from "@/models/CompactionRevision";
import { TeamCompaction } from "@/models/TeamCompaction";
import { TeamCompactionSource } from "@/models/TeamCompactionSource";

type AnyDoc = Record<string, any>;

const ACTIONABLE_COMPACTION_STATUSES = [
  "submitted",
  "delivered_to_team_owner",
  "email_pending",
  "email_sent",
  "delivery_failed",
];

function appUrl(path: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  return `${String(base).replace(/\/$/, "")}${path}`;
}

function uniqueIds(values: unknown[]): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const text = String(value);
    if (text) set.add(text);
  }
  return Array.from(set);
}

function formatDateLabel(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: resolveTimeZone(timeZone),
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function periodLabel(type: CompactionType, value: Date, timeZone: string): string {
  if (type === "EOW") {
    const range = weekRangeInTimeZone(value, timeZone);
    return `${formatDateLabel(range.start, timeZone)} – ${formatDateLabel(range.end, timeZone)}`;
  }
  return formatDateLabel(value, timeZone);
}

export async function notifyUsers(
  userIds: string[],
  payload: {
    title: string;
    message: string;
    link?: string;
    type?: "info" | "approval" | "project" | "deadline" | "system";
    company?: unknown;
    team?: unknown;
  },
) {
  const ids = uniqueIds(userIds);
  if (!ids.length) return;
  try {
    await Notification.insertMany(
      ids.map((userId) => ({
        user: userId,
        company: payload.company ?? null,
        team: payload.team ?? null,
        type: payload.type ?? "info",
        title: payload.title,
        message: payload.message,
        body: payload.message,
        link: payload.link ?? "",
      })),
    );
    ids.forEach((id) => emitToUser(id, "notification:new", { link: payload.link ?? "" }));
  } catch (error) {
    console.error("compaction notification failed:", error);
  }
}

export type EmployeeContext = {
  user: AnyDoc;
  company: AnyDoc | null;
  team: AnyDoc | null;
  teamOwner: AnyDoc | null;
  timeZone: string;
  name: string;
  code: string;
};

export async function getEmployeeContext(userId: string): Promise<EmployeeContext | null> {
  await connectDb();
  const user = await User.findById(userId).select(
    "name email role company companyStatus team teamStatus companyIdentityCode regionLabel",
  );
  if (!user) return null;
  const [company, team] = await Promise.all([
    user.company ? Company.findById(user.company) : null,
    user.team ? Team.findById(user.team) : null,
  ]);
  const teamOwner = team?.manager ? await User.findById(team.manager).select("name email role") : null;
  const timeZone = resolveTimeZone(company?.timeZone);
  return {
    user: user as AnyDoc,
    company: company as AnyDoc | null,
    team: team as AnyDoc | null,
    teamOwner: teamOwner as AnyDoc | null,
    timeZone,
    name: String(user.name ?? ""),
    code: String(user.companyIdentityCode ?? ""),
  };
}

export async function getCompanyAdminRecipients(companyId: string): Promise<AnyDoc[]> {
  if (!companyId) return [];
  const company = await Company.findById(companyId).select("owner name icon");
  const admins = await User.find({
    company: companyId,
    companyStatus: "approved",
    role: "admin",
  }).select("name email role");
  const ids = uniqueIds([company?.owner, ...admins.map((admin) => admin._id)]);
  const users = await User.find({ _id: { $in: ids } }).select("name email role");
  return users as AnyDoc[];
}

export async function userIsCompanyAdmin(userId: string, companyId: string): Promise<boolean> {
  if (!userId || !companyId) return false;
  const company = await Company.findById(companyId).select("owner");
  if (company && String(company.owner) === String(userId)) return true;
  const user = await User.findOne({
    _id: userId,
    company: companyId,
    companyStatus: "approved",
    role: "admin",
  }).select("_id");
  return Boolean(user);
}

export async function userCanReviewCompaction(
  userId: string,
  compaction: AnyDoc,
): Promise<{ ok: boolean; isAdmin: boolean }> {
  const isTeamOwner = String(compaction.teamOwner ?? "") === String(userId);
  const isAdmin = await userIsCompanyAdmin(userId, String(compaction.company ?? ""));
  return { ok: isTeamOwner || isAdmin, isAdmin };
}

export async function userOwnsTeam(userId: string, teamId: string): Promise<boolean> {
  const team = await Team.findOne({ _id: teamId, manager: userId }).select("_id company");
  return Boolean(team);
}

function rangeFor(type: CompactionType, reportingDate: Date, timeZone: string) {
  if (type === "EOW") return weekRangeInTimeZone(reportingDate, timeZone);
  const start = startOfDayInTimeZone(reportingDate, timeZone);
  return { start, end: new Date(start.getTime() + 86_400_000 - 1) };
}

function progressLogFor(todoId: string, logs: AnyDoc[]): AnyDoc | null {
  return logs.find((log) => String(log.todo) === todoId) ?? null;
}

/**
 * Bring legacy Kanban tasks taken by this employee into the continuity
 * snapshot pipeline. The original Task remains authoritative; this shadow row
 * only gives compactions and todo history a common representation.
 */
async function syncTakenBoardTasksToContinuity(input: {
  employeeId: string;
  companyId: string;
  boardId?: string | null;
  range: { start: Date; end: Date };
}): Promise<void> {
  const tasks = (await Task.find({
    takenBy: input.employeeId,
    ...(input.boardId ? { board: input.boardId } : {}),
    $or: [{ company: input.companyId }, { company: null }],
  }).populate("column", "title").select("title description priority dueDate createdAt updatedAt owner createdBy taskStatus column board company")) as AnyDoc[];

  await Promise.all(tasks.map(async (task) => {
    const columnTitle = String(task.column?.title ?? "").toLowerCase();
    const isDone = columnTitle === "done" || columnTitle === "expired-due" || String(task.taskStatus) === "completed";
    const wasUpdatedInPeriod = task.updatedAt >= input.range.start && task.updatedAt <= input.range.end;
    if (isDone && !wasUpdatedInPeriod) return;
    const isCompleted = columnTitle === "done" || String(task.taskStatus) === "completed";
    await BoardTodo.findOneAndUpdate(
      { task: task._id, sourceType: "board_task" },
      {
        $set: {
          company: input.companyId,
          board: task.board,
          carryForwardKey: `board-task:${String(task._id)}`,
          title: String(task.title ?? ""),
          description: String(task.description ?? ""),
          assigneeId: input.employeeId,
          originalOwnerId: task.owner ?? task.createdBy ?? input.employeeId,
          originalAssignedDate: task.createdAt ?? input.range.start,
          currentWorkingDate: isCompleted ? (task.updatedAt ?? input.range.start) : input.range.start,
          dueDate: task.dueDate ?? null,
          priority: ["low", "medium", "high"].includes(String(task.priority)) ? task.priority : "medium",
          status: isCompleted ? "completed" : "in_progress",
          progress: isCompleted ? 100 : 0,
          remainingWork: isCompleted ? "" : "Continue the active board task.",
          nextAction: isCompleted ? "" : `Continue ${String(task.title ?? "this task")}`,
          updatedBy: input.employeeId,
        },
        $setOnInsert: {
          task: task._id,
          sourceType: "board_task",
          createdBy: input.employeeId,
        },
      },
      { upsert: true },
    );
  }));
}

function snapshotFromCompactionTodo(doc: AnyDoc): CompactionTodoSnapshot {
  return {
    todoId: String(doc.todo ?? ""),
    taskId: doc.task ? String(doc.task) : null,
    title: String(doc.title ?? ""),
    project: String(doc.project ?? ""),
    category: doc.category,
    statusAtSubmission: String(doc.statusAtSubmission ?? "in_progress"),
    progress: Number(doc.progress ?? 0),
    completedWork: String(doc.completedWork ?? ""),
    remainingWork: String(doc.remainingWork ?? ""),
    pendingWork: String(doc.pendingWork ?? ""),
    blockerNotes: String(doc.blockerNotes ?? ""),
    waitingOn: String(doc.waitingOn ?? ""),
    assistanceRequired: String(doc.assistanceRequired ?? ""),
    nextAction: String(doc.nextAction ?? ""),
    expectedContinuationDate: doc.expectedContinuationDate ?? null,
    priority: String(doc.priority ?? "medium"),
    dueDate: doc.dueDate ?? null,
    originalAssignedDate: doc.originalAssignedDate ?? null,
    currentWorkingDate: doc.currentWorkingDate ?? null,
    assigneeId: doc.assigneeId ? String(doc.assigneeId) : null,
    originalOwnerId: doc.originalOwnerId ? String(doc.originalOwnerId) : null,
    delegatedFromId: doc.delegatedFromId ? String(doc.delegatedFromId) : null,
    isDelegated: Boolean(doc.isDelegated),
    minutesWorked: doc.minutesWorked == null ? null : Number(doc.minutesWorked),
  };
}

/**
 * Generate the employee draft. Idempotent per employee/type/period so a double
 * checkout click or a retried recovery request can never create two reports.
 * Returns `created:false` when there is no work to report (empty compactions
 * are never persisted).
 */
export async function generateEmployeeCompactionDraft(input: {
  employeeId: string;
  type: CompactionType;
  reportingDate?: Date;
  source?: "attendance_checkout" | "manual" | "recovery" | "api";
  attendanceId?: string | null;
  checkoutAt?: Date | null;
  workSessionStart?: Date | null;
  workSessionEnd?: Date | null;
  requireCheckout?: boolean;
  allowMultipleSessions?: boolean;
  createdBy?: string | null;
  boardId?: string | null;
}): Promise<{ compaction: AnyDoc | null; created: boolean; reason?: string }> {
  await connectDb();
  const context = await getEmployeeContext(input.employeeId);
  if (!context) return { compaction: null, created: false, reason: "user_not_found" };
  if (!context.company) return { compaction: null, created: false, reason: "no_company" };

  const timeZone = context.timeZone;
  let selectedBoard: AnyDoc | null = null;
  if (input.boardId) {
    selectedBoard = (await Board.findOne({
      _id: input.boardId,
      $or: [{ owner: input.employeeId }, { "members.user": input.employeeId }],
    }).select("_id title")) as AnyDoc | null;
    if (!selectedBoard) return { compaction: null, created: false, reason: "board_not_accessible" };
  }
  const reportingDate = input.reportingDate ?? new Date();
  const periodKey =
    input.type === "EOW"
      ? weekKeyInTimeZone(reportingDate, timeZone)
      : dateKeyInTimeZone(reportingDate, timeZone);
  const sessionSuffix =
    input.type === "EOW" && input.allowMultipleSessions && input.workSessionStart
      ? `:${new Date(input.workSessionStart).toISOString()}`
      : "";
  const idempotencyKey =
    compactionIdempotencyKey(input.type, input.employeeId, periodKey, input.boardId) + sessionSuffix;

  const existing = await TaskCompaction.findOne({ idempotencyKey });
  if (existing) return { compaction: existing as AnyDoc, created: false, reason: "exists" };

  if (input.requireCheckout) {
    const range = rangeFor(input.type, reportingDate, timeZone);
    const checkout = await Attendance.findOne({
      user: input.employeeId,
      checkOut: { $ne: null },
      date: { $gte: range.start, $lte: range.end },
    }).select("_id checkOut");
    if (!checkout) {
      return { compaction: null, created: false, reason: "checkout_required" };
    }
    input.attendanceId = input.attendanceId ?? String(checkout._id);
    input.checkoutAt = input.checkoutAt ?? (checkout.checkOut as Date);
  }

  const range = rangeFor(input.type, reportingDate, timeZone);
  await syncTakenBoardTasksToContinuity({
    employeeId: input.employeeId,
    companyId: String(context.company._id),
    boardId: input.boardId,
    range,
  });
  const todos = (await BoardTodo.find({
    assigneeId: input.employeeId,
    ...(input.boardId ? { board: input.boardId } : {}),
    status: { $nin: ["cancelled"] },
    $or: [
      { currentWorkingDate: { $gte: range.start, $lte: range.end } },
      { originalAssignedDate: { $gte: range.start, $lte: range.end } },
      { updatedAt: { $gte: range.start, $lte: range.end } },
    ],
  })
    .sort({ priority: 1, dueDate: 1, createdAt: 1 })
    .limit(300)) as AnyDoc[];

  if (!todos.length) return { compaction: null, created: false, reason: "empty" };

  const logs = (await TodoProgressLog.find({
    employee: input.employeeId,
    workingDate: { $gte: range.start, $lte: range.end },
  })
    .sort({ createdAt: -1 })
    .limit(600)) as AnyDoc[];

  const snapshots = todos.map((todo) => {
    const raw = todo.toObject ? todo.toObject() : todo;
    const log = progressLogFor(String(todo._id), logs);
    return buildTodoSnapshot({
      ...raw,
      progressLog: log
        ? {
            workNotes: String(log.workNotes ?? ""),
            remainingWork: String(log.remainingWork ?? ""),
            blockerNotes: String(log.blockerNotes ?? ""),
            minutesWorked: log.minutesWorked == null ? null : Number(log.minutesWorked),
          }
        : null,
    });
  });

  const content = contentFromSnapshots(snapshots);
  if (!hasCompactionContent(content)) {
    return { compaction: null, created: false, reason: "empty" };
  }

  const compaction = await TaskCompaction.create({
    company: context.company._id,
    employee: input.employeeId,
    employeeName: context.name,
    employeeCode: context.code,
    team: context.team?._id ?? null,
    teamName: String(context.team?.name ?? ""),
    teamOwner: context.teamOwner?._id ?? null,
    teamOwnerName: String(context.teamOwner?.name ?? ""),
    board: selectedBoard?._id ?? null,
    boardName: String(selectedBoard?.title ?? ""),
    department: String(context.user.regionLabel ?? ""),
    reportingDate: range.start,
    reportingDateKey: periodKey,
    compactionType: input.type,
    workSessionStart: input.workSessionStart ?? null,
    workSessionEnd: input.workSessionEnd ?? null,
    summary: content.nextActions ?? "",
    content: { ...emptyCompactionContent(), ...content },
    status: "awaiting_confirmation",
    source: input.source ?? "manual",
    attendance: input.attendanceId ?? null,
    checkoutAt: input.checkoutAt ?? null,
    idempotencyKey,
    createdBy: input.createdBy ?? input.employeeId,
  });

  await Promise.all(
    snapshots.map((snapshot) =>
      CompactionTodo.updateOne(
        { compaction: compaction._id, todo: snapshot.todoId },
        {
          $setOnInsert: {
            company: context.company?._id ?? null,
            compaction: compaction._id,
            todo: snapshot.todoId,
            task: snapshot.taskId,
            category: snapshot.category,
            title: snapshot.title,
            project: snapshot.project,
            statusAtSubmission: snapshot.statusAtSubmission,
            progress: snapshot.progress,
            completedWork: snapshot.completedWork,
            remainingWork: snapshot.remainingWork,
            pendingWork: snapshot.pendingWork,
            blockerNotes: snapshot.blockerNotes,
            waitingOn: snapshot.waitingOn,
            assistanceRequired: snapshot.assistanceRequired,
            nextAction: snapshot.nextAction,
            expectedContinuationDate: snapshot.expectedContinuationDate,
            priority: snapshot.priority,
            dueDate: snapshot.dueDate,
            originalAssignedDate: snapshot.originalAssignedDate,
            currentWorkingDate: snapshot.currentWorkingDate,
            assigneeId: snapshot.assigneeId,
            originalOwnerId: snapshot.originalOwnerId,
            delegatedFromId: snapshot.delegatedFromId,
            isDelegated: snapshot.isDelegated,
            minutesWorked: snapshot.minutesWorked,
          },
        },
        { upsert: true },
      ),
    ),
  );

  await notifyUsers([input.employeeId], {
    title: `${input.type} compaction draft ready`,
    message: `Review and confirm your ${periodLabel(input.type, reportingDate, timeZone)} compaction before it is sent to your Team Owner.`,
    link: "/profile/compactions",
    company: context.company._id,
    team: context.team?._id,
  });

  await recordAudit({
    action: "compaction.draft.generated",
    actionLabel: `${input.type} compaction draft generated`,
    company: context.company._id,
    actor: { id: input.createdBy ?? input.employeeId, name: context.name, role: String(context.user.role ?? "") },
    entityType: "TaskCompaction",
    entityId: String(compaction._id),
    metadata: { type: input.type, periodKey, source: input.source ?? "manual" },
  });

  return { compaction: compaction as AnyDoc, created: true };
}

export async function createEowDraft(input: {
  employeeId: string;
  reportingDate?: Date;
  workSessionStart?: Date | null;
  workSessionEnd?: Date | null;
  allowMultipleSessions?: boolean;
  boardId?: string | null;
}) {
  return generateEmployeeCompactionDraft({
    employeeId: input.employeeId,
    type: "EOW",
    reportingDate: input.reportingDate,
    source: "manual",
    workSessionStart: input.workSessionStart ?? null,
    workSessionEnd: input.workSessionEnd ?? null,
    requireCheckout: true,
    allowMultipleSessions: Boolean(input.allowMultipleSessions),
    boardId: input.boardId,
    createdBy: input.employeeId,
  });
}

function normalizeContent(value: unknown): CompactionContent {
  const input = (value ?? {}) as Record<string, unknown>;
  const list = (key: string) =>
    Array.isArray(input[key])
      ? (input[key] as unknown[]).map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 200)
      : [];
  return {
    completedWork: list("completedWork"),
    partialWork: list("partialWork"),
    pendingWork: list("pendingWork"),
    blockers: list("blockers"),
    decisions: String(input.decisions ?? "").slice(0, 8000),
    handoverNotes: String(input.handoverNotes ?? "").slice(0, 8000),
    risks: String(input.risks ?? "").slice(0, 8000),
    nextActions: String(input.nextActions ?? "").slice(0, 8000),
    additionalNotes: String(input.additionalNotes ?? "").slice(0, 8000),
    attachmentIds: list("attachmentIds"),
  };
}

export async function updateEmployeeCompaction(input: {
  compactionId: string;
  employeeId: string;
  content?: unknown;
  summary?: string;
  reasonForContinuing?: string;
  changeReason?: string;
}): Promise<AnyDoc> {
  await connectDb();
  const compaction = await TaskCompaction.findOne({
    _id: input.compactionId,
    employee: input.employeeId,
  });
  if (!compaction) throw new Error("Compaction not found.");
  if (!EMPLOYEE_EDITABLE_STATUSES.includes(String(compaction.status) as any)) {
    throw new Error("This compaction can no longer be edited.");
  }

  const previousContent = (compaction.content?.toObject?.() ?? compaction.content ?? {}) as AnyDoc;
  const nextContent = input.content === undefined
    ? (previousContent as CompactionContent)
    : normalizeContent(input.content);

  compaction.content = { ...emptyCompactionContent(), ...nextContent } as any;
  if (input.summary !== undefined) compaction.summary = String(input.summary).slice(0, 12000);
  if (input.reasonForContinuing !== undefined) {
    compaction.reasonForContinuing = String(input.reasonForContinuing).slice(0, 4000);
  }
  compaction.revisionNumber = Number(compaction.revisionNumber ?? 1) + 1;
  await compaction.save();

  await CompactionRevision.create({
    company: compaction.company,
    compaction: compaction._id,
    revisionNumber: compaction.revisionNumber,
    previousContent,
    updatedContent: compaction.content,
    changedBy: input.employeeId,
    changeReason: input.changeReason ?? "Draft edited",
    action: "edited",
  });

  return compaction as AnyDoc;
}

async function saveDelivery(input: {
  company: string | null;
  compactionId?: string | null;
  teamCompactionId?: string | null;
  recipient: AnyDoc;
  channel: "in_app" | "email";
  eventKey: string;
  link: string;
  subject?: string;
  text?: string;
  html?: string;
}): Promise<{ status: "pending" | "sent" | "failed"; skipped?: boolean; error?: string }> {
  const existing = await CompactionDelivery.findOne({ eventKey: input.eventKey });
  if (existing?.deliveryStatus === "sent") return { status: "sent", skipped: true };

  const delivery =
    existing ??
    new CompactionDelivery({
      company: input.company,
      compaction: input.compactionId ?? null,
      teamCompaction: input.teamCompactionId ?? null,
      recipient: input.recipient._id,
      recipientName: String(input.recipient.name ?? ""),
      recipientEmail: String(input.recipient.email ?? ""),
      recipientRole: String(input.recipient.role ?? ""),
      deliveryChannel: input.channel,
      eventKey: input.eventKey,
      link: input.link,
    });

  delivery.deliveryStatus = "pending";
  delivery.attempts = Number(delivery.attempts ?? 0) + 1;
  delivery.lastAttemptAt = new Date();
  delivery.errorDetails = "";
  await delivery.save();

  try {
    if (input.channel === "in_app") {
      await notifyUsers([String(input.recipient._id)], {
        title: input.subject ?? "New compaction",
        message: input.text ?? "A compaction is ready for review.",
        link: input.link,
        company: input.company,
      });
    } else {
      if (!input.recipient.email) throw new Error("Recipient has no email address.");
      await sendMail({
        to: String(input.recipient.email),
        subject: input.subject ?? "FlowZen compaction",
        text: input.text ?? "A compaction is ready for review.",
        html: input.html,
      });
    }
    delivery.deliveryStatus = "sent";
    delivery.deliveredAt = new Date();
  } catch (error) {
    delivery.deliveryStatus = "failed";
    delivery.errorDetails = String(error instanceof Error ? error.message : error).slice(0, 4000);
  }
  await delivery.save();
  return {
    status: delivery.deliveryStatus as "pending" | "sent" | "failed",
    error: delivery.errorDetails || undefined,
  };
}

export async function submitEmployeeCompaction(input: {
  compactionId: string;
  employeeId: string;
  content?: unknown;
  summary?: string;
  reasonForContinuing?: string;
}): Promise<AnyDoc> {
  await connectDb();
  let compaction = await TaskCompaction.findOne({
    _id: input.compactionId,
    employee: input.employeeId,
  });
  if (!compaction) throw new Error("Compaction not found.");

  // Idempotent confirmation: a duplicate submit returns the delivered report.
  if (String(compaction.status) === "submitted" && compaction.submittedAt) {
    return compaction as AnyDoc;
  }
  if (!EMPLOYEE_EDITABLE_STATUSES.includes(String(compaction.status) as any) && String(compaction.status) !== "submitted") {
    throw new Error("This compaction has already been delivered.");
  }

  if (input.content !== undefined || input.summary !== undefined || input.reasonForContinuing !== undefined) {
    compaction = (await updateEmployeeCompaction({
      compactionId: input.compactionId,
      employeeId: input.employeeId,
      content: input.content,
      summary: input.summary,
      reasonForContinuing: input.reasonForContinuing,
      changeReason: "Confirmed and submitted",
    })) as any;
  }

  const content = (compaction.content?.toObject?.() ?? compaction.content ?? {}) as CompactionContent;
  const todoCount = await CompactionTodo.countDocuments({ compaction: compaction._id });
  if (!hasCompactionContent(content) && todoCount === 0) {
    throw new Error("Add at least one work item before submitting the compaction.");
  }

  const now = new Date();
  compaction.status = "submitted";
  compaction.confirmedAt = now;
  compaction.submittedAt = now;
  await compaction.save();

  const context = await getEmployeeContext(input.employeeId);
  const companyId = String(compaction.company ?? context?.company?._id ?? "");
  const link = compaction.teamOwner
    ? "/profile/team-compactions"
    : "/profile/compactions?scope=received";
  const timeZone = context?.timeZone ?? resolveTimeZone(null);
  const label = periodLabel(String(compaction.compactionType) as CompactionType, compaction.reportingDate as Date, timeZone);
  const companyDoc = context?.company
    ? { name: String(context.company.name ?? ""), icon: String(context.company.icon ?? "") }
    : undefined;
  const email = employeeCompactionEmailContent({
    employeeName: String(compaction.employeeName ?? context?.name ?? ""),
    employeeCode: String(compaction.employeeCode ?? context?.code ?? ""),
    teamName: String(compaction.teamName ?? ""),
    type: String(compaction.compactionType) as CompactionType,
    periodLabel: label,
    summary: String(compaction.summary ?? ""),
    content,
    link: appUrl(link),
    company: companyDoc,
  });

  let teamOwner = compaction.teamOwner
    ? await User.findById(compaction.teamOwner).select("name email role")
    : null;
  if (!teamOwner) {
    const admins = await getCompanyAdminRecipients(companyId);
    teamOwner = admins[0] ?? null;
  }

  if (teamOwner) {
    const ownerId = String(teamOwner._id);
    const recipientLabel = compaction.teamOwner ? "Team Owner" : "Admin";
    const inApp = await saveDelivery({
      company: companyId || null,
      compactionId: String(compaction._id),
      recipient: teamOwner as AnyDoc,
      channel: "in_app",
      eventKey: deliveryEventKey("compaction", String(compaction._id), ownerId, "in_app"),
      link,
      subject: `${compaction.compactionType} compaction from ${compaction.employeeName}`,
      text: `${compaction.employeeName} submitted a ${compaction.compactionType} compaction to the ${recipientLabel} for ${label}.`,
    });
    const emailResult = await saveDelivery({
      company: companyId || null,
      compactionId: String(compaction._id),
      recipient: teamOwner as AnyDoc,
      channel: "email",
      eventKey: deliveryEventKey("compaction", String(compaction._id), ownerId, "email"),
      link: appUrl(link),
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (inApp.status === "sent") compaction.deliveredToTeamOwnerAt = now;
    if (emailResult.status === "sent") compaction.emailSentAt = now;
    compaction.status =
      inApp.status === "sent"
        ? "delivered_to_team_owner"
        : emailResult.status === "sent"
          ? "email_sent"
          : "delivery_failed";
  } else {
    compaction.status = "delivery_failed";
  }
  await compaction.save();

  await recordAudit({
    action: "compaction.submitted",
    actionLabel: `${compaction.compactionType} compaction submitted`,
    company: companyId || null,
    actor: { id: input.employeeId, name: String(compaction.employeeName ?? ""), role: String(context?.user.role ?? "") },
    entityType: "TaskCompaction",
    entityId: String(compaction._id),
    metadata: { periodKey: compaction.reportingDateKey, delivered: Boolean(teamOwner) },
  });

  return compaction as AnyDoc;
}

export async function reviewEmployeeCompaction(input: {
  compactionId: string;
  reviewerId: string;
  action: "comment" | "reviewed" | "correction_requested";
  body: string;
}): Promise<AnyDoc> {
  await connectDb();
  const compaction = await TaskCompaction.findById(input.compactionId);
  if (!compaction) throw new Error("Compaction not found.");
  const access = await userCanReviewCompaction(input.reviewerId, compaction as AnyDoc);
  if (!access.ok) throw new Error("You are not allowed to review this compaction.");

  const body = String(input.body ?? "").trim().slice(0, 4000);
  if (!body && input.action !== "reviewed") throw new Error("A comment is required.");

  const reviewer = await User.findById(input.reviewerId).select("name");
  compaction.reviewComments.push({
    user: input.reviewerId,
    body: body || "Marked as reviewed",
    action: input.action,
  } as any);

  if (input.action === "correction_requested") {
    compaction.reviewStatus = "correction_requested";
    compaction.status = "correction_requested";
    compaction.hasOpenCorrection = true;
  } else if (input.action === "reviewed") {
    compaction.reviewStatus = "reviewed";
    compaction.hasOpenCorrection = false;
  }
  compaction.revisionNumber = Number(compaction.revisionNumber ?? 1) + 1;
  await compaction.save();

  await CompactionRevision.create({
    company: compaction.company,
    compaction: compaction._id,
    revisionNumber: compaction.revisionNumber,
    previousContent: {},
    updatedContent: { action: input.action, body },
    changedBy: input.reviewerId,
    changeReason: body,
    action: input.action,
  });

  await notifyUsers([String(compaction.employee)], {
    title:
      input.action === "correction_requested"
        ? "Compaction correction requested"
        : input.action === "reviewed"
          ? "Compaction reviewed"
          : "New comment on your compaction",
    message:
      input.action === "correction_requested"
        ? `${reviewer?.name ?? "Your Team Owner"} requested a correction: ${body}`
        : `${reviewer?.name ?? "Your Team Owner"} ${input.action === "reviewed" ? "marked your compaction reviewed" : "commented on your compaction"}.`,
    link: "/profile/compactions",
    company: compaction.company,
    type: input.action === "correction_requested" ? "approval" : "info",
  });

  await recordAudit({
    action: "compaction.reviewed",
    actionLabel: `Compaction ${input.action.replace("_", " ")}`,
    company: compaction.company,
    actor: { id: input.reviewerId, name: String(reviewer?.name ?? "") },
    entityType: "TaskCompaction",
    entityId: String(compaction._id),
    metadata: { action: input.action },
  });

  return compaction as AnyDoc;
}

export async function getTeamOwnerTeams(userId: string): Promise<AnyDoc[]> {
  await connectDb();
  return (await Team.find({ manager: userId }).sort({ name: 1 })) as AnyDoc[];
}

export async function resolveTeamReportRecipients(input: {
  companyId: string;
  teamId: string;
  sourceCompactionIds: string[];
  excludeUserIds?: string[];
}): Promise<AnyDoc[]> {
  const ids: unknown[] = [];
  const company = await Company.findById(input.companyId).select("owner name icon");
  ids.push(company?.owner);

  const admins = await User.find({
    company: input.companyId,
    companyStatus: "approved",
    role: "admin",
  }).select("_id");
  ids.push(...admins.map((admin) => admin._id));

  const taskIds = await CompactionTodo.distinct("task", {
    compaction: { $in: input.sourceCompactionIds },
    task: { $ne: null },
  });
  if (taskIds.length) {
    const tasks = await Task.find({ _id: { $in: taskIds } }).select("owner createdBy board");
    const boardIds = uniqueIds(tasks.map((task) => task.board));
    const boards = boardIds.length
      ? await Board.find({ _id: { $in: boardIds } }).select("owner")
      : [];
    ids.push(
      ...tasks.flatMap((task) => [task.owner, task.createdBy]),
      ...boards.map((board) => board.owner),
    );
  }

  const excluded = new Set((input.excludeUserIds ?? []).map(String));
  const finalIds = uniqueIds(ids).filter((id) => !excluded.has(id));
  const users = await User.find({
    _id: { $in: finalIds },
    company: input.companyId,
    companyStatus: "approved",
  }).select("name email role");
  return users as AnyDoc[];
}

export async function createTeamCompactionDraft(input: {
  teamOwnerId: string;
  teamId: string;
  periodStart?: Date;
  periodEnd?: Date;
  sourceCompactionIds?: string[];
  exclusions?: { id: string; reason: string }[];
}): Promise<AnyDoc> {
  await connectDb();
  const team = await Team.findById(input.teamId);
  if (!team) throw new Error("Team not found.");
  const isOwner = String(team.manager) === String(input.teamOwnerId);
  const isAdmin = await userIsCompanyAdmin(input.teamOwnerId, String(team.company));
  if (!isOwner && !isAdmin) throw new Error("Only the Team Owner can build this report.");

  const company = await Company.findById(team.company).select("name icon timeZone");
  if (!company) throw new Error("Company not found.");
  const timeZone = resolveTimeZone(company.timeZone);
  const period = input.periodStart && input.periodEnd
    ? { start: new Date(input.periodStart), end: new Date(input.periodEnd) }
    : weekRangeInTimeZone(new Date(), timeZone);
  const weekKey = weekKeyInTimeZone(period.start, timeZone);

  const requestedIds = uniqueIds(input.sourceCompactionIds ?? []);
  const candidateFilter: Record<string, unknown> = {
    company: team.company,
    team: team._id,
    reportingDate: { $gte: period.start, $lte: period.end },
    status: { $in: ACTIONABLE_COMPACTION_STATUSES },
  };
  if (requestedIds.length) candidateFilter._id = { $in: requestedIds };

  const compactions = (await TaskCompaction.find(candidateFilter)
    .sort({ reportingDate: 1, createdAt: 1 })) as AnyDoc[];
  if (!compactions.length) throw new Error("No submitted employee compactions were found for this period.");

  const compactionIds = compactions.map((item) => item._id);
  const todoDocs = (await CompactionTodo.find({ compaction: { $in: compactionIds } })) as AnyDoc[];

  const sources: TeamSourceLike[] = compactions.map((compaction) => {
    const todos = todoDocs
      .filter((todo) => String(todo.compaction) === String(compaction._id))
      .map(snapshotFromCompactionTodo);
    const content = (compaction.content?.toObject?.() ?? compaction.content ?? emptyCompactionContent()) as CompactionContent;
    return {
      employee: String(compaction.employee),
      employeeName: String(compaction.employeeName ?? ""),
      sourceCompactionId: String(compaction._id),
      compactionType: String(compaction.compactionType),
      summary: String(compaction.summary ?? ""),
      content,
      todos,
    };
  });

  const teamEmployees = await User.find({
    company: team.company,
    $or: [{ team: team._id }, { _id: { $in: (team.employees ?? []) as unknown[] } }],
    companyStatus: "approved",
  }).select("name companyIdentityCode");
  const expected = teamEmployees.map((employee) => ({
    employee: String(employee._id),
    employeeName: String(employee.name ?? ""),
    employeeCode: String(employee.companyIdentityCode ?? ""),
  }));

  const exclusions = input.exclusions ?? [];
  const excludedIds = exclusions.map((item) => String(item.id));
  const consolidation = consolidateTeamReports({
    teamName: String(team.name ?? ""),
    teamOwnerName: String((await User.findById(team.manager).select("name"))?.name ?? ""),
    periodStart: period.start,
    periodEnd: period.end,
    expectedEmployees: expected,
    sources,
    excludedSourceIds: excludedIds,
    exclusionReasons: exclusions.map((item) => `${item.id}: ${item.reason}`),
  });

  const idempotencyKey = `TEAM:${team._id}:${weekKey}:${period.start.toISOString()}`;
  const existing = await TeamCompaction.findOne({ idempotencyKey });
  if (existing) return existing as AnyDoc;

  const teamCompaction = await TeamCompaction.create({
    company: team.company,
    team: team._id,
    teamName: String(team.name ?? ""),
    teamOwner: team.manager,
    teamOwnerName: consolidation.content.overview.teamOwnerName,
    reportingPeriodStart: period.start,
    reportingPeriodEnd: period.end,
    reportingPeriodKey: weekKey,
    summary: consolidation.content.overallSummary,
    content: consolidation.content,
    status: "awaiting_team_owner_confirmation",
    idempotencyKey,
    createdBy: input.teamOwnerId,
  });

  await Promise.all(
    compactions.map(async (compaction) => {
      const excluded = excludedIds.includes(String(compaction._id));
      const reason = exclusions.find((item) => String(item.id) === String(compaction._id))?.reason ?? "";
      const source = sources.find((item) => item.sourceCompactionId === String(compaction._id));
      await TeamCompactionSource.updateOne(
        { teamCompaction: teamCompaction._id, employeeCompaction: compaction._id },
        {
          $setOnInsert: {
            teamCompaction: teamCompaction._id,
            employeeCompaction: compaction._id,
            inclusionStatus: excluded ? "excluded" : "included",
            exclusionReason: reason,
            employee: compaction.employee,
            employeeName: compaction.employeeName,
            compactionType: compaction.compactionType,
            reportingDate: compaction.reportingDate,
            sourceSummary: compaction.summary,
            sourceContent: source?.content ?? {},
            includedBy: excluded ? null : input.teamOwnerId,
            excludedBy: excluded ? input.teamOwnerId : null,
          },
        },
        { upsert: true },
      );
      if (!excluded) {
        await TaskCompaction.updateOne(
          { _id: compaction._id },
          { $set: { includedInTeamCompaction: true } },
        );
      }
    }),
  );

  await recordAudit({
    action: "team_compaction.draft.created",
    actionLabel: "Team compaction draft created",
    company: team.company,
    actor: { id: input.teamOwnerId },
    entityType: "TeamCompaction",
    entityId: String(teamCompaction._id),
    metadata: {
      periodKey: weekKey,
      sources: compactions.length,
      missingReports: consolidation.content.overview.missingReports.length,
    },
  });

  return teamCompaction as AnyDoc;
}

export async function updateTeamCompaction(input: {
  teamCompactionId: string;
  actorId: string;
  overallSummary?: string;
  nextPeriodPlan?: string;
  adminSupportRequired?: string;
  content?: unknown;
}): Promise<AnyDoc> {
  await connectDb();
  const compaction = await TeamCompaction.findById(input.teamCompactionId);
  if (!compaction) throw new Error("Team compaction not found.");
  const isOwner = String(compaction.teamOwner) === String(input.actorId);
  const isAdmin = await userIsCompanyAdmin(input.actorId, String(compaction.company));
  if (!isOwner && !isAdmin) throw new Error("You are not allowed to edit this team compaction.");
  if (!TEAM_EDITABLE_STATUSES.includes(String(compaction.status) as any)) {
    throw new Error("This team compaction can no longer be edited.");
  }

  const previousContent = compaction.content?.toObject?.() ?? compaction.content ?? {};
  const current = (previousContent ?? {}) as AnyDoc;
  const next = input.content && typeof input.content === "object"
    ? { ...current, ...(input.content as Record<string, unknown>) }
    : { ...current };
  if (input.overallSummary !== undefined) next.overallSummary = String(input.overallSummary).slice(0, 12000);
  if (input.nextPeriodPlan !== undefined) next.nextPeriodPlan = String(input.nextPeriodPlan).slice(0, 8000);
  if (input.adminSupportRequired !== undefined) {
    next.adminSupportRequired = String(input.adminSupportRequired).slice(0, 8000);
  }
  compaction.content = next as any;
  if (input.overallSummary !== undefined) compaction.summary = String(input.overallSummary).slice(0, 20000);
  compaction.revisionNumber = Number(compaction.revisionNumber ?? 1) + 1;
  await compaction.save();

  await CompactionRevision.create({
    company: compaction.company,
    teamCompaction: compaction._id,
    revisionNumber: compaction.revisionNumber,
    previousContent,
    updatedContent: next,
    changedBy: input.actorId,
    changeReason: "Team consolidation edited",
    action: "edited",
  });

  return compaction as AnyDoc;
}

export async function updateTeamCompactionSources(input: {
  teamCompactionId: string;
  actorId: string;
  updates: {
    employeeCompactionId: string;
    inclusionStatus?: "included" | "excluded";
    exclusionReason?: string;
  }[];
}): Promise<AnyDoc> {
  await connectDb();
  const compaction = await TeamCompaction.findById(input.teamCompactionId);
  if (!compaction) throw new Error("Team compaction not found.");
  const isOwner = String(compaction.teamOwner) === String(input.actorId);
  const isAdmin = await userIsCompanyAdmin(input.actorId, String(compaction.company));
  if (!isOwner && !isAdmin) throw new Error("You are not allowed to edit this team compaction.");
  if (!TEAM_EDITABLE_STATUSES.includes(String(compaction.status) as any)) {
    throw new Error("This team compaction can no longer be edited.");
  }

  for (const update of input.updates) {
    if (!update.employeeCompactionId) continue;
    const source = await TeamCompactionSource.findOne({
      teamCompaction: compaction._id,
      employeeCompaction: update.employeeCompactionId,
    });
    if (!source) continue;
    if (update.inclusionStatus) {
      source.inclusionStatus = update.inclusionStatus;
      if (update.inclusionStatus === "included") {
        source.includedBy = input.actorId as any;
        source.excludedBy = null as any;
        source.exclusionReason = "";
      } else {
        source.excludedBy = input.actorId as any;
        source.includedBy = null as any;
        source.exclusionReason = String(
          update.exclusionReason ?? source.exclusionReason ?? "Excluded by Team Owner",
        ).slice(0, 2000);
      }
    } else if (update.exclusionReason !== undefined) {
      source.exclusionReason = String(update.exclusionReason).slice(0, 2000);
    }
    await source.save();
    await TaskCompaction.updateOne(
      { _id: update.employeeCompactionId },
      { $set: { includedInTeamCompaction: source.inclusionStatus === "included" } },
    );
  }

  const allSources = (await TeamCompactionSource.find({
    teamCompaction: compaction._id,
  })) as AnyDoc[];
  const includedSourceIds = allSources
    .filter((source) => source.inclusionStatus === "included")
    .map((source) => String(source.employeeCompaction));

  const compactions = includedSourceIds.length
    ? ((await TaskCompaction.find({ _id: { $in: includedSourceIds } })) as AnyDoc[])
    : [];
  const todoDocs = includedSourceIds.length
    ? ((await CompactionTodo.find({ compaction: { $in: includedSourceIds } })) as AnyDoc[])
    : [];

  const sources: TeamSourceLike[] = compactions.map((item) => {
    const todos = todoDocs
      .filter((todo) => String(todo.compaction) === String(item._id))
      .map(snapshotFromCompactionTodo);
    return {
      employee: String(item.employee),
      employeeName: String(item.employeeName ?? ""),
      sourceCompactionId: String(item._id),
      compactionType: String(item.compactionType),
      summary: String(item.summary ?? ""),
      content: (item.content?.toObject?.() ?? item.content ?? emptyCompactionContent()) as CompactionContent,
      todos,
    };
  });

  const team = await Team.findById(compaction.team).select("name employees");
  const teamEmployees = await User.find({
    company: compaction.company,
    $or: [{ team: compaction.team }, { _id: { $in: (team?.employees ?? []) as unknown[] } }],
    companyStatus: "approved",
  }).select("name companyIdentityCode");
  const expected = teamEmployees.map((employee) => ({
    employee: String(employee._id),
    employeeName: String(employee.name ?? ""),
    employeeCode: String(employee.companyIdentityCode ?? ""),
  }));

  const previousContent = (compaction.content?.toObject?.() ?? compaction.content ?? {}) as AnyDoc;
  const exclusionReasons = allSources
    .filter((source) => source.inclusionStatus === "excluded")
    .map((source) => `${String(source.employeeName ?? "")}: ${String(source.exclusionReason ?? "")}`);
  const consolidation = consolidateTeamReports({
    teamName: String(compaction.teamName ?? team?.name ?? ""),
    teamOwnerName: String(compaction.teamOwnerName ?? ""),
    periodStart: compaction.reportingPeriodStart as Date,
    periodEnd: compaction.reportingPeriodEnd as Date,
    expectedEmployees: expected,
    sources,
    excludedSourceIds: allSources
      .filter((source) => source.inclusionStatus === "excluded")
      .map((source) => String(source.employeeCompaction)),
    exclusionReasons,
  });

  const content = {
    ...consolidation.content,
    // Manual commentary written by the Team Owner is preserved when the source
    // selection changes; auto-generated sections are always recomputed.
    overallSummary: String(previousContent.overallSummary ?? ""),
    nextPeriodPlan: String(previousContent.nextPeriodPlan ?? ""),
    adminSupportRequired: String(previousContent.adminSupportRequired ?? ""),
    handovers: Array.isArray(previousContent.handovers) ? previousContent.handovers : [],
  };
  compaction.content = content as any;
  compaction.hasSourceCorrections = compactions.some(
    (item) => item.hasOpenCorrection || String(item.status) === "correction_requested",
  );
  compaction.revisionNumber = Number(compaction.revisionNumber ?? 1) + 1;
  await compaction.save();

  await CompactionRevision.create({
    company: compaction.company,
    teamCompaction: compaction._id,
    revisionNumber: compaction.revisionNumber,
    previousContent,
    updatedContent: content,
    changedBy: input.actorId,
    changeReason: "Source selection updated",
    action: "sources_updated",
  });

  await recordAudit({
    action: "team_compaction.sources_updated",
    actionLabel: "Team compaction sources updated",
    company: compaction.company ? String(compaction.company) : null,
    actor: { id: input.actorId },
    entityType: "TeamCompaction",
    entityId: String(compaction._id),
    metadata: {
      included: includedSourceIds.length,
      excluded: allSources.length - includedSourceIds.length,
    },
  });

  return compaction as AnyDoc;
}

export async function submitTeamCompaction(input: {
  teamCompactionId: string;
  actorId: string;
  overallSummary?: string;
  nextPeriodPlan?: string;
  adminSupportRequired?: string;
  content?: unknown;
}): Promise<AnyDoc> {
  await connectDb();
  let compaction = await TeamCompaction.findById(input.teamCompactionId);
  if (!compaction) throw new Error("Team compaction not found.");
  const isOwner = String(compaction.teamOwner) === String(input.actorId);
  const isAdmin = await userIsCompanyAdmin(input.actorId, String(compaction.company));
  if (!isOwner && !isAdmin) throw new Error("Only the Team Owner can submit this report.");

  if (String(compaction.status) === "submitted_to_admin" && compaction.submittedToAdminAt) {
    return compaction as AnyDoc;
  }
  if (!TEAM_EDITABLE_STATUSES.includes(String(compaction.status) as any) && String(compaction.status) !== "submitted_to_admin") {
    throw new Error("This team compaction has already been delivered.");
  }

  if (
    input.overallSummary !== undefined ||
    input.nextPeriodPlan !== undefined ||
    input.adminSupportRequired !== undefined ||
    input.content !== undefined
  ) {
    compaction = (await updateTeamCompaction({
      teamCompactionId: input.teamCompactionId,
      actorId: input.actorId,
      overallSummary: input.overallSummary,
      nextPeriodPlan: input.nextPeriodPlan,
      adminSupportRequired: input.adminSupportRequired,
      content: input.content,
    })) as any;
  }

  const sources = (await TeamCompactionSource.find({
    teamCompaction: compaction._id,
    inclusionStatus: "included",
  })) as AnyDoc[];
  if (!sources.length) throw new Error("Include at least one employee compaction before submitting.");

  const now = new Date();
  compaction.status = "submitted_to_admin";
  compaction.confirmedAt = now;
  compaction.submittedToAdminAt = now;
  await compaction.save();

  const company = await Company.findById(compaction.company).select("name icon timeZone");
  const timeZone = resolveTimeZone(company?.timeZone);
  const label = `${formatDateLabel(compaction.reportingPeriodStart as Date, timeZone)} – ${formatDateLabel(compaction.reportingPeriodEnd as Date, timeZone)}`;
  const content = (compaction.content?.toObject?.() ?? compaction.content ?? {}) as AnyDoc;
  const metrics = content.metrics ?? {};
  const link = "/profile/received-team-compactions";
  const email = teamCompactionEmailContent({
    teamName: String(compaction.teamName ?? ""),
    teamOwnerName: String(compaction.teamOwnerName ?? ""),
    periodLabel: label,
    overallSummary: String(content.overallSummary ?? ""),
    completed: Number(metrics.totalCompleted ?? 0),
    partial: Number(metrics.totalPartial ?? 0),
    pending: Number(metrics.totalPending ?? 0),
    blocked: Number(metrics.totalBlocked ?? 0),
    missingReports: Array.isArray(content.overview?.missingReports) ? content.overview.missingReports : [],
    pendingHandovers: Number(metrics.pendingHandovers ?? 0),
    adminSupportRequired: String(content.adminSupportRequired ?? ""),
    link: appUrl(link),
    company: company ? { name: String(company.name ?? ""), icon: String(company.icon ?? "") } : undefined,
  });

  const recipients = await resolveTeamReportRecipients({
    companyId: String(compaction.company),
    teamId: String(compaction.team),
    sourceCompactionIds: sources.map((source) => String(source.employeeCompaction)),
  });

  let anySent = false;
  let emailSent = false;
  for (const recipient of recipients) {
    const recipientId = String(recipient._id);
    const inApp = await saveDelivery({
      company: String(compaction.company),
      teamCompactionId: String(compaction._id),
      recipient,
      channel: "in_app",
      eventKey: deliveryEventKey("team-compaction", String(compaction._id), recipientId, "in_app"),
      link,
      subject: `Team compaction — ${compaction.teamName}`,
      text: `${compaction.teamOwnerName} submitted the team compaction for ${label}.`,
    });
    const emailResult = await saveDelivery({
      company: String(compaction.company),
      teamCompactionId: String(compaction._id),
      recipient,
      channel: "email",
      eventKey: deliveryEventKey("team-compaction", String(compaction._id), recipientId, "email"),
      link: appUrl(link),
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    anySent = anySent || inApp.status === "sent";
    emailSent = emailSent || emailResult.status === "sent";
  }

  compaction.status = anySent ? "delivered" : emailSent ? "email_sent" : "submitted_to_admin";
  if (anySent) compaction.deliveredAt = now;
  if (emailSent) compaction.emailSentAt = now;
  await compaction.save();

  await recordAudit({
    action: "team_compaction.submitted",
    actionLabel: "Team compaction submitted to admin",
    company: compaction.company,
    actor: { id: input.actorId, name: String(compaction.teamOwnerName ?? "") },
    entityType: "TeamCompaction",
    entityId: String(compaction._id),
    metadata: { recipients: recipients.length, sources: sources.length },
  });

  return compaction as AnyDoc;
}

export async function reviewTeamCompaction(input: {
  teamCompactionId: string;
  reviewerId: string;
  action: "comment" | "acknowledged" | "correction_requested" | "follow_up";
  body: string;
}): Promise<AnyDoc> {
  await connectDb();
  const compaction = await TeamCompaction.findById(input.teamCompactionId);
  if (!compaction) throw new Error("Team compaction not found.");
  const companyId = String(compaction.company);
  const isAdmin = await userIsCompanyAdmin(input.reviewerId, companyId);
  if (!isAdmin) throw new Error("Only a company admin or the company owner can review this report.");

  const body = String(input.body ?? "").trim().slice(0, 4000);
  if (!body && input.action !== "acknowledged") throw new Error("A comment is required.");

  const reviewer = await User.findById(input.reviewerId).select("name");
  const review = (compaction.adminReview?.toObject?.() ?? compaction.adminReview ?? {}) as AnyDoc;
  const comments = Array.isArray(review.comments) ? [...review.comments] : [];
  comments.push({
    user: input.reviewerId,
    body: body || "Acknowledged",
    action: input.action,
    createdAt: new Date(),
  });
  review.comments = comments;

  if (input.action === "acknowledged") {
    review.status = "acknowledged";
    review.acknowledgedAt = new Date();
    compaction.status = "acknowledged";
  } else if (input.action === "correction_requested") {
    review.status = "correction_requested";
    review.correctionRequestedAt = new Date();
    compaction.status = "correction_requested";
  } else if (input.action === "follow_up") {
    review.status = "under_review";
    review.followUpRequestedAt = new Date();
    compaction.status = "under_admin_review";
  } else {
    review.status = "under_review";
    compaction.status = "under_admin_review";
  }
  compaction.adminReview = review as any;
  compaction.revisionNumber = Number(compaction.revisionNumber ?? 1) + 1;
  await compaction.save();

  await CompactionRevision.create({
    company: compaction.company,
    teamCompaction: compaction._id,
    revisionNumber: compaction.revisionNumber,
    previousContent: {},
    updatedContent: { action: input.action, body },
    changedBy: input.reviewerId,
    changeReason: body,
    action: input.action === "correction_requested" ? "correction_requested" : "reviewed",
  });

  await notifyUsers([String(compaction.teamOwner)], {
    title:
      input.action === "correction_requested"
        ? "Team compaction correction requested"
        : "Team compaction reviewed",
    message:
      input.action === "correction_requested"
        ? `${reviewer?.name ?? "Admin"} requested a correction: ${body}`
        : `${reviewer?.name ?? "Admin"} ${input.action === "acknowledged" ? "acknowledged" : "commented on"} your team compaction.`,
    link: `/profile/team-compactions?report=${String(compaction._id)}`,
    company: compaction.company,
    type: input.action === "correction_requested" ? "approval" : "info",
  });

  await recordAudit({
    action: "team_compaction.reviewed",
    actionLabel: `Team compaction ${input.action.replace("_", " ")}`,
    company: compaction.company,
    actor: { id: input.reviewerId, name: String(reviewer?.name ?? "") },
    entityType: "TeamCompaction",
    entityId: String(compaction._id),
    metadata: { action: input.action },
  });

  return compaction as AnyDoc;
}

/** Delivery retry used by the recovery endpoint. */
export async function retryCompactionDelivery(input: {
  compactionId: string;
  actorId: string;
}): Promise<AnyDoc> {
  await connectDb();
  const compaction = await TaskCompaction.findById(input.compactionId);
  if (!compaction) throw new Error("Compaction not found.");
  const access = await userCanReviewCompaction(input.actorId, compaction as AnyDoc);
  if (!access.ok) throw new Error("You are not allowed to retry this delivery.");
  if (!compaction.teamOwner) throw new Error("No Team Owner is resolved for this compaction.");

  const recipient = await User.findById(compaction.teamOwner).select("name email role");
  if (!recipient) throw new Error("Team Owner not found.");
  const employeeContext = await getEmployeeContext(String(compaction.employee));
  const timeZone = employeeContext?.timeZone ?? resolveTimeZone(null);
  const label = periodLabel(String(compaction.compactionType) as CompactionType, compaction.reportingDate as Date, timeZone);
  const content = (compaction.content?.toObject?.() ?? compaction.content ?? emptyCompactionContent()) as CompactionContent;
  const email = employeeCompactionEmailContent({
    employeeName: String(compaction.employeeName ?? ""),
    employeeCode: String(compaction.employeeCode ?? ""),
    teamName: String(compaction.teamName ?? ""),
    type: String(compaction.compactionType) as CompactionType,
    periodLabel: label,
    summary: String(compaction.summary ?? ""),
    content,
    link: appUrl("/profile/team-compactions"),
    company: employeeContext?.company
      ? { name: String(employeeContext.company.name ?? ""), icon: String(employeeContext.company.icon ?? "") }
      : undefined,
  });

  const ownerId = String(recipient._id);
  const inApp = await saveDelivery({
    company: String(compaction.company),
    compactionId: String(compaction._id),
    recipient: recipient as AnyDoc,
    channel: "in_app",
    eventKey: deliveryEventKey("compaction", String(compaction._id), ownerId, "in_app"),
    link: "/profile/team-compactions",
    subject: `${compaction.compactionType} compaction from ${compaction.employeeName}`,
    text: `${compaction.employeeName} submitted a ${compaction.compactionType} compaction.`,
  });
  const delivery = await saveDelivery({
    company: String(compaction.company),
    compactionId: String(compaction._id),
    recipient: recipient as AnyDoc,
    channel: "email",
    eventKey: deliveryEventKey("compaction", String(compaction._id), ownerId, "email"),
    link: appUrl("/profile/team-compactions"),
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  if (inApp.status === "sent") compaction.deliveredToTeamOwnerAt = new Date();
  if (delivery.status === "sent") {
    compaction.emailSentAt = new Date();
    compaction.status = "delivered_to_team_owner";
  }
  await compaction.save();
  return compaction as AnyDoc;
}

/** Rollup used by dashboards without hydrating every todo document twice. */
export function compactionMetrics(snapshots: CompactionTodoSnapshot[]) {
  return rollupSnapshots(snapshots).metrics;
}

export { dateFromKey, dateKeyInTimeZone, weekKeyInTimeZone };
