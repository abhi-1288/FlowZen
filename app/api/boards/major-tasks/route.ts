import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  actorHasGlobalBoardAccess,
  canManageTask,
  getAccessibleTask,
  getContinuityActor,
} from "@/lib/continuity-access";
import { Notification } from "@/models/Notification";
import { emitToUser } from "@/lib/socket-emit";
import { Task } from "@/models/Task";
import { Board } from "@/models/Board";
import { Column } from "@/models/Column";
import { User } from "@/models/User";
import { BOARD_TASK_STATUSES } from "@/lib/work-constants";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function notifyAssignees(userIds: string[], payload: { title: string; message: string; link: string }) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return;
  await Notification.insertMany(
    ids.map((userId) => ({
      user: userId,
      type: "project",
      title: payload.title,
      message: payload.message,
      body: payload.message,
      link: payload.link,
    })),
  );
  ids.forEach((userId) => emitToUser(userId, "notification:new", { link: payload.link }));
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);

  const url = new URL(request.url);
  const boardId = url.searchParams.get("boardId") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const scope = url.searchParams.get("scope") ?? "mine";

  const filter: Record<string, unknown> = {};
  if (boardId) {
    if (!isObjectId(boardId)) return jsonError("Invalid board id.");
    if (!actor.boardIds.includes(boardId) && !actorHasGlobalBoardAccess(actor)) {
      return jsonError("Board not found.", 404);
    }
    filter.board = boardId;
  } else if (!actorHasGlobalBoardAccess(actor)) {
    filter.$or = [
      { owner: userId },
      { createdBy: userId },
      { assignees: userId },
      { board: { $in: actor.boardIds } },
      ...(actor.managesTeams.length ? [{ team: { $in: actor.managesTeams } }] : []),
    ];
  }
  if (actor.company) filter.company = actor.company;
  if (BOARD_TASK_STATUSES.includes(status as any)) filter.taskStatus = status;
  if (scope === "mine") filter.$and = [{ $or: [{ owner: userId }, { assignees: userId }] }];

  const tasks = await Task.find(filter)
    .populate("owner", "name email avatarUrl")
    .populate("team", "name")
    .populate("board", "title")
    .populate("assignees", "name email avatarUrl")
    .sort({ updatedAt: -1 })
    .limit(300);

  return NextResponse.json({ tasks: serializeDocs(tasks) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json();

  const boardId = String(body.boardId ?? body.board ?? "");
  const columnId = String(body.columnId ?? body.column ?? "");
  const title = String(body.title ?? "").trim();
  if (!isObjectId(boardId)) return jsonError("A valid board is required.");
  if (!isObjectId(columnId)) return jsonError("A valid column is required.");
  if (!title) return jsonError("Task title is required.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.boardIds.includes(boardId) && !actorHasGlobalBoardAccess(actor)) {
    return jsonError("You do not have access to this board.", 403);
  }

  const [board, column] = await Promise.all([
    Board.findById(boardId),
    Column.findOne({ _id: columnId, board: boardId }),
  ]);
  if (!board || !column) return jsonError("Board or column not found.", 404);

  const ownerId = String(body.owner ?? userId);
  if (!isObjectId(ownerId)) return jsonError("Invalid task owner.");
  const owner = await User.findOne({
    _id: ownerId,
    ...(actor.company ? { company: actor.company } : {}),
  }).select("name email");
  if (!owner) return jsonError("Task owner must be a member of your company.");

  const assignees = Array.isArray(body.assignees)
    ? body.assignees.filter((id: unknown) => typeof id === "string" && isObjectId(id))
    : [];
  if (assignees.length) {
    const valid = await User.countDocuments({
      _id: { $in: assignees },
      ...(actor.company ? { company: actor.company } : {}),
    });
    if (valid !== new Set(assignees).size) return jsonError("One or more assignees are invalid.");
  }

  const originalDeadline = parseDate(body.originalDeadline ?? body.dueDate);
  const order = await Task.countDocuments({ column: columnId });
  const task = await Task.create({
    board: boardId,
    column: columnId,
    company: actor.company,
    team: isObjectId(String(body.team ?? "")) ? String(body.team) : null,
    owner: ownerId,
    title,
    description: String(body.description ?? "").trim().slice(0, 3000),
    instructions: String(body.instructions ?? "").trim().slice(0, 5000),
    project: String(body.project ?? "").trim().slice(0, 160),
    department: String(body.department ?? "").trim().slice(0, 120),
    priority: ["low", "medium", "high"].includes(String(body.priority)) ? String(body.priority) : "medium",
    taskStatus: BOARD_TASK_STATUSES.includes(body.status as any) ? body.status : "not_started",
    startDate: parseDate(body.startDate),
    originalDeadline,
    revisedDeadline: parseDate(body.revisedDeadline) ?? originalDeadline,
    dueDate: originalDeadline,
    order,
    createdBy: userId,
    assignees: assignees.length ? assignees : [ownerId],
    dependencies: Array.isArray(body.dependencies) ? body.dependencies.slice(0, 50) : [],
    activity: [{ user: userId, action: "create", detail: "Major task created" }],
  });

  await recordAudit({
    action: "board_task.created",
    actionLabel: "Major board task created",
    company: actor.company,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "Task",
    entityId: String(task._id),
    metadata: { boardId, ownerId },
  });

  await notifyAssignees([ownerId, ...assignees], {
    title: "New major task assigned",
    message: `${actor.name} assigned you "${title}".`,
    link: `/board/${boardId}`,
  });

  return NextResponse.json({ task: serializeDoc(task) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json();
  const taskId = String(body.id ?? body.taskId ?? "");
  if (!isObjectId(taskId)) return jsonError("Invalid task id.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const access = await getAccessibleTask(taskId, actor);
  if (!access) return jsonError("Task not found.", 404);
  if (!canManageTask(access.task, actor)) {
    return jsonError("Only the task/board owner or an authorised manager can edit this task.", 403);
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title).trim().slice(0, 160);
  if (body.description !== undefined) updates.description = String(body.description).slice(0, 3000);
  if (body.instructions !== undefined) updates.instructions = String(body.instructions).slice(0, 5000);
  if (body.project !== undefined) updates.project = String(body.project).slice(0, 160);
  if (body.department !== undefined) updates.department = String(body.department).slice(0, 120);
  if (body.priority !== undefined && ["low", "medium", "high"].includes(String(body.priority))) {
    updates.priority = String(body.priority);
  }
  if (body.status !== undefined && BOARD_TASK_STATUSES.includes(body.status as any)) {
    updates.taskStatus = body.status;
  }
  if (body.startDate !== undefined) updates.startDate = parseDate(body.startDate);
  if (body.owner !== undefined && isObjectId(String(body.owner))) updates.owner = String(body.owner);
  if (body.assignees !== undefined && Array.isArray(body.assignees)) {
    updates.assignees = body.assignees.filter((id: unknown) => typeof id === "string" && isObjectId(id));
  }
  if (body.originalDeadline !== undefined) {
    const next = parseDate(body.originalDeadline);
    updates.originalDeadline = next;
    updates.dueDate = next;
  }
  if (body.revisedDeadline !== undefined) {
    const next = parseDate(body.revisedDeadline);
    updates.revisedDeadline = next;
    const previous = access.task.revisedDeadline ?? access.task.originalDeadline ?? null;
    if (String(previous ?? "") !== String(next ?? "")) {
      updates.$push = {
        deadlineHistory: {
          from: previous,
          to: next,
          reason: String(body.deadlineReason ?? "").slice(0, 2000),
          changedBy: userId,
          changedAt: new Date(),
        },
        activity: { user: userId, action: "deadline", detail: "Deadline revised" },
      };
    }
  }

  const { $push, ...setFields } = updates;
  const task = await Task.findByIdAndUpdate(
    taskId,
    {
      ...(Object.keys(setFields).length ? { $set: setFields } : {}),
      ...($push ? { $push } : {}),
    },
    { new: true },
  )
    .populate("owner", "name email")
    .populate("assignees", "name email");
  if (!task) return jsonError("Task not found.", 404);

  await recordAudit({
    action: "board_task.updated",
    actionLabel: "Major board task updated",
    company: actor.company,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "Task",
    entityId: taskId,
  });

  return NextResponse.json({ task: serializeDoc(task) });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const taskId = new URL(request.url).searchParams.get("id") ?? "";
  if (!isObjectId(taskId)) return jsonError("Invalid task id.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const access = await getAccessibleTask(taskId, actor);
  if (!access) return jsonError("Task not found.", 404);
  if (!canManageTask(access.task, actor)) return jsonError("Not allowed.", 403);

  await Task.updateOne({ _id: taskId }, { $set: { taskStatus: "cancelled" } });
  await recordAudit({
    action: "board_task.cancelled",
    actionLabel: "Major board task cancelled",
    company: actor.company,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "Task",
    entityId: taskId,
  });
  return NextResponse.json({ ok: true });
}
