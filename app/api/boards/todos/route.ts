import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  actorHasGlobalBoardAccess,
  canManageTodo,
  canUpdateTodoProgress,
  getAccessibleTask,
  getAccessibleTodo,
  getContinuityActor,
} from "@/lib/continuity-access";
import { notifyUsers } from "@/lib/compaction-service";
import { resolveTimeZone, startOfDayInTimeZone } from "@/lib/compaction";
import {
  BOARD_TODO_STATUSES,
  PRIORITIES,
  isBoardTodoStatus,
} from "@/lib/work-constants";
import { BoardTodo } from "@/models/BoardTodo";
import { TodoProgressLog } from "@/models/TodoProgressLog";
import { CompactionTodo } from "@/models/CompactionTodo";
import { Company } from "@/models/Company";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

const DIRECT_STATUSES = BOARD_TODO_STATUSES.filter(
  (status) => !["carried_forward", "delegation_pending", "delegated"].includes(status),
);

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function companyTimeZone(companyId: string | null): Promise<string> {
  if (!companyId) return resolveTimeZone(null);
  const company = await Company.findById(companyId).select("timeZone");
  return resolveTimeZone(company?.timeZone);
}

function idString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const record = value as { _id?: unknown; id?: unknown };
  return String(record._id ?? record.id ?? "");
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);

  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId") ?? "";
  const boardId = url.searchParams.get("boardId") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const scope = url.searchParams.get("scope") ?? "mine";
  const lineageId = url.searchParams.get("lineageId") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 300) || 300, 500);

  const filter: Record<string, unknown> = {};
  if (actor.company) filter.company = actor.company;

  if (taskId) {
    if (!isObjectId(taskId)) return jsonError("Invalid task id.");
    const access = await getAccessibleTask(taskId, actor);
    if (!access) return jsonError("Task not found.", 404);
    filter.task = taskId;
  } else if (boardId) {
    if (!isObjectId(boardId)) return jsonError("Invalid board id.");
    if (!actor.boardIds.includes(boardId) && !actorHasGlobalBoardAccess(actor)) {
      return jsonError("Board not found.", 404);
    }
    filter.board = boardId;
  }

  if (lineageId) {
    if (!isObjectId(lineageId)) return jsonError("Invalid lineage id.");
    filter.$or = [{ lineageRootId: lineageId }, { _id: lineageId }];
  }

  if (status && isBoardTodoStatus(status)) filter.status = status;

  if (scope === "mine") {
    filter.$and = [
      ...((filter.$and as unknown[]) ?? []),
      { $or: [{ assigneeId: userId }, { originalOwnerId: userId }] },
    ];
  } else if (scope === "team" && !actorHasGlobalBoardAccess(actor)) {
    const managedTasks = await Task.find({ team: { $in: actor.managesTeams } }).select("_id");
    filter.$and = [
      ...((filter.$and as unknown[]) ?? []),
      {
        $or: [
          { assigneeId: userId },
          { task: { $in: managedTasks.map((task) => task._id) } },
          { board: { $in: actor.boardIds } },
        ],
      },
    ];
  } else if (!actorHasGlobalBoardAccess(actor) && !taskId && !boardId) {
    const managedTasks = await Task.find({
      $or: [
        { owner: userId },
        { createdBy: userId },
        { assignees: userId },
        ...(actor.managesTeams.length ? [{ team: { $in: actor.managesTeams } }] : []),
      ],
    }).select("_id");
    filter.$and = [
      ...((filter.$and as unknown[]) ?? []),
      {
        $or: [
          { assigneeId: userId },
          { originalOwnerId: userId },
          { board: { $in: actor.boardIds } },
          { task: { $in: managedTasks.map((task) => task._id) } },
        ],
      },
    ];
  }

  const todos = await BoardTodo.find(filter)
    .populate("assigneeId", "name email avatarUrl")
    .populate("originalOwnerId", "name email avatarUrl")
    .populate("task", "title taskStatus")
    .populate("board", "title")
    .sort({ currentWorkingDate: -1, priority: 1, dueDate: 1, createdAt: -1 })
    .limit(limit);

  return NextResponse.json({ todos: serializeDocs(todos) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));

  const taskId = String(body.taskId ?? body.task ?? "");
  const title = String(body.title ?? "").trim();
  if (!isObjectId(taskId)) return jsonError("A valid major task is required.");
  if (!title) return jsonError("Todo title is required.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const access = await getAccessibleTask(taskId, actor);
  if (!access) return jsonError("Task not found.", 404);
  if (!actorHasGlobalBoardAccess(actor) && idString(access.task.owner) !== userId && !actor.boardIds.includes(idString(access.task.board))) {
    return jsonError("You cannot add todos to this task.", 403);
  }

  const task = access.task;
  const company = idString(task.company) || actor.company;
  const assigneeId = String(body.assigneeId ?? userId);
  if (!isObjectId(assigneeId)) return jsonError("Invalid assignee.");
  const assignee = await User.findOne({
    _id: assigneeId,
    ...(company ? { company } : {}),
  }).select("name email");
  if (!assignee) return jsonError("Assignee must be a member of your company.");

  const timeZone = await companyTimeZone(company);
  const now = new Date();
  const originalAssignedDate =
    parseDate(body.originalAssignedDate) ?? startOfDayInTimeZone(now, timeZone);
  const currentWorkingDate =
    parseDate(body.currentWorkingDate) ??
    parseDate(body.workingDate) ??
    originalAssignedDate;
  const dueDate = parseDate(body.dueDate);
  const status = DIRECT_STATUSES.includes(body.status) ? String(body.status) : "not_started";
  const priority = PRIORITIES.includes(body.priority) ? String(body.priority) : "medium";

  const todo = await BoardTodo.create({
    company: company || null,
    board: idString(task.board) || null,
    task: taskId,
    title,
    description: String(body.description ?? "").slice(0, 5000),
    instructions: String(body.instructions ?? "").slice(0, 5000),
    assigneeId,
    originalOwnerId: isObjectId(String(body.originalOwnerId ?? ""))
      ? String(body.originalOwnerId)
      : assigneeId,
    originalAssignedDate,
    currentWorkingDate,
    dueDate,
    priority,
    status,
    progress: Math.max(0, Math.min(100, Number(body.progress ?? 0) || 0)),
    completionNotes: String(body.completionNotes ?? "").slice(0, 5000),
    partialWorkNotes: String(body.partialWorkNotes ?? "").slice(0, 5000),
    remainingWork: String(body.remainingWork ?? "").slice(0, 5000),
    nextAction: String(body.nextAction ?? "").slice(0, 2000),
    expectedContinuationDate: parseDate(body.expectedContinuationDate),
    createdBy: userId,
    updatedBy: userId,
  });

  if (status !== "not_started" || todo.progress > 0) {
    await TodoProgressLog.create({
      company: company || null,
      todo: todo._id,
      task: taskId,
      employee: assigneeId,
      workingDate: currentWorkingDate,
      progress: todo.progress,
      workNotes: todo.description,
      status,
      remainingWork: todo.remainingWork,
      createdBy: userId,
    });
  }

  await recordAudit({
    action: "board_todo.created",
    actionLabel: "Board todo created",
    company: company || null,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "BoardTodo",
    entityId: String(todo._id),
    metadata: { taskId, assigneeId },
  });

  if (assigneeId !== userId) {
    await notifyUsers([assigneeId], {
      title: "New todo assigned",
      message: `${actor.name} added "${title}" to ${String(task.title ?? "a major task")}.`,
      link: "/boards?tab=my-todos",
      type: "project",
      company: company || null,
      team: task.team ?? null,
    });
  }

  return NextResponse.json({ todo: serializeDoc(todo) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  const todoId = String(body.id ?? body.todoId ?? "");
  if (!isObjectId(todoId)) return jsonError("Invalid todo id.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const access = await getAccessibleTodo(todoId, actor);
  if (!access) return jsonError("Todo not found.", 404);

  const todo = access.todo;
  const canEditDetails = canManageTodo(todo, actor);
  const canEditProgress = canUpdateTodoProgress(todo, actor);
  if (!canEditDetails && !canEditProgress) {
    return jsonError("You cannot update this todo.", 403);
  }

  const updates: Record<string, unknown> = {};
  const detailFields = [
    "title",
    "description",
    "instructions",
    "priority",
    "dueDate",
    "expectedContinuationDate",
    "remainingWork",
    "nextAction",
  ];
  const progressFields = [
    "status",
    "progress",
    "completionNotes",
    "partialWorkNotes",
    "remainingWork",
    "nextAction",
    "lastProgressAt",
  ];

  const allowed = canEditDetails ? [...detailFields, ...progressFields] : progressFields;
  for (const field of allowed) {
    if (body[field] === undefined) continue;
    if (field === "title") updates.title = String(body.title).trim().slice(0, 200);
    else if (field === "priority") {
      if (PRIORITIES.includes(body.priority)) updates.priority = String(body.priority);
    } else if (field === "status") {
      if (DIRECT_STATUSES.includes(body.status)) updates.status = String(body.status);
    } else if (field === "progress") {
      updates.progress = Math.max(0, Math.min(100, Number(body.progress) || 0));
    } else if (field === "dueDate" || field === "expectedContinuationDate") {
      updates[field] = parseDate(body[field]);
    } else if (field === "lastProgressAt") {
      updates.lastProgressAt = parseDate(body.lastProgressAt);
    } else {
      updates[field] = String(body[field] ?? "").slice(0, 5000);
    }
  }

  // Completed todos are immutable for their completion facts: once the record
  // says completed we never silently downgrade the reported work.
  const currentStatus = String(todo.status ?? "");
  if (
    ["completed", "approved"].includes(currentStatus) &&
    updates.status !== undefined &&
    updates.status !== currentStatus
  ) {
    if (!canEditDetails) return jsonError("Only a task owner can reopen completed work.", 403);
    updates.status = "reopened";
  }

  if (canEditDetails && body.addBlocker && typeof body.addBlocker === "object") {
    const blocker = body.addBlocker as Record<string, unknown>;
    updates.$push = {
      ...((updates.$push as Record<string, unknown>) ?? {}),
      blockers: {
        reason: String(blocker.reason ?? "").slice(0, 1000),
        waitingOn: String(blocker.waitingOn ?? "").slice(0, 200),
        escalated: Boolean(blocker.escalated),
        raisedBy: userId,
        raisedAt: new Date(),
        resolvedAt: null,
      },
      comments: {
        user: userId,
        body: String(body.comment ?? blocker.reason ?? "Blocker raised").slice(0, 2000),
      },
    };
  } else if (body.comment !== undefined) {
    updates.$push = {
      ...((updates.$push as Record<string, unknown>) ?? {}),
      comments: { user: userId, body: String(body.comment ?? "").slice(0, 2000) },
    };
  }

  if (body.resolveBlocker !== undefined) {
    const blockers = Array.isArray(todo.blockers) ? [...todo.blockers] : [];
    const index = Number(body.resolveBlocker);
    if (Number.isInteger(index) && blockers[index]) {
      blockers[index] = { ...blockers[index], resolvedAt: new Date() };
      updates.blockers = blockers;
    }
  }

  const progressRelevant =
    updates.status !== undefined ||
    updates.progress !== undefined ||
    updates.completionNotes !== undefined ||
    updates.partialWorkNotes !== undefined ||
    body.workNotes !== undefined ||
    body.remainingWork !== undefined ||
    body.blockerNotes !== undefined ||
    body.minutesWorked !== undefined;

  // `$push` is a Mongo update operator, not a field: it must be lifted out of
  // the `$set` document or MongoDB rejects the whole update.
  const { $push, ...setFields } = updates;
  const updated = await BoardTodo.findByIdAndUpdate(
    todoId,
    {
      ...(Object.keys(setFields).length ? { $set: setFields } : {}),
      ...($push ? { $push } : {}),
    },
    { new: true },
  )
    .populate("assigneeId", "name email avatarUrl")
    .populate("originalOwnerId", "name email avatarUrl");
  if (!updated) return jsonError("Todo not found.", 404);

  if (progressRelevant) {
    const workingDate = updated.currentWorkingDate ?? startOfDayInTimeZone(new Date());
    await TodoProgressLog.create({
      company: updated.company ?? null,
      todo: updated._id,
      task: updated.task,
      employee: idString(updated.assigneeId) || userId,
      workingDate,
      progress: Number(updated.progress ?? 0),
      workNotes: String(body.workNotes ?? updates.completionNotes ?? "").slice(0, 5000),
      status: String(updated.status ?? "in_progress"),
      remainingWork: String(body.remainingWork ?? updated.remainingWork ?? "").slice(0, 5000),
      blockerNotes: String(body.blockerNotes ?? "").slice(0, 5000),
      minutesWorked:
        body.minutesWorked === undefined || body.minutesWorked === null
          ? null
          : Math.max(0, Number(body.minutesWorked) || 0),
      createdBy: userId,
    });
    await BoardTodo.updateOne({ _id: todoId }, { $set: { lastProgressAt: new Date() } });
  }

  await recordAudit({
    action: "board_todo.updated",
    actionLabel: "Board todo updated",
    company: updated.company ? String(updated.company) : actor.company,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "BoardTodo",
    entityId: todoId,
    metadata: { status: String(updated.status ?? ""), progress: updated.progress },
  });

  return NextResponse.json({ todo: serializeDoc(updated) });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const todoId = new URL(request.url).searchParams.get("id") ?? "";
  if (!isObjectId(todoId)) return jsonError("Invalid todo id.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const access = await getAccessibleTodo(todoId, actor);
  if (!access) return jsonError("Todo not found.", 404);
  if (!canManageTodo(access.todo, actor)) return jsonError("Not allowed.", 403);

  // A todo that has already been captured in a compaction is evidence. Removing
  // it would break the report's source links, so it can only be reopened.
  const referenced = await CompactionTodo.countDocuments({ todo: todoId });
  if (referenced) {
    return jsonError("This todo is part of a submitted compaction and cannot be deleted.", 409);
  }
  const continuations = await BoardTodo.countDocuments({
    $or: [{ continuationOf: todoId }, { parentTodoId: todoId }],
  });
  if (continuations) {
    return jsonError("This todo has carried-forward continuations and cannot be deleted.", 409);
  }

  await Promise.all([
    BoardTodo.deleteOne({ _id: todoId }),
    TodoProgressLog.deleteMany({ todo: todoId }),
  ]);

  await recordAudit({
    action: "board_todo.deleted",
    actionLabel: "Board todo deleted",
    company: access.todo.company ? String(access.todo.company) : actor.company,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "BoardTodo",
    entityId: todoId,
  });

  return NextResponse.json({ ok: true });
}
