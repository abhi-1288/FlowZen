import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { findAccessibleBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { emitToBoard, emitToUser } from "@/lib/socket-emit";
import { deleteAttachments } from "@/lib/attachments";
import {
  canManageBoardTasks,
  normalizeEmployeeTaskMode,
  requiresTaskApproval,
} from "@/lib/task-permissions";

type Params = { params: Promise<{ id: string }> };

function normalizeTaskBody(body: Record<string, unknown>) {
  return {
    title: body.title === undefined ? undefined : String(body.title).trim(),
    description: body.description === undefined ? undefined : String(body.description).trim(),
    dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
    priority: ["low", "medium", "high"].includes(String(body.priority)) ? String(body.priority) : "medium",
    pinned: body.pinned === undefined ? undefined : Boolean(body.pinned),
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
  const [board, column, caller] = await Promise.all([
    findAccessibleBoard(id, userId),
    Column.findOne({ _id: columnId, board: id }),
    User.findById(userId).select("name role")
  ]);
  if (!board) return jsonError("Board not found.", 404);
  if (!caller) return jsonError("User not found.", 404);
  if (!column) return jsonError("Column not found.", 404);
  if (column.title.toLowerCase() === "expired-due") return jsonError("You cannot add tasks directly to Expired-due.", 403);

  const isReviewer = canManageBoardTasks(board, userId, String(caller.role));
  if (!isReviewer) {
    const mode = normalizeEmployeeTaskMode(board.employeeTaskCreation);
    if (mode === "blocked") {
      return jsonError("Task creation is disabled for your role on this board.", 403);
    }
  }

  const approvalStatus =
    !isReviewer && requiresTaskApproval(board, userId, String(caller.role))
      ? "pending"
      : "approved";

  const count = await Task.countDocuments({ column: columnId });
  const task = await Task.create({
    board: id,
    column: columnId,
    title: normalized.title,
    description: normalized.description ?? "",
    dueDate: normalized.dueDate,
    priority: normalized.priority,
    order: count,
    pinned: normalized.pinned ?? false,
    approvalStatus,
    createdBy: userId,
    assignees: normalized.assignees,
    subTasks: normalized.subTasks ?? [],
    activity: [
      {
        user: userId,
        action: "create",
        detail: approvalStatus === "pending" ? "Task submitted for approval" : "Task created"
      }
    ]
  });

  if (approvalStatus === "pending") {
    const reviewerIds = new Set<string>();
    if (String(board.owner) !== userId) reviewerIds.add(String(board.owner));
    (board.members as any[]).forEach((member) => {
      const memberId = String(member.user);
      if (memberId === userId) return;
      if (["admin", "manager", "tester"].includes(String(member.role))) reviewerIds.add(memberId);
    });

    if (reviewerIds.size) {
      await Notification.insertMany(
        Array.from(reviewerIds).map((reviewerId) => ({
          user: reviewerId,
          task: task._id,
          board: id,
          type: "approval",
          title: "Task approval needed",
          message: `${caller.name} submitted "${task.title}" for approval.`,
          link: `/board/${id}`
        }))
      );
      reviewerIds.forEach((reviewerId) => {
        emitToUser(reviewerId, "notification:new", { boardId: id });
      });
    }
  }

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
  const reviewStatus =
    body.approvalStatus === undefined ? null : String(body.approvalStatus);
  if (reviewStatus && !["approved", "rejected"].includes(reviewStatus)) {
    return jsonError("approvalStatus must be approved or rejected.");
  }

  const updates: Record<string, unknown> = {};
  if (normalized.title !== undefined) updates.title = normalized.title;
  if (normalized.description !== undefined) updates.description = normalized.description;
  if (body.dueDate !== undefined) updates.dueDate = normalized.dueDate;
  if (body.priority !== undefined) updates.priority = normalized.priority;
  if (body.pinned !== undefined) updates.pinned = normalized.pinned;
  if (body.assignees !== undefined) updates.assignees = normalized.assignees;
  if (body.subTasks !== undefined) updates.subTasks = normalized.subTasks ?? [];

  await connectDb();
  const [board, caller] = await Promise.all([
    findAccessibleBoard(id, userId),
    User.findById(userId).select("name role")
  ]);
  if (!board) return jsonError("Board not found.", 404);
  if (!caller) return jsonError("User not found.", 404);

  const isOwner = String(board.owner) === userId;
  const isReviewer = canManageBoardTasks(board, userId, String(caller.role));

  const taskToEdit = await Task.findOne({ _id: taskId, board: id });
  if (!taskToEdit) return jsonError("Task not found.", 404);

  const isTaskTakenByOthers = taskToEdit.takenBy && String(taskToEdit.takenBy) !== userId;
  if (isTaskTakenByOthers && !isOwner) {
    return jsonError(`This task is currently being worked on by ${taskToEdit.takenByName} and is locked.`, 403);
  }

  const isCreator = String(taskToEdit.createdBy ?? "") === userId;

  if (reviewStatus) {
    if (!isReviewer) {
      return jsonError("Only managers, testers, HR, finance or the board owner can review tasks.", 403);
    }
    updates.approvalStatus = reviewStatus;
    updates.reviewedBy = userId;
    updates.reviewedAt = new Date();
    if (reviewStatus === "rejected") updates.pinned = false;
  } else if (!isOwner && !isReviewer) {
    // Creators can edit the core fields of their own task; everyone else can
    // only change the description and sub-tasks.
    if (isCreator) {
      delete updates.assignees;
    } else {
      delete updates.title;
      delete updates.dueDate;
      delete updates.priority;
      delete updates.assignees;
    }
  }

  const activityDetail = reviewStatus
    ? reviewStatus === "approved"
      ? `Task approved by ${caller.name}`
      : `Task rejected by ${caller.name}`
    : "Task updated";

  const task = await Task.findOneAndUpdate(
    { _id: taskId, board: id },
    {
      $set: updates,
      $push: {
        activity: {
          user: userId,
          action: reviewStatus ? "review" : "edit",
          detail: activityDetail
        }
      }
    },
    { new: true }
  );
  if (!task) return jsonError("Task not found.", 404);

  if (reviewStatus && taskToEdit.createdBy) {
    await Notification.create({
      user: taskToEdit.createdBy,
      task: task._id,
      board: id,
      type: "approval",
      title: reviewStatus === "approved" ? "Task approved" : "Task rejected",
      message:
        reviewStatus === "approved"
          ? `Your task "${task.title}" was approved by ${caller.name}.`
          : `Your task "${task.title}" was rejected by ${caller.name}.`,
      link: `/board/${id}`
    });
    emitToUser(String(taskToEdit.createdBy), "notification:new", { boardId: id });
  }

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
  const [board, caller, task] = await Promise.all([
    findAccessibleBoard(id, userId),
    User.findById(userId).select("role"),
    Task.findOne({ _id: taskId, board: id })
  ]);
  if (!board) return jsonError("Board not found.", 404);
  if (!caller) return jsonError("User not found.", 404);
  if (!task) return jsonError("Task not found.", 404);

  const isReviewer = canManageBoardTasks(board, userId, String(caller.role));
  const isCreator = String(task.createdBy ?? "") === userId;
  if (!isReviewer && !isCreator) {
    return jsonError("Only the board owner or the task creator can delete this task.", 403);
  }

  if (task.attachments && task.attachments.length > 0) {
    await deleteAttachments(task.attachments);
  }

  await Task.deleteOne({ _id: taskId, board: id });
  emitToBoard(board, "board:update", id);
  return NextResponse.json({ ok: true });
}
