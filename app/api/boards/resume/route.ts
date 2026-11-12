import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { getContinuityActor } from "@/lib/continuity-access";
import {
  ACTIVE_TODO_STATUSES,
  EMPLOYEE_EDITABLE_STATUSES,
} from "@/lib/work-constants";
import {
  dateKeyInTimeZone,
  resolveTimeZone,
  startOfDayInTimeZone,
} from "@/lib/compaction";
import { BoardTodo } from "@/models/BoardTodo";
import { TaskHandover } from "@/models/TaskHandover";
import { TaskCompaction } from "@/models/TaskCompaction";
import { Company } from "@/models/Company";
import { Task } from "@/models/Task";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);

  const company = actor.company
    ? await Company.findById(actor.company).select("timeZone")
    : null;
  const timeZone = resolveTimeZone(company?.timeZone);
  const now = new Date();
  const todayStart = startOfDayInTimeZone(now, timeZone);
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const url = new URL(request.url);
  const boardId = url.searchParams.get("boardId") ?? "";

  const filter: Record<string, unknown> = {
    assigneeId: userId,
    status: { $in: ACTIVE_TODO_STATUSES },
  };
  if (actor.company) filter.company = actor.company;
  if (boardId) filter.board = boardId;

  const todos = await BoardTodo.find(filter)
    .populate("task", "title taskStatus priority dueDate originalDeadline")
    .populate("board", "title")
    .populate("assigneeId", "name email avatarUrl")
    .sort({ currentWorkingDate: 1, priority: 1, dueDate: 1 })
    .limit(400);

  const activeTaskIds = Array.from(
    new Set(todos.map((todo: any) => (todo.task ? String((todo.task as any)._id ?? todo.task) : "")).filter(Boolean)),
  );
  const tasks = activeTaskIds.length
    ? await Task.find({ _id: { $in: activeTaskIds } }).select("title taskStatus priority dueDate")
    : [];
  const taskById = new Map(tasks.map((task) => [String(task._id), task]));

  const groups = {
    carriedForward: [] as Record<string, unknown>[],
    inProgress: [] as Record<string, unknown>[],
    blocked: [] as Record<string, unknown>[],
    notStarted: [] as Record<string, unknown>[],
    awaitingReview: [] as Record<string, unknown>[],
    delegationPending: [] as Record<string, unknown>[],
  };
  let dueToday = 0;
  let overdue = 0;

  for (const todo of todos) {
    const serialized = serializeDoc(todo) as Record<string, unknown>;
    const task = todo.task ? taskById.get(String((todo.task as any)._id ?? todo.task)) : null;
    serialized.taskDetail = task ? serializeDoc(task) : null;
    serialized.resumeNote =
      serialized.nextAction ||
      serialized.remainingWork ||
      serialized.partialWorkNotes ||
      serialized.description ||
      "";
    serialized.originalAssignedDate = todo.originalAssignedDate ?? null;
    serialized.workingDateKey = todo.currentWorkingDate
      ? dateKeyInTimeZone(todo.currentWorkingDate, timeZone)
      : null;

    const status = String(todo.status ?? "");
    if (status === "carried_forward") groups.carriedForward.push(serialized);
    else if (status === "blocked") groups.blocked.push(serialized);
    else if (status === "delegation_pending") groups.delegationPending.push(serialized);
    else if (status === "pending_review") groups.awaitingReview.push(serialized);
    else if (status === "in_progress" || status === "partially_completed" || status === "reopened") {
      groups.inProgress.push(serialized);
    } else groups.notStarted.push(serialized);

    if (todo.dueDate) {
      const dueKey = dateKeyInTimeZone(todo.dueDate, timeZone);
      if (dueKey === todayKey) dueToday += 1;
      else if (dueKey < todayKey) overdue += 1;
    }
  }

  const [handovers, compactions] = await Promise.all([
    TaskHandover.find({
      ...(actor.company ? { company: actor.company } : {}),
      toEmployee: userId,
      status: "pending",
    })
      .populate("fromEmployee", "name email avatarUrl")
      .populate("todo", "title status currentWorkingDate originalAssignedDate")
      .sort({ createdAt: -1 })
      .limit(50),
    TaskCompaction.find({
      employee: userId,
      status: { $in: EMPLOYEE_EDITABLE_STATUSES },
    })
      .sort({ reportingDate: -1 })
      .limit(20),
  ]);

  return NextResponse.json({
    timeZone,
    today: todayStart,
    todayKey,
    counts: {
      total: todos.length,
      carriedForward: groups.carriedForward.length,
      inProgress: groups.inProgress.length,
      blocked: groups.blocked.length,
      notStarted: groups.notStarted.length,
      awaitingReview: groups.awaitingReview.length,
      delegationPending: groups.delegationPending.length,
      dueToday,
      overdue,
      pendingHandovers: handovers.length,
      pendingCompactions: compactions.length,
    },
    groups,
    todos: serializeDocs(todos),
    handovers: serializeDocs(handovers),
    compactions: serializeDocs(compactions),
  });
}
