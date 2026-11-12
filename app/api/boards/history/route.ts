import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import {
  getAccessibleTask,
  getAccessibleTodo,
  getContinuityActor,
} from "@/lib/continuity-access";
import { BoardTodo } from "@/models/BoardTodo";
import { TodoProgressLog } from "@/models/TodoProgressLog";
import { TaskHandover } from "@/models/TaskHandover";
import { CompactionTodo } from "@/models/CompactionTodo";
import { CompactionRevision } from "@/models/CompactionRevision";
import { TaskCompaction } from "@/models/TaskCompaction";
import { Task } from "@/models/Task";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const url = new URL(request.url);
  const todoId = url.searchParams.get("todoId") ?? "";
  const taskId = url.searchParams.get("taskId") ?? "";
  if (!todoId && !taskId) return jsonError("A todoId or taskId is required.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);

  let chainIds: string[] = [];
  let taskFilterId = taskId;
  let rootTodoId: string | null = null;

  if (todoId) {
    if (!isObjectId(todoId)) return jsonError("Invalid todo id.");
    const access = await getAccessibleTodo(todoId, actor);
    if (!access) return jsonError("Todo not found.", 404);
    rootTodoId = String(access.todo.lineageRootId ?? access.todo._id);
    const chain = await BoardTodo.find({
      $or: [{ _id: rootTodoId }, { lineageRootId: rootTodoId }],
    }).select("_id");
    chainIds = chain.map((item: any) => String(item._id));
    taskFilterId = access.todo.task ? String(access.todo.task) : "";
  } else {
    if (!isObjectId(taskId)) return jsonError("Invalid task id.");
    const access = await getAccessibleTask(taskId, actor);
    if (!access) return jsonError("Task not found.", 404);
    const todos = await BoardTodo.find({ task: taskId }).select("_id lineageRootId");
    const roots = new Set(todos.map((item: any) => String(item.lineageRootId ?? item._id)));
    const all = await BoardTodo.find({
      $or: [{ _id: { $in: Array.from(roots) } }, { lineageRootId: { $in: Array.from(roots) } }],
    }).select("_id");
    chainIds = Array.from(new Set([...todos.map((item: any) => String(item._id)), ...all.map((item: any) => String(item._id))]));
  }

  const [todos, progressLogs, handovers, compactionTodos] = await Promise.all([
    BoardTodo.find({ _id: { $in: chainIds } })
      .populate("assigneeId", "name email avatarUrl")
      .populate("originalOwnerId", "name email avatarUrl")
      .populate("createdBy", "name")
      .sort({ createdAt: 1 }),
    TodoProgressLog.find({ todo: { $in: chainIds } })
      .populate("employee", "name avatarUrl")
      .sort({ createdAt: 1 })
      .limit(500),
    TaskHandover.find({ todo: { $in: chainIds } })
      .populate("fromEmployee", "name")
      .populate("toEmployee", "name")
      .sort({ createdAt: 1 }),
    CompactionTodo.find({ todo: { $in: chainIds } }),
  ]);

  const compactionIds = Array.from(new Set(compactionTodos.map((item: any) => String(item.compaction))));
  const compactions = compactionIds.length
    ? await TaskCompaction.find({ _id: { $in: compactionIds } }).select(
        "compactionType reportingDate status employeeName submittedAt deliveredToTeamOwnerAt",
      )
    : [];
  const revisions = compactionIds.length
    ? await CompactionRevision.find({ compaction: { $in: compactionIds } })
        .populate("changedBy", "name")
        .sort({ createdAt: 1 })
    : [];

  const task = taskFilterId && isObjectId(taskFilterId)
    ? await Task.findById(taskFilterId).select("title taskStatus priority dueDate originalDeadline revisedDeadline")
    : null;

  const timeline: {
    at: Date | null;
    kind: string;
    title: string;
    detail: string;
    actor?: string;
    refId?: string;
  }[] = [];

  for (const todo of todos) {
    timeline.push({
      at: todo.originalAssignedDate ?? todo.createdAt ?? null,
      kind: todo.isContinuation ? "continuation_created" : "todo_created",
      title: todo.isContinuation ? "Carried forward" : "Todo created",
      detail: `${String(todo.title ?? "")} assigned to ${String((todo.assigneeId as any)?.name ?? "")}`,
      refId: String(todo._id),
    });
    const history = Array.isArray(todo.carryForwardHistory) ? todo.carryForwardHistory : [];
    for (const entry of history) {
      timeline.push({
        at: entry.createdAt ?? entry.toDate ?? null,
        kind: "carried_forward",
        title: "Carried forward",
        detail: `${String(entry.reason ?? "Scheduled")} · ${String(entry.action ?? "")}`,
        refId: String(todo._id),
      });
    }
    const delegation = Array.isArray(todo.delegationHistory) ? todo.delegationHistory : [];
    for (const entry of delegation) {
      timeline.push({
        at: entry.at ?? null,
        kind: `delegation_${String(entry.status ?? "")}`,
        title: `Delegation ${String(entry.status ?? "")}`,
        detail: String(entry.reason ?? ""),
        refId: String(todo._id),
      });
    }
  }

  for (const log of progressLogs) {
    timeline.push({
      at: log.createdAt ?? log.workingDate ?? null,
      kind: "progress",
      title: `Progress ${Number(log.progress ?? 0)}%`,
      detail: [String(log.workNotes ?? ""), String(log.remainingWork ?? "")]
        .filter(Boolean)
        .join(" · "),
      actor: String((log.employee as any)?.name ?? ""),
      refId: String(log._id),
    });
  }

  for (const handover of handovers) {
    timeline.push({
      at: handover.acceptedAt ?? handover.declinedAt ?? handover.cancelledAt ?? handover.createdAt ?? null,
      kind: `handover_${String(handover.status ?? "")}`,
      title: `Handover ${String(handover.status ?? "")}`,
      detail: handover.reason ? String(handover.reason) : "",
      refId: String(handover._id),
    });
  }

  for (const compaction of compactions) {
    timeline.push({
      at: compaction.submittedAt ?? compaction.reportingDate ?? null,
      kind: "compaction",
      title: `${String(compaction.compactionType ?? "")} compaction ${String(compaction.status ?? "")}`,
      detail: `${String(compaction.employeeName ?? "")} submitted a report including this work`,
      refId: String(compaction._id),
    });
  }

  timeline.sort((a, b) => {
    const at = a.at ? new Date(a.at).getTime() : 0;
    const bt = b.at ? new Date(b.at).getTime() : 0;
    return at - bt;
  });

  return NextResponse.json({
    rootTodoId,
    task: task ? serializeDoc(task) : null,
    todos: serializeDocs(todos),
    progressLogs: serializeDocs(progressLogs),
    handovers: serializeDocs(handovers),
    compactions: serializeDocs(compactions),
    revisions: serializeDocs(revisions),
    compactionTodos: serializeDocs(compactionTodos),
    timeline,
  });
}
