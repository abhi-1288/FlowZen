import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDocs } from "@/lib/api";
import {
  actorHasGlobalBoardAccess,
  getContinuityActor,
} from "@/lib/continuity-access";
import {
  ACTIVE_TODO_STATUSES,
  FINISHED_TODO_STATUSES,
} from "@/lib/work-constants";
import { BoardTodo } from "@/models/BoardTodo";
import { Board } from "@/models/Board";
import { Task } from "@/models/Task";
import { TaskCompaction } from "@/models/TaskCompaction";
import { TaskHandover } from "@/models/TaskHandover";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);

  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope") ?? "mine";
  const global = actorHasGlobalBoardAccess(actor);

  let scope = requestedScope;
  if (scope === "company" && !global) scope = "mine";
  if (scope === "team" && !global && !actor.managesTeams.length) scope = "mine";

  const managedTasks = actor.managesTeams.length
    ? await Task.find({ team: { $in: actor.managesTeams } }).select("_id")
    : [];
  const managedTaskIds = managedTasks.map((task) => task._id);

  const todoFilter: Record<string, unknown> = {};
  if (actor.company) todoFilter.company = actor.company;
  if (scope === "mine") {
    todoFilter.assigneeId = userId;
  } else if (scope === "team") {
    todoFilter.$or = [
      { assigneeId: userId },
      { task: { $in: managedTaskIds } },
      { board: { $in: actor.boardIds } },
    ];
  }

  const boardFilter: Record<string, unknown> = global
    ? {}
    : { $or: [{ owner: userId }, { "members.user": userId }] };

  const [statusCounts, boards, boardTaskCounts, boardTodoCounts, pendingHandovers, awaitingCompactions] =
    await Promise.all([
      BoardTodo.aggregate([
        { $match: todoFilter },
        { $group: { _id: "$status", count: { $sum: 1 }, progress: { $avg: "$progress" } } },
      ]),
      Board.find(boardFilter).select("title description owner updatedAt").sort({ updatedAt: -1 }).limit(60),
      Task.aggregate([{ $group: { _id: "$board", total: { $sum: 1 } } }]),
      BoardTodo.aggregate([
        { $match: todoFilter },
        {
          $group: {
            _id: "$board",
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $in: ["$status", ACTIVE_TODO_STATUSES] }, 1, 0] } },
            done: { $sum: { $cond: [{ $in: ["$status", FINISHED_TODO_STATUSES] }, 1, 0] } },
          },
        },
      ]),
      TaskHandover.find({
        toEmployee: userId,
        status: "pending",
        ...(actor.company ? { company: actor.company } : {}),
      })
        .populate("fromEmployee", "name avatarUrl")
        .populate("todo", "title")
        .sort({ createdAt: -1 })
        .limit(20),
      TaskCompaction.find({
        employee: userId,
        status: { $in: ["awaiting_confirmation", "draft", "draft_ready", "correction_requested", "delivery_failed"] },
      })
        .sort({ reportingDate: -1 })
        .limit(10),
    ]);

  const byStatus: Record<string, number> = {};
  let total = 0;
  let progressSum = 0;
  for (const row of statusCounts as { _id: string; count: number; progress: number }[]) {
    byStatus[String(row._id)] = row.count;
    total += row.count;
    progressSum += Number(row.progress ?? 0) * row.count;
  }

  const taskCountByBoard = new Map<string, number>(
    (boardTaskCounts as { _id: unknown; total: number }[]).map((row) => [String(row._id), row.total]),
  );
  const todoCountByBoard = new Map<string, { total: number; active: number; done: number }>(
    (boardTodoCounts as { _id: unknown; total: number; active: number; done: number }[]).map((row) => [
      String(row._id),
      { total: row.total, active: row.active, done: row.done },
    ]),
  );

  return NextResponse.json({
    scope,
    counts: {
      total,
      active: ACTIVE_TODO_STATUSES.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0),
      completed: FINISHED_TODO_STATUSES.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0),
      carriedForward: byStatus.carried_forward ?? 0,
      blocked: byStatus.blocked ?? 0,
      inProgress: byStatus.in_progress ?? 0,
      partiallyCompleted: byStatus.partially_completed ?? 0,
      notStarted: byStatus.not_started ?? 0,
      pendingReview: byStatus.pending_review ?? 0,
      delegationPending: byStatus.delegation_pending ?? 0,
      averageProgress: total ? Math.round(progressSum / total) : 0,
      pendingHandovers: pendingHandovers.length,
      awaitingCompactions: awaitingCompactions.length,
    },
    byStatus,
    boards: serializeDocs(boards).map((board: Record<string, unknown>) => {
      const boardId = String(board.id ?? "");
      const todos = todoCountByBoard.get(boardId) ?? { total: 0, active: 0, done: 0 };
      return {
        ...board,
        taskCount: taskCountByBoard.get(boardId) ?? 0,
        todoCount: todos.total,
        activeTodoCount: todos.active,
        completedTodoCount: todos.done,
      };
    }),
    pendingHandovers: serializeDocs(pendingHandovers),
    awaitingCompactions: serializeDocs(awaitingCompactions),
  });
}
