import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { findAccessibleBoard } from "@/lib/board-access";
import { canManageBoardTasks } from "@/lib/task-permissions";
import { isObjectId, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { emitToBoard, emitToUser } from "@/lib/socket-emit";
import { BoardTodo } from "@/models/BoardTodo";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const taskId = String(body.taskId ?? "");
  const toColumnId = String(body.toColumnId ?? "");
  const orderedTaskIds = Array.isArray(body.orderedTaskIds) ? body.orderedTaskIds : [];

  if (!isObjectId(taskId) || !isObjectId(toColumnId)) return jsonError("Valid task and column ids are required.");
  if (!orderedTaskIds.every((candidate: unknown) => typeof candidate === "string" && isObjectId(candidate))) {
    return jsonError("orderedTaskIds must contain valid task ids.");
  }

  await connectDb();
  const [board, targetColumn, task, caller, todoColumn] = await Promise.all([
    findAccessibleBoard(id, userId),
    Column.findOne({ _id: toColumnId, board: id }),
    Task.findOne({ _id: taskId, board: id }),
    User.findById(userId).populate("team", "name"),
    Column.findOne({ board: id, title: { $regex: /todo/i } })
  ]);
  if (!board || !targetColumn || !task || !caller) return jsonError("Board, column, task, or user not found.", 404);
  if (targetColumn.title.toLowerCase() === "expired-due") {
    return jsonError("Expired-due is auto-managed and cannot accept manual moves.", 403);
  }

  const isOwner = String(board.owner) === userId;
  const isReviewer = canManageBoardTasks(board, userId, String(caller.role));
  const isTaskTakenByOthers = task.takenBy && String(task.takenBy) !== userId;

  if (task.approvalStatus === "pending" && !isReviewer) {
    return jsonError("This task is waiting for approval and cannot be moved yet.", 403);
  }

  // Lock logic: If taken by others, only the owner or the person who took it can move it.
  if (isTaskTakenByOthers && !isOwner) {
    return jsonError(`This task is currently being worked on by ${task.takenByName} and is locked.`, 403);
  }

  const previousColumnId = task.column.toString();
  const movedAcrossColumns = previousColumnId !== toColumnId;
  const callerRole = String(caller.role);
  const takeoverUpdates: Record<string, unknown> = {};
  const isDoneColumn = targetColumn.title.toLowerCase() === "done";
  const isExpiredColumn = targetColumn.title.toLowerCase() === "expired-due";
  const isDecisionColumn = targetColumn.title.toLowerCase() === "decision & dependency";
  const isRiskColumn = targetColumn.title.toLowerCase() === "risks";
  const mappedTodoStatus = isDoneColumn || isExpiredColumn
    ? "completed"
    : targetColumn.title.toLowerCase() === "blocked"
      ? "blocked"
      : isDecisionColumn
        ? "decision_pending"
        : isRiskColumn
          ? "risk_flagged"
          : targetColumn.title.toLowerCase() === "taken"
            ? "taken"
            : targetColumn.title.toLowerCase() === "todo"
              ? "not_started"
              : "in_progress";
  const isCompletedColumn = mappedTodoStatus === "completed";
  const isMovingFromTodo = todoColumn && String(task.column) === String(todoColumn._id);
  const isMovingToTodo = todoColumn && String(toColumnId) === String(todoColumn._id);

  if (movedAcrossColumns) {
    if (isMovingFromTodo && !isMovingToTodo) {
      // Take ownership when moving out of Todo
      const boardMember = (board.members as any[]).find((member) => String(member.user) === userId);
      let lead = caller;
      if (boardMember?.assignedTo && !["project-manager", "qa-tester"].includes(callerRole)) {
        lead = await User.findById(boardMember.assignedTo);
      }

      let team: any = caller.team;
      if (!team && lead?._id) {
        team = await Team.findOne({ manager: lead._id, employees: caller._id }).select("name");
      }
      if (!team && ["project-manager", "qa-tester"].includes(callerRole)) {
        team = await Team.findOne({ manager: caller._id }).select("name");
      }

      takeoverUpdates.takenBy = caller._id;
      takeoverUpdates.takenByName = caller.name;
      takeoverUpdates.takenLead = lead?._id ?? caller._id;
      takeoverUpdates.takenLeadName = lead?.name ?? caller.name;
      takeoverUpdates.takenTeam = team?._id ?? null;
      takeoverUpdates.takenTeamName = team?.name ?? "";
    } else if (isMovingToTodo) {
      // Release ownership when moving back to Todo
      takeoverUpdates.takenBy = null;
      takeoverUpdates.takenByName = "";
      takeoverUpdates.takenLead = null;
      takeoverUpdates.takenLeadName = "";
      takeoverUpdates.takenTeam = null;
      takeoverUpdates.takenTeamName = "";
    }
  }

  const activityDetail = isDoneColumn
    ? `${caller.name}${takeoverUpdates.takenTeamName || task.takenTeamName ? `, ${takeoverUpdates.takenTeamName || task.takenTeamName}` : ""}${takeoverUpdates.takenLeadName || task.takenLeadName ? `, ${takeoverUpdates.takenLeadName || task.takenLeadName}` : ""} has completed the task`
    : isMovingToTodo
    ? `Task released back to ${targetColumn.title} by ${caller.name}`
    : `Moved to ${targetColumn.title}`;

  await Task.updateOne(
    { _id: taskId, board: id },
    {
      $set: { column: toColumnId, ...takeoverUpdates },
      $push: { activity: { user: userId, action: isDoneColumn ? "completed" : "move", detail: activityDetail } }
    }
  );

  // Link legacy Kanban work into the continuity workspace as soon as someone
  // takes it out of Todo. The Task remains authoritative; this shadow record
  // gives EOD/EOW and My Todos a shared tracking representation.
  if (movedAcrossColumns && !isMovingToTodo) {
    await BoardTodo.findOneAndUpdate(
      { task: task._id, sourceType: "board_task" },
      {
        $set: {
          company: (task as any).company ?? (caller as any).company ?? null,
          board: task.board,
          carryForwardKey: `board-task:${String(task._id)}`,
          title: task.title,
          description: task.description ?? "",
          assigneeId: caller._id,
          originalOwnerId: (task as any).owner ?? task.createdBy ?? caller._id,
          originalAssignedDate: task.createdAt ?? new Date(),
          currentWorkingDate: new Date(),
          dueDate: task.dueDate ?? null,
          priority: task.priority,
          status: mappedTodoStatus,
          progress: isCompletedColumn ? 100 : 0,
          remainingWork: isCompletedColumn ? "" : "Continue the active board task.",
          nextAction: isCompletedColumn ? "" : `Continue ${task.title}`,
          updatedBy: userId,
        },
        $setOnInsert: {
          task: task._id,
          sourceType: "board_task",
          createdBy: userId,
        },
      },
      { upsert: true },
    );
  }

  if (isDoneColumn) {
    await Notification.create({
      user: board.owner,
      board: id,
      task: taskId,
      title: "Task Completed",
      message: activityDetail
    });
    emitToUser(String(board.owner), "notification:new", { boardId: id });
  }

  if (isDecisionColumn || isRiskColumn) {
    const recipientId = String(
      (takeoverUpdates.takenLead as any) ?? task.takenLead ?? board.owner,
    );
    await Notification.create({
      user: recipientId,
      board: id,
      task: taskId,
      title: isDecisionColumn ? "Decision / dependency requested" : "Risk flagged",
      message: `${caller.name} moved "${task.title}" to ${targetColumn.title} and is requesting guidance.`,
    });
    emitToUser(recipientId, "notification:new", { boardId: id });
  }

  await Promise.all(
    orderedTaskIds.map((orderedTaskId: string, order: number) =>
      Task.updateOne({ _id: orderedTaskId, board: id, column: toColumnId }, { $set: { order } })
    )
  );

  if (previousColumnId !== toColumnId) {
    const previousTasks = await Task.find({ board: id, column: previousColumnId }).sort({ order: 1 });
    await Promise.all(previousTasks.map((previousTask, order) => Task.updateOne({ _id: previousTask._id }, { $set: { order } })));
  }

  const tasks = await Task.find({ board: id }).sort({ column: 1, order: 1 });
  const serialized = serializeDocs(tasks);
  emitToBoard(board, "board:update", { type: "tasks", boardId: id, tasks: serialized });
  return NextResponse.json({ tasks: serialized });
}
