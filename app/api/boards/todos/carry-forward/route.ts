import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  canManageTodo,
  getAccessibleTodo,
  getContinuityActor,
} from "@/lib/continuity-access";
import {
  carryForwardKey,
  dateKeyInTimeZone,
  resolveTimeZone,
  startOfDayInTimeZone,
} from "@/lib/compaction";
import { notifyUsers } from "@/lib/compaction-service";
import { BOARD_TODO_STATUSES } from "@/lib/work-constants";
import { BoardTodo } from "@/models/BoardTodo";
import { TodoProgressLog } from "@/models/TodoProgressLog";
import { Company } from "@/models/Company";

const CARRY_ACTIONS = [
  "continue_tomorrow",
  "schedule",
  "blocked",
  "delegate",
  "request_assistance",
  "cancel",
] as const;

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function idString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const record = value as { _id?: unknown; id?: unknown };
  return String(record._id ?? record.id ?? "");
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  const todoId = String(body.todoId ?? body.id ?? "");
  if (!isObjectId(todoId)) return jsonError("Invalid todo id.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const access = await getAccessibleTodo(todoId, actor);
  if (!access) return jsonError("Todo not found.", 404);
  if (!canManageTodo(access.todo, actor)) {
    return jsonError("You cannot carry this todo forward.", 403);
  }

  const todo = access.todo;
  const currentStatus = String(todo.status ?? "");
  if (["completed", "approved"].includes(currentStatus)) {
    return jsonError("Completed work cannot be carried forward. Reopen it first.", 409);
  }

  const companyId = idString(todo.company) || actor.company;
  const company = companyId ? await Company.findById(companyId).select("timeZone") : null;
  const timeZone = resolveTimeZone(company?.timeZone);

  const target = parseDate(body.toDate ?? body.date ?? body.continuationDate) ?? new Date();
  const toDate = startOfDayInTimeZone(target, timeZone);
  const toDateKey = dateKeyInTimeZone(toDate, timeZone);

  const currentWorkingDate = todo.currentWorkingDate
    ? new Date(todo.currentWorkingDate)
    : startOfDayInTimeZone(new Date(), timeZone);
  if (toDateKey < dateKeyInTimeZone(currentWorkingDate, timeZone)) {
    return jsonError("A todo cannot be carried forward to an earlier date.", 409);
  }

  const key = carryForwardKey(todoId, toDateKey);
  const existing = await BoardTodo.findOne({ carryForwardKey: key });
  if (existing) {
    // Idempotent retry: the continuation already exists, so return it instead of
    // creating a duplicate record or mutating history twice.
    return NextResponse.json({
      todo: serializeDoc(existing),
      original: serializeDoc(await BoardTodo.findById(todoId)),
      created: false,
    });
  }

  const action = CARRY_ACTIONS.includes(body.action) ? String(body.action) : "schedule";
  const reason = String(body.reason ?? "").slice(0, 1000);
  const partialWorkNotes = String(
    body.partialWorkNotes ?? todo.partialWorkNotes ?? "",
  ).slice(0, 5000);
  const remainingWork = String(body.remainingWork ?? todo.remainingWork ?? "").slice(0, 5000);
  const nextAction = String(body.nextAction ?? todo.nextAction ?? "").slice(0, 2000);
  const expectedContinuationDate = parseDate(body.expectedContinuationDate) ?? toDate;

  const continuationStatus = ["partially_completed", "pending_review", "reopened"].includes(
    currentStatus,
  )
    ? "in_progress"
    : "not_started";

  let continuation;
  try {
    continuation = await BoardTodo.create({
      company: companyId || null,
      board: todo.board ?? null,
      task: todo.task,
      parentTodoId: todo._id,
      lineageRootId: todo.lineageRootId ?? todo._id,
      continuationOf: todo._id,
      carryForwardKey: key,
      title: String(todo.title ?? "").slice(0, 200),
      description: String(todo.description ?? "").slice(0, 5000),
      instructions: String(todo.instructions ?? "").slice(0, 5000),
      assigneeId: todo.assigneeId,
      // Ownership lineage is intentionally preserved; a continuation never
      // rewrites who originally owned the work.
      originalOwnerId: todo.originalOwnerId ?? todo.assigneeId,
      originalAssignedDate: todo.originalAssignedDate,
      currentWorkingDate: toDate,
      dueDate: todo.dueDate ?? null,
      priority: todo.priority ?? "medium",
      status: continuationStatus,
      progress: Math.max(0, Math.min(100, Number(todo.progress ?? 0))),
      dependencies: todo.dependencies ?? [],
      blockers: Array.isArray(todo.blockers)
        ? todo.blockers.filter((blocker: Record<string, unknown>) => !blocker.resolvedAt)
        : [],
      partialWorkNotes,
      remainingWork,
      nextAction,
      expectedContinuationDate,
      isContinuation: true,
      createdBy: userId,
      updatedBy: userId,
    });
  } catch (error) {
    // Two concurrent requests can race the unique key; recover the winner.
    const concurrent = await BoardTodo.findOne({ carryForwardKey: key });
    if (!concurrent) throw error;
    return NextResponse.json({
      todo: serializeDoc(concurrent),
      original: serializeDoc(await BoardTodo.findById(todoId)),
      created: false,
    });
  }

  const historyEntry = {
    fromDate: currentWorkingDate,
    toDate,
    reason,
    action,
    continuationTodoId: continuation._id,
    createdBy: userId,
    createdAt: new Date(),
  };
  const history = Array.isArray(todo.carryForwardHistory) ? [...todo.carryForwardHistory] : [];

  await BoardTodo.updateOne(
    { _id: todoId },
    {
      $set: {
        status: "carried_forward",
        partialWorkNotes,
        remainingWork,
        nextAction,
        expectedContinuationDate,
        updatedBy: userId,
        carryForwardHistory: [...history, historyEntry],
      },
    },
  );

  await TodoProgressLog.create({
    company: companyId || null,
    todo: todo._id,
    task: todo.task,
    employee: idString(todo.assigneeId) || userId,
    workingDate: currentWorkingDate,
    progress: Number(todo.progress ?? 0),
    workNotes: partialWorkNotes,
    status: "carried_forward",
    remainingWork,
    blockerNotes: reason,
    createdBy: userId,
  });

  const assigneeId = idString(todo.assigneeId);
  if (assigneeId && assigneeId !== userId) {
    await notifyUsers([assigneeId], {
      title: "Work carried forward",
      message: `"${String(todo.title ?? "A todo")}" has been carried forward to a new working day.`,
      link: "/boards?tab=my-todos",
      type: "project",
      company: companyId || null,
    });
  }

  await recordAudit({
    action: "board_todo.carried_forward",
    actionLabel: "Board todo carried forward",
    company: companyId || null,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "BoardTodo",
    entityId: todoId,
    metadata: { continuationTodoId: String(continuation._id), toDateKey, action },
  });

  return NextResponse.json(
    {
      todo: serializeDoc(continuation),
      original: serializeDoc(await BoardTodo.findById(todoId)),
      created: true,
    },
    { status: 201 },
  );
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const url = new URL(request.url);
  const todoId = url.searchParams.get("todoId") ?? "";
  if (!isObjectId(todoId)) return jsonError("Invalid todo id.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const access = await getAccessibleTodo(todoId, actor);
  if (!access) return jsonError("Todo not found.", 404);

  const rootId = access.todo.lineageRootId ?? access.todo._id;
  const chain = await BoardTodo.find({
    $or: [{ _id: rootId }, { lineageRootId: rootId }],
  })
    .populate("assigneeId", "name email avatarUrl")
    .sort({ createdAt: 1 });

  return NextResponse.json({
    chain: chain.map((item: any) => serializeDoc(item)),
    statuses: BOARD_TODO_STATUSES,
  });
}
