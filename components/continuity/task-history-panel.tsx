"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, GitBranch, RefreshCw, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import {
  Card,
  EmptyState,
  ErrorNote,
  formatDate,
  formatDateTime,
  inputClass,
  LoadingRows,
  memberName,
  PanelHeader,
  StatusPill,
  type TodoRecord,
} from "./common";

type TimelineItem = {
  at?: string | null;
  kind: string;
  title: string;
  detail?: string;
  actor?: string;
  refId?: string;
};

type HistoryResponse = {
  rootTodoId: string | null;
  task: Record<string, any> | null;
  todos: TodoRecord[];
  progressLogs: Record<string, any>[];
  handovers: Record<string, any>[];
  compactions: Record<string, any>[];
  revisions: Record<string, any>[];
  compactionTodos: Record<string, any>[];
  timeline: TimelineItem[];
};

export function TaskHistoryPanel({ defaultTodoId = "" }: { defaultTodoId?: string }) {
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [todoId, setTodoId] = useState(defaultTodoId);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiFetch<{ todos: TodoRecord[] }>("/api/boards/todos?scope=all&limit=300", undefined, { toast: false })
      .then((result) => {
        const items = result.todos ?? [];
        setTodos(items);
        setTodoId((current) => current || items[0]?.id || "");
      })
      .catch(() => setTodos([]));
  }, []);

  const load = useCallback(async () => {
    if (!todoId) {
      setHistory(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<HistoryResponse>(
        `/api/boards/history?todoId=${encodeURIComponent(todoId)}`,
        undefined,
        { toast: false },
      );
      setHistory(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load task history.");
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, [todoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <PanelHeader
        title="Task history"
        description="Every todo, carry-forward, delegation, progress log and compaction that touched this work — in one timeline."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" onClick={() => void load()} type="button">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      <div className="mb-4">
        <select className={inputClass} value={todoId} onChange={(event) => setTodoId(event.target.value)}>
          <option value="">Select a todo to trace its history</option>
          {todos.map((todo) => (
            <option key={todo.id} value={todo.id}>
              {todo.title}
              {todo.isContinuation ? " · continuation" : ""}
            </option>
          ))}
        </select>
      </div>

      <ErrorNote message={error} />
      {loading ? <LoadingRows rows={4} /> : null}

      {!loading && !todoId ? (
        <EmptyState title="Pick a todo" description="Choose a todo to see its full chain: original assignment, carry-forwards, delegations, notes and compactions." />
      ) : null}

      {!loading && history ? (
        <div className="space-y-5">
          {history.task ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{String(history.task.title ?? "Task")}</span>
                {history.task.taskStatus ? <StatusPill status={String(history.task.taskStatus)} /> : null}
                {history.task.priority ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {String(history.task.priority)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                Original deadline {formatDate(history.task.originalDeadline)} · Revised {formatDate(history.task.revisedDeadline ?? history.task.dueDate)}
              </p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              <GitBranch size={12} /> Continuation chain
            </p>
            <div className="space-y-1.5">
              {history.todos.map((todo, index) => (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-zinc-800" key={todo.id}>
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-zinc-800 dark:text-zinc-300">
                    {index + 1}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-zinc-200">{todo.title}</span>
                  <StatusPill status={todo.status} />
                  <span className="text-slate-400">{memberName(todo.assigneeId)}</span>
                  <span className="ml-auto text-[10px] text-slate-400">Original {formatDate(todo.originalAssignedDate)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              <Clock size={12} /> Timeline
            </p>
            {history.timeline.length ? (
              <ol className="relative space-y-3 border-l border-slate-200 pl-4 dark:border-zinc-800">
                {history.timeline.map((item, index) => (
                  <li className="relative" key={`${item.kind}-${item.refId ?? index}`}>
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300 dark:bg-zinc-600" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{item.title}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {item.kind.replace(/_/g, " ")}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-400">{formatDateTime(item.at)}</span>
                    </div>
                    {item.detail ? <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">{item.detail}</p> : null}
                    {item.actor ? <p className="text-[10px] text-slate-400">by {item.actor}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-slate-400">No history recorded for this todo yet.</p>
            )}
          </div>

          {history.compactions.length ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                <ShieldCheck size={12} /> Reported in compactions
              </p>
              <div className="space-y-1.5">
                {history.compactions.map((item) => (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] dark:border-zinc-800" key={String(item.id)}>
                    <span className="font-semibold text-slate-700 dark:text-zinc-300">{String(item.compactionType ?? "")}</span>
                    <span className="text-slate-400">{formatDate(item.reportingDate)}</span>
                    <StatusPill status={String(item.status ?? "")} />
                    <span className="ml-auto text-slate-400">{String(item.employeeName ?? "")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {history.progressLogs.length ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Progress notes</p>
              <div className="space-y-1.5">
                {history.progressLogs.slice(-8).map((log) => (
                  <div className="rounded-lg bg-white px-3 py-2 text-[11px] dark:bg-zinc-950" key={String(log.id)}>
                    <p className="text-slate-600 dark:text-zinc-300">
                      {String(log.workNotes ?? "") || "No note"} {log.remainingWork ? `· Remaining: ${String(log.remainingWork)}` : ""}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {Number(log.progress ?? 0)}% · {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
