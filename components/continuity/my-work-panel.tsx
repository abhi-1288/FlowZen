"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  CalendarClock,
  CheckSquare,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Target,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { BOARD_TASK_STATUSES, PRIORITIES } from "@/lib/work-constants";
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorNote,
  formatDate,
  inputClass,
  labelClass,
  LoadingRows,
  memberName,
  Modal,
  PanelHeader,
  ProgressBar,
  StatusPill,
  textareaClass,
  type Member,
  type TodoRecord,
} from "./common";

type BoardOption = {
  id: string;
  title: string;
  description?: string;
  owner?: string;
  pinned?: boolean;
  members?: { user?: string; role?: string }[];
  updatedAt?: string;
  createdAt?: string;
};

type ColumnOption = { id: string; title: string; order?: number };

type MajorTask = {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  taskStatus?: string;
  priority?: string;
  startDate?: string | null;
  originalDeadline?: string | null;
  revisedDeadline?: string | null;
  dueDate?: string | null;
  owner?: Member | string | null;
  assignees?: (Member | string)[];
  board?: { id?: string; _id?: string; title?: string } | string | null;
  column?: string | { id?: string; _id?: string; title?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

const TASK_STATUS_OPTIONS = BOARD_TASK_STATUSES.filter((status) => status !== "cancelled");

function boardTitle(task: MajorTask, boards: BoardOption[]): string {
  const board = task.board;
  if (board && typeof board === "object") return String(board.title ?? "");
  const id = typeof board === "string" ? board : "";
  return boards.find((item) => item.id === id)?.title ?? "";
}

export function MyBoardsPanel() {
  const { data: session } = useSession();
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ boards: BoardOption[] }>("/api/boards", undefined, { toast: false });
      setBoards(result.boards ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your boards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...boards]
      .filter((board) =>
        !term ? true : [board.title, board.description].some((value) => String(value ?? "").toLowerCase().includes(term)),
      )
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
      });
  }, [boards, search]);

  return (
    <div className="space-y-4">
      <Card>
        <PanelHeader
          title="My boards"
          description="Boards you own or collaborate on. Open a board to manage its major tasks and break them into todos."
          actions={
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" size={14} />
                <input
                  className={`${inputClass} w-56 pl-8`}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search boards..."
                  value={search}
                />
              </div>
              <button className={btnSecondary} onClick={() => void load()} type="button">
                <RefreshCw size={13} /> Refresh
              </button>
              <Link className={btnPrimary} href="/board">
                <Plus size={13} /> New board
              </Link>
            </>
          }
        />

        <ErrorNote message={error} />
        {loading ? <LoadingRows rows={4} /> : null}

        {!loading && !filtered.length ? (
          <EmptyState
            title={boards.length ? "No boards match your search" : "No boards yet"}
            description={
              boards.length
                ? "Try a different board name."
                : "Create a board to plan major tasks and keep their todos, history and carry-forwards together."
            }
            action={
              <Link className={btnPrimary} href="/board">
                <Plus size={13} /> Create a board
              </Link>
            }
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((board) => {
            const isOwner = Boolean(board.owner) && board.owner === String(session?.user?.id ?? "");
            return (
              <Link
                className="group flex flex-col rounded-xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:shadow-sm dark:border-zinc-800 dark:hover:border-zinc-700"
                href={`/board/${board.id}`}
                key={board.id}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Layers size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{board.title}</p>
                      {board.pinned ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-zinc-400">
                      {board.description?.trim() || "No description yet."}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 text-slate-300 transition group-hover:text-slate-500" size={15} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <Users size={10} /> {board.members?.length ?? 0} members
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {isOwner ? "Owner" : "Collaborator"}
                  </span>
                  <span>Updated {formatDate(board.updatedAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="border-l-4 border-l-indigo-400">
        <PanelHeader
          title="Where to go next"
          description="Continuity lives alongside the board: todos, resumes, compactions and delegations."
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800" href="/boards?tab=my-todos">
            <Target className="mb-1.5 text-sky-500" size={15} /> My todos
          </Link>
          <Link className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800" href="/boards?tab=resume">
            <CalendarClock className="mb-1.5 text-orange-500" size={15} /> Resume workspace
          </Link>
          <Link className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800" href="/profile/compactions">
            <CheckSquare className="mb-1.5 text-emerald-500" size={15} /> My compactions
          </Link>
          <Link className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800" href="/boards?tab=delegated-work">
            <Users className="mb-1.5 text-indigo-500" size={15} /> Delegated work
          </Link>
        </div>
      </Card>
    </div>
  );
}

export function MyTasksPanel() {
  const { showSuccessToast } = useNotificationToast();
  const [tasks, setTasks] = useState<MajorTask[]>([]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [taskResult, boardResult, todoResult] = await Promise.all([
        apiFetch<{ tasks: MajorTask[] }>("/api/boards/major-tasks?scope=mine", undefined, { toast: false }),
        apiFetch<{ boards: BoardOption[] }>("/api/boards", undefined, { toast: false }),
        apiFetch<{ todos: TodoRecord[] }>("/api/boards/todos?scope=mine&limit=500", undefined, { toast: false }),
      ]);
      setTasks(taskResult.tasks ?? []);
      setBoards(boardResult.boards ?? []);
      setTodos(todoResult.todos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your major tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todosByTask = useMemo(() => {
    const map = new Map<string, TodoRecord[]>();
    todos.forEach((todo) => {
      const task = todo.task;
      const taskId = task && typeof task === "object" ? String(task.id ?? task._id ?? "") : typeof task === "string" ? task : "";
      if (!taskId) return;
      const current = map.get(taskId) ?? [];
      current.push(todo);
      map.set(taskId, current);
    });
    return map;
  }, [todos]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter && task.taskStatus !== statusFilter) return false;
      if (!term) return true;
      return [task.title, task.description, boardTitle(task, boards)].some((value) =>
        String(value ?? "").toLowerCase().includes(term),
      );
    });
  }, [tasks, boards, search, statusFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <PanelHeader
          title="My major tasks"
          description="Major tasks you own or are assigned to. Each one holds the todos that carry work forward day to day."
          actions={
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" size={14} />
                <input
                  className={`${inputClass} w-56 pl-8`}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks..."
                  value={search}
                />
              </div>
              <select className={`${inputClass} w-40`} onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">All statuses</option>
                {TASK_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <button className={btnSecondary} onClick={() => void load()} type="button">
                <RefreshCw size={13} /> Refresh
              </button>
              <button className={btnPrimary} onClick={() => setCreateOpen(true)} type="button">
                <Plus size={13} /> New major task
              </button>
            </>
          }
        />

        <ErrorNote message={error} />
        {loading ? <LoadingRows rows={4} /> : null}

        {!loading && !filtered.length ? (
          <EmptyState
            title={tasks.length ? "No tasks match your filters" : "No major tasks yet"}
            description={
              tasks.length
                ? "Try clearing the search or status filter."
                : "Create a major task on one of your boards, then break it into todos to track progress, carry-forward and compactions."
            }
            action={
              <button className={btnPrimary} onClick={() => setCreateOpen(true)} type="button">
                <Plus size={13} /> Create a major task
              </button>
            }
          />
        ) : null}

        <div className="space-y-2">
          {filtered.map((task) => {
            const taskTodos = todosByTask.get(task.id) ?? [];
            const completed = taskTodos.filter((todo) => ["completed", "approved"].includes(todo.status)).length;
            const total = taskTodos.length;
            const progress = total ? Math.round((completed / total) * 100) : 0;
            const openTodo = taskTodos.find((todo) => !["completed", "approved"].includes(todo.status)) ?? taskTodos[0];
            const boardId =
              task.board && typeof task.board === "object"
                ? String(task.board.id ?? task.board._id ?? "")
                : typeof task.board === "string"
                  ? task.board
                  : "";
            return (
              <div
                className="rounded-xl border border-slate-200 px-4 py-3 dark:border-zinc-800"
                key={task.id}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{task.title}</p>
                      <StatusPill status={String(task.taskStatus ?? "not_started")} />
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {String(task.priority ?? "medium")}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-zinc-400">
                      {task.description?.trim() || "No description yet."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {boardId ? (
                      <Link
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                        href={`/board/${boardId}`}
                      >
                        {boardTitle(task, boards) || "Open board"} <ArrowRight size={10} />
                      </Link>
                    ) : null}
                    {openTodo ? (
                      <Link
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:underline dark:text-zinc-400"
                        href={`/boards?tab=task-history&todo=${openTodo.id}`}
                      >
                        History <ArrowRight size={10} />
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-zinc-400">
                  <span>{boardTitle(task, boards) || "Board"}</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock size={10} />
                    {task.originalDeadline ? `Deadline ${formatDate(task.originalDeadline)}` : `Started ${formatDate(task.startDate)}`}
                  </span>
                  <span>Owner {memberName(task.owner)}</span>
                  {(task.assignees ?? []).length ? (
                    <span>
                      Assigned to {(task.assignees ?? []).map((assignee) => memberName(assignee)).join(", ")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={progress} />
                  <span className="w-20 text-right text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                    {completed}/{total} todos
                  </span>
                  <Link
                    className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:underline dark:text-sky-300"
                    href="/boards?tab=my-todos"
                  >
                    Todo board <ArrowRight size={10} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <CreateMajorTaskModal
        boards={boards}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          showSuccessToast("Major task created.");
          void load();
        }}
        open={createOpen}
      />
    </div>
  );
}

function CreateMajorTaskModal({
  open,
  boards,
  onClose,
  onCreated,
}: {
  open: boolean;
  boards: BoardOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [boardId, setBoardId] = useState("");
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    columnId: "",
    title: "",
    description: "",
    instructions: "",
    priority: "medium",
    startDate: "",
    originalDeadline: "",
  });

  useEffect(() => {
    if (!open) {
      setError("");
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setColumns([]);
    setForm((current) => ({ ...current, columnId: "" }));
    if (!boardId) return;
    let cancelled = false;
    setColumnsLoading(true);
    apiFetch<{ columns: ColumnOption[] }>(`/api/boards/${boardId}`, undefined, { toast: false })
      .then((result) => {
        if (cancelled) return;
        const ordered = [...(result.columns ?? [])].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
        setColumns(ordered);
        const preferred = ordered.find((column) => column.title.toLowerCase() === "todo") ?? ordered[0];
        setForm((current) => ({ ...current, columnId: preferred?.id ?? "" }));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load board columns.");
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, open]);

  async function submit() {
    if (!boardId) {
      setError("Choose a board first.");
      return;
    }
    if (!form.columnId) {
      setError("Choose the column this major task belongs to.");
      return;
    }
    if (!form.title.trim()) {
      setError("A task title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/boards/major-tasks", {
        method: "POST",
        body: JSON.stringify({
          boardId,
          columnId: form.columnId,
          title: form.title.trim(),
          description: form.description,
          instructions: form.instructions,
          priority: form.priority,
          startDate: form.startDate || null,
          originalDeadline: form.originalDeadline || null,
        }),
      });
      setForm({
        columnId: "",
        title: "",
        description: "",
        instructions: "",
        priority: "medium",
        startDate: "",
        originalDeadline: "",
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the major task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="New major task" onClose={onClose}>
      <ErrorNote message={error} />
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Board</label>
          <select className={inputClass} onChange={(event) => setBoardId(event.target.value)} value={boardId}>
            <option value="">Select a board</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Column</label>
          <select
            className={inputClass}
            disabled={!boardId || columnsLoading}
            onChange={(event) => setForm((current) => ({ ...current, columnId: event.target.value }))}
            value={form.columnId}
          >
            <option value="">{columnsLoading ? "Loading columns..." : "Select a column"}</option>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Title</label>
          <input
            className={inputClass}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="What is the major outcome?"
            value={form.title}
          />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={textareaClass}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Context and scope..."
            value={form.description}
          />
        </div>
        <div>
          <label className={labelClass}>Instructions</label>
          <textarea
            className={textareaClass}
            onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
            placeholder="How should this work be carried out?"
            value={form.instructions}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Priority</label>
            <select
              className={inputClass}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
              value={form.priority}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Original deadline</label>
            <input
              className={inputClass}
              onChange={(event) => setForm((current) => ({ ...current, originalDeadline: event.target.value }))}
              type="date"
              value={form.originalDeadline}
            />
          </div>
          <div>
            <label className={labelClass}>Start date</label>
            <input
              className={inputClass}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              type="date"
              value={form.startDate}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className={btnSecondary} onClick={onClose} type="button">
          Cancel
        </button>
        <button className={btnPrimary} disabled={saving} onClick={() => void submit()} type="button">
          {saving ? "Creating..." : "Create task"}
        </button>
      </div>
    </Modal>
  );
}
