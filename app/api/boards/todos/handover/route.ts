import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  actorHasGlobalBoardAccess,
  canManageTodo,
  getAccessibleTodo,
  getContinuityActor,
} from "@/lib/continuity-access";
import { notifyUsers } from "@/lib/compaction-service";
import { BoardTodo } from "@/models/BoardTodo";
import { TaskHandover } from "@/models/TaskHandover";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

function idString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const record = value as { _id?: unknown; id?: unknown };
  return String(record._id ?? record.id ?? "");
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        id: String(record.id ?? ""),
        name: String(record.name ?? ""),
        url: String(record.url ?? ""),
      };
    })
    .filter((item) => item.id && item.name && item.url)
    .slice(0, 20);
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);

  const url = new URL(request.url);
  const todoId = url.searchParams.get("todoId") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const scope = url.searchParams.get("scope") ?? "all";

  const filter: Record<string, unknown> = {};
  if (actor.company) filter.company = actor.company;
  if (status) filter.status = status;

  if (todoId) {
    if (!isObjectId(todoId)) return jsonError("Invalid todo id.");
    const access = await getAccessibleTodo(todoId, actor);
    if (!access) return jsonError("Todo not found.", 404);
    filter.todo = todoId;
  } else if (scope === "incoming") {
    filter.toEmployee = userId;
  } else if (scope === "outgoing") {
    filter.$or = [{ fromEmployee: userId }, { requestedBy: userId }];
  } else if (scope === "team" && !actorHasGlobalBoardAccess(actor)) {
    const managedTasks = await Task.find({ team: { $in: actor.managesTeams } }).select("_id");
    const boardTodos = await BoardTodo.find({
      $or: [{ board: { $in: actor.boardIds } }, { task: { $in: managedTasks.map((task) => task._id) } }],
    }).select("_id");
    filter.todo = { $in: boardTodos.map((todo: any) => todo._id) };
  } else if (!actorHasGlobalBoardAccess(actor)) {
    filter.$or = [
      { fromEmployee: userId },
      { toEmployee: userId },
      { requestedBy: userId },
    ];
  }

  const handovers = await TaskHandover.find(filter)
    .populate("fromEmployee", "name email avatarUrl")
    .populate("toEmployee", "name email avatarUrl")
    .populate("requestedBy", "name email")
    .populate("todo", "title status assigneeId originalOwnerId currentWorkingDate")
    .sort({ createdAt: -1 })
    .limit(200);

  return NextResponse.json({ handovers: serializeDocs(handovers) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  const todoId = String(body.todoId ?? body.id ?? "");
  const toEmployeeId = String(body.toEmployeeId ?? body.toEmployee ?? "");
  const reason = String(body.reason ?? "").trim();
  if (!isObjectId(todoId)) return jsonError("Invalid todo id.");
  if (!isObjectId(toEmployeeId)) return jsonError("A valid recipient is required.");
  if (!reason) return jsonError("A handover reason is required.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const access = await getAccessibleTodo(todoId, actor);
  if (!access) return jsonError("Todo not found.", 404);
  if (!canManageTodo(access.todo, actor)) {
    return jsonError("You cannot delegate this todo.", 403);
  }

  const todo = access.todo;
  const fromEmployeeId = idString(todo.assigneeId);
  if (toEmployeeId === fromEmployeeId) {
    return jsonError("This todo is already assigned to that person.", 409);
  }
  if (["completed", "approved"].includes(String(todo.status ?? ""))) {
    return jsonError("Completed work cannot be delegated.", 409);
  }

  const companyId = idString(todo.company) || actor.company;
  const recipient = await User.findOne({
    _id: toEmployeeId,
    ...(companyId ? { company: companyId } : {}),
    companyStatus: "approved",
  }).select("name email role");
  if (!recipient) {
    return jsonError("The recipient must be an approved member of your company.", 403);
  }

  const existing = await TaskHandover.findOne({ todo: todoId, status: "pending" });
  if (existing) {
    return NextResponse.json(
      { handover: serializeDoc(existing), created: false },
      { status: 200 },
    );
  }

  const handover = await TaskHandover.create({
    company: companyId || null,
    todo: todoId,
    task: todo.task ?? null,
    fromEmployee: fromEmployeeId || userId,
    toEmployee: toEmployeeId,
    requestedBy: userId,
    reason: reason.slice(0, 2000),
    instructions: String(body.instructions ?? "").slice(0, 5000),
    attachments: normalizeAttachments(body.attachments),
    status: "pending",
    previousAssignee: fromEmployeeId || null,
  });

  await BoardTodo.updateOne(
    { _id: todoId },
    {
      $set: { status: "delegation_pending", updatedBy: userId },
      $push: {
        delegationHistory: {
          from: fromEmployeeId || null,
          to: toEmployeeId,
          status: "requested",
          reason: reason.slice(0, 1000),
          at: new Date(),
        },
      },
    },
  );

  const task = todo.task ? await Task.findById(todo.task).select("title") : null;
  await notifyUsers([toEmployeeId], {
    title: "Delegation request received",
    message: `${actor.name} wants to hand over "${String(todo.title ?? "a todo")}" to you.`,
    link: "/boards?tab=delegated-work",
    type: "approval",
    company: companyId || null,
  });
  if (fromEmployeeId && fromEmployeeId !== userId) {
    await notifyUsers([fromEmployeeId], {
      title: "Work handover requested",
      message: `${actor.name} requested a handover of "${String(todo.title ?? "a todo")}".`,
      link: "/boards?tab=delegated-work",
      type: "info",
      company: companyId || null,
    });
  }
  if (todo.originalOwnerId && idString(todo.originalOwnerId) !== userId) {
    await notifyUsers([idString(todo.originalOwnerId)], {
      title: "Delegation requested",
      message: `"${String(task?.title ?? todo.title ?? "A task")}" is being handed over.`,
      link: "/boards?tab=delegated-work",
      type: "info",
      company: companyId || null,
    });
  }

  await recordAudit({
    action: "board_todo.handover_requested",
    actionLabel: "Todo handover requested",
    company: companyId || null,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "TaskHandover",
    entityId: String(handover._id),
    metadata: { todoId, fromEmployeeId, toEmployeeId },
  });

  return NextResponse.json({ handover: serializeDoc(handover), created: true }, { status: 201 });
}
