import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { Notification } from "@/models/Notification";
import { findAccessibleBoard, findOwnedBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { emitToBoard, emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };

function normalizeTaskBody(body: Record<string, unknown>) {
  return {
    title: body.title === undefined ? undefined : String(body.title).trim(),
    description: body.description === undefined ? undefined : String(body.description).trim(),
    dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
    priority: ["low", "medium", "high"].includes(String(body.priority)) ? String(body.priority) : "medium",
    assignees: Array.isArray(body.assignees) ? body.assignees.filter((id) => typeof id === "string" && isObjectId(id)) : [],
    subTasks: Array.isArray(body.subTasks)
      ? body.subTasks
          .map((item) =>
            item && typeof item === "object"
              ? {
                  id: String((item as { id?: string }).id ?? "").trim(),
                  title: String((item as { title?: string }).title ?? "").trim(),
                  done: Boolean((item as { done?: boolean }).done),
                }
              : null
          )
          .filter((item): item is { id: string; title: string; done: boolean } => Boolean(item?.id && item.title))
      : undefined
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  await connectDb();
  const board = await findAccessibleBoard(id, userId);
  if (!board) return jsonError("Board not found.", 404);

  const tasks = await Task.find({ board: id }).sort({ column: 1, order: 1 });
  return NextResponse.json({ tasks: serializeDocs(tasks) });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const columnId = String(body.column ?? "");
  const normalized = normalizeTaskBody(body);
  if (!normalized.title) return jsonError("Task title is required.");
  if (!isObjectId(columnId)) return jsonError("Valid column is required.");

  await connectDb();
  const [board, column] = await Promise.all([
    findOwnedBoard(id, userId),
    Column.findOne({ _id: columnId, board: id })
  ]);
  if (!board) return jsonError("Only the board owner can add tasks.", 403);
  if (!column) return jsonError("Column not found.", 404);
  if (column.title.toLowerCase() === "expired-due") return jsonError("You cannot add tasks directly to Expired-due.", 403);

  const count = await Task.countDocuments({ column: columnId });
  const task = await Task.create({
    board: id,
    column: columnId,
    title: normalized.title,
    description: normalized.description ?? "",
    dueDate: normalized.dueDate,
    priority: normalized.priority,
    order: count,
    assignees: normalized.assignees,
    subTasks: normalized.subTasks ?? [],
    activity: [{ user: userId, action: "create", detail: "Task created" }]
  });

  if (normalized.assignees.length) {
    await Notification.insertMany(
      normalized.assignees.map((assignee) => ({
        user: assignee,
        task: task._id,
        board: id,
        message: `You were assigned to ${task.title}.`
      }))
    );
    normalized.assignees.forEach((assignee) => {
      emitToUser(String(assignee), "notification:new", { boardId: id });
    });
  }

  emitToBoard(board, "board:update", id);

  return NextResponse.json({ task: serializeDoc(task) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const taskId = String(body.id ?? "");
  if (!isObjectId(taskId)) return jsonError("Valid task id is required.");

  const normalized = normalizeTaskBody(body);
  const updates: Record<string, unknown> = {};
  if (normalized.title !== undefined) updates.title = normalized.title;
  if (normalized.description !== undefined) updates.description = normalized.description;
  if (body.dueDate !== undefined) updates.dueDate = normalized.dueDate;
  if (body.priority !== undefined) updates.priority = normalized.priority;
  if (body.assignees !== undefined) updates.assignees = normalized.assignees;
  if (body.subTasks !== undefined) updates.subTasks = normalized.subTasks ?? [];

  await connectDb();
  const board = await findAccessibleBoard(id, userId);
  if (!board) return jsonError("Board not found.", 404);

  const isOwner = String(board.owner) === userId;
  
  const taskToEdit = await Task.findOne({ _id: taskId, board: id });
  if (!taskToEdit) return jsonError("Task not found.", 404);

  const isTaskTakenByOthers = taskToEdit.takenBy && String(taskToEdit.takenBy) !== userId;
  if (isTaskTakenByOthers && !isOwner) {
    return jsonError(`This task is currently being worked on by ${taskToEdit.takenByName} and is locked.`, 403);
  }

  if (!isOwner) {
    // Non-owners can only edit description and subtasks
    delete updates.title;
    delete updates.dueDate;
    delete updates.priority;
    delete updates.assignees;
  }

  const task = await Task.findOneAndUpdate(
    { _id: taskId, board: id },
    {
      $set: updates,
      $push: { activity: { user: userId, action: "edit", detail: "Task updated" } }
    },
    { new: true }
  );
  if (!task) return jsonError("Task not found.", 404);

  const assignees = Array.isArray(updates.assignees) ? updates.assignees : [];
  if (assignees.length) {
    await Notification.insertMany(
      assignees.map((assignee) => ({
        user: assignee,
        task: task._id,
        board: id,
        message: `${task.title} was updated.`
      }))
    );
    assignees.forEach((assignee) => {
      emitToUser(String(assignee), "notification:new", { boardId: id });
    });
  }

  emitToBoard(board, "board:update", id);

  return NextResponse.json({ task: serializeDoc(task) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const taskId = new URL(request.url).searchParams.get("taskId") ?? "";
  if (!isObjectId(taskId)) return jsonError("Valid taskId query param is required.");

  await connectDb();
  const board = await findOwnedBoard(id, userId);
  if (!board) return jsonError("Only the board owner can delete tasks.", 403);

  await Task.deleteOne({ _id: taskId, board: id });
  emitToBoard(board, "board:update", id);
  return NextResponse.json({ ok: true });
}
