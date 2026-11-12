"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { BOARD_TODO_STATUSES, BOARD_TODO_STATUS_LABELS, PRIORITIES } from "@/lib/work-constants";
import {
  btnPrimary,
  btnSecondary,
  Card,
  dateInputValue,
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
  taskTitle,
  textareaClass,
  type Member,
  type TodoRecord,
} from "./common";

const STATUS_OPTIONS = BOARD_TODO_STATUSES.filter(
  (status) => !["carried_forward", "delegation_pending", "delegated"].includes(status),
);

type TaskOption = { id: string; title: string; board?: unknown; owner?: unknown; taskStatus?: string };

export function TodosPanel({
  defaultScope = "mine",
  showCreate = true,
}: {
  defaultScope?: "mine" | "team" | "all";
  showCreate?: boolean;
}) {
  const { showSuccessToast } = useNotificationToast();
  const [scope, setScope] = useState(defaultScope);
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    taskId: "",
    title: "",
    assigneeId: "",
    priority: "medium",
    originalAssignedDate: dateInputValue(new Date()),
    dueDate: "",
    description: "",
    remainingWork: "",
    nextAction: "",
  });

  const [carryTodo, setCarryTodo] = useState<TodoRecord | null>(null);
  const [carryForm, setCarryForm] = useState({
    toDate: dateInputValue(new Date(Date.now() + 86_400_000)),
    reason: "",
    action: "continue_tomorrow",
    remainingWork: "",
    nextAction: "",
  });

  const [delegateTodo, setDelegateTodo] = useState<TodoRecord | null>(null);
  const [delegateForm, setDelegateForm] = useState({ toEmployeeId: "", reason: "", instructions: "" });

  const [progressForm, setProgressForm] = useState({
    status: "in_progress",
    progress: 0,
    workNotes: "",
    remainingWork: "",
    nextAction: "",
    blockerNotes: "",
    comment: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ scope, limit: "300" });
      if (statusFilter) query.set("status", statusFilter);
      const result = await apiFetch<{ todos: TodoRecord[] }>(
        `/api/boards/todos?${query.toString()}`,
        undefined,
        { toast: false },
      );
      setTodos(result.todos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load todos.");
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiFetch<{ tasks: TaskOption[] }>("/api/boards/major-tasks?limit=300", undefined, { toast: false })
      .then((result) => setTasks(result.tasks ?? []))
      .catch(() => setTasks([]));
    void apiFetch<{ members: Member[] }>("/api/boards/members", undefined, { toast: false })
      .then((result) => setMembers(result.members ?? []))
      .catch(() => setMembers([]));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return todos;
    return todos.filter((todo) => {
      const haystack = [todo.title, todo.description, taskTitle(todo), memberName(todo.assigneeId), todo.nextAction, todo.remainingWork]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [todos, search]);

  function openProgress(todo: TodoRecord) {
    setExpanded(expanded === todo.id ? null : todo.id);
    setProgressForm({
      status: STATUS_OPTIONS.includes(todo.status as any) ? todo.status : "in_progress",
      progress: Number(todo.progress ?? 0),
      workNotes: todo.completionNotes || todo.partialWorkNotes || "",
      remainingWork: todo.remainingWork || "",
      nextAction: todo.nextAction || "",
      blockerNotes: "",
      comment: "",
    });
  }

  async function saveProgress(todo: TodoRecord) {
    setBusy(true);
    try {
      await apiFetch(`/api/boards/todos`, {
        method: "PATCH",
        body: JSON.stringify({
          id: todo.id,
          status: progressForm.status,
          progress: progressForm.progress,
          workNotes: progressForm.workNotes,
          completionNotes: progressForm.status === "completed" ? progressForm.workNotes : undefined,
          partialWorkNotes: progressForm.status !== "completed" ? progressForm.workNotes : undefined,
          remainingWork: progressForm.remainingWork,
          nextAction: progressForm.nextAction,
          blockerNotes: progressForm.blockerNotes,
          comment: progressForm.comment || undefined,
        }),
      });
      showSuccessToast("Todo progress saved.");
      setExpanded(null);
      await load();
    } catch {
      // apiFetch already raised a toast.
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate() {
    if (!draft.taskId || !draft.title.trim()) return;
    setBusy(true);
    try {
      await apiFetch("/api/boards/todos", {
        method: "POST",
        body: JSON.stringify({
          taskId: draft.taskId,
          title: draft.title,
          assigneeId: draft.assigneeId || undefined,
          priority: draft.priority,
          originalAssignedDate: draft.originalAssignedDate || undefined,
          dueDate: draft.dueDate || undefined,
          description: draft.description,
          remainingWork: draft.remainingWork,
          nextAction: draft.nextAction,
        }),
      });
      showSuccessToast("Todo created.");
      setCreateOpen(false);
      setDraft((current) => ({ ...current, title: "", description: "", remainingWork: "", nextAction: "" }));
      await load();
    } catch {
      // handled by apiFetch toast
    } finally {
      setBusy(false);
    }
  }

  async function submitCarryForward() {
    if (!carryTodo) return;
    setBusy(true);
    try {
      await apiFetch("/api/boards/todos/carry-forward", {
        method: "POST",
        body: JSON.stringify({
          todoId: carryTodo.id,
          toDate: carryForm.toDate,
          reason: carryForm.reason,
          action: carryForm.action,
          remainingWork: carryForm.remainingWork,
          nextAction: carryForm.nextAction,
        }),
      });
      showSuccessToast("Todo carried forward. Original dates are preserved.");
      setCarryTodo(null);
      await load();
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  async function submitDelegation() {
    if (!delegateTodo || !delegateForm.toEmployeeId) return;
    setBusy(true);
    try {
      await apiFetch("/api/boards/todos/handover", {
        method: "POST",
        body: JSON.stringify({
          todoId: delegateTodo.id,
          toEmployeeId: delegateForm.toEmployeeId,
          reason: delegateForm.reason,
          instructions: delegateForm.instructions,
        }),
      });
      showSuccessToast("Delegation request sent. The recipient must accept it.");
      setDelegateTodo(null);
      await load();
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <PanelHeader
        title="My todos"
        description="Every major task broken into a trackable todo. Progress, carry-forward and ownership stay linked."
        actions={
          <>
            <button className={btnSecondary} onClick={() => void load()} type="button">
              <RefreshCw size={13} /> Refresh
            </button>
            {showCreate ? (
              <button className={btnPrimary} onClick={() => setCreateOpen(true)} type="button">
                <Plus size={13} /> New todo
              </button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-zinc-700">
          {(["mine", "team", "all"] as const).map((value) => (
            <button
              key={value}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold capitalize transition ${
                scope === value
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
              onClick={() => setScope(value)}
              type="button"
            >
              {value === "mine" ? "Assigned to me" : value === "team" ? "Team" : "All"}
            </button>
          ))}
        </div>
        <select className={inputClass + " max-w-[180px]"} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          {BOARD_TODO_STATUSES.map((status) => (
            <option key={status} value={status}>
              {BOARD_TODO_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={14} />
          <input
            className={inputClass + " pl-8"}
            placeholder="Search todos, tasks or people"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <ErrorNote message={error} />
      {loading ? <LoadingRows rows={4} /> : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          title="No todos here yet"
          description="Break a major task into todos so daily progress, carry-forward and EOD reports can follow the work."
          action={
            showCreate ? (
              <button className={btnPrimary} onClick={() => setCreateOpen(true)} type="button">
                <Plus size={13} /> Create the first todo
              </button>
            ) : undefined
          }
        />
      ) : null}

      <div className="space-y-2">
        {filtered.map((todo) => {
          const isOpen = expanded === todo.id;
          const carryCount = Array.isArray(todo.carryForwardHistory) ? todo.carryForwardHistory.length : 0;
          return (
            <div
              key={todo.id}
              className={`rounded-xl border transition ${
                isOpen
                  ? "border-slate-300 bg-slate-50/60 dark:border-zinc-600 dark:bg-zinc-900/60"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-[#0b0b0b] dark:hover:border-zinc-700"
              }`}
            >
              <button className="flex w-full items-start gap-3 px-4 py-3 text-left" onClick={() => openProgress(todo)} type="button">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{todo.title}</span>
                    <StatusPill status={todo.status} />
                    {todo.isContinuation ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                        Continuation
                      </span>
                    ) : null}
                    {carryCount > 0 ? (
                      <span className="text-[10px] font-medium text-slate-400">Carried {carryCount}×</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                    {taskTitle(todo) ? <span className="truncate">{taskTitle(todo)}</span> : null}
                    <span>{memberName(todo.assigneeId)}</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={11} /> Original {formatDate(todo.originalAssignedDate)}
                    </span>
                    <span>Working {formatDate(todo.currentWorkingDate)}</span>
                    {todo.dueDate ? <span>Due {formatDate(todo.dueDate)}</span> : null}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={Number(todo.progress ?? 0)} />
                    <span className="w-9 text-right text-[10px] font-semibold text-slate-500">{Number(todo.progress ?? 0)}%</span>
                  </div>
                </div>
                {isOpen ? <ChevronUp className="mt-1 shrink-0 text-slate-400" size={16} /> : <ChevronDown className="mt-1 shrink-0 text-slate-400" size={16} />}
              </button>

              {isOpen ? (
                <div className="border-t border-slate-200 px-4 py-4 dark:border-zinc-800">
                  {todo.instructions ? (
                    <p className="mb-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 dark:bg-zinc-950 dark:text-zinc-300">
                      <span className="font-semibold">Instructions: </span>
                      {todo.instructions}
                    </p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Status</label>
                      <select
                        className={inputClass}
                        value={progressForm.status}
                        onChange={(event) => setProgressForm({ ...progressForm, status: event.target.value })}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {BOARD_TODO_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Progress · {progressForm.progress}%</label>
                      <input
                        className="mt-2 w-full accent-slate-900 dark:accent-zinc-100"
                        max={100}
                        min={0}
                        onChange={(event) => setProgressForm({ ...progressForm, progress: Number(event.target.value) })}
                        step={5}
                        type="range"
                        value={progressForm.progress}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className={labelClass}>What did you complete or work on?</label>
                    <textarea
                      className={textareaClass}
                      onChange={(event) => setProgressForm({ ...progressForm, workNotes: event.target.value })}
                      placeholder="Unfinished work is never auto-marked complete."
                      value={progressForm.workNotes}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Remaining work</label>
                      <textarea
                        className={textareaClass}
                        onChange={(event) => setProgressForm({ ...progressForm, remainingWork: event.target.value })}
                        value={progressForm.remainingWork}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Next action</label>
                      <textarea
                        className={textareaClass}
                        onChange={(event) => setProgressForm({ ...progressForm, nextAction: event.target.value })}
                        value={progressForm.nextAction}
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Blocker notes</label>
                      <input
                        className={inputClass}
                        onChange={(event) => setProgressForm({ ...progressForm, blockerNotes: event.target.value })}
                        placeholder="What is stopping progress?"
                        value={progressForm.blockerNotes}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Comment</label>
                      <input
                        className={inputClass}
                        onChange={(event) => setProgressForm({ ...progressForm, comment: event.target.value })}
                        placeholder="Add a note to this todo"
                        value={progressForm.comment}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button className={btnPrimary} disabled={busy} onClick={() => void saveProgress(todo)} type="button">
                      <Send size={13} /> Save progress
                    </button>
                    <button
                      className={btnSecondary}
                      onClick={() => {
                        setCarryTodo(todo);
                        setCarryForm({
                          toDate: dateInputValue(new Date(Date.now() + 86_400_000)),
                          reason: "",
                          action: "continue_tomorrow",
                          remainingWork: todo.remainingWork ?? "",
                          nextAction: todo.nextAction ?? "",
                        });
                      }}
                      type="button"
                    >
                      <ArrowRightLeft size={13} /> Carry forward
                    </button>
                    <button
                      className={btnSecondary}
                      onClick={() => {
                        setDelegateTodo(todo);
                        setDelegateForm({ toEmployeeId: "", reason: "", instructions: todo.instructions ?? "" });
                      }}
                      type="button"
                    >
                      <ArrowRightLeft size={13} /> Delegate
                    </button>
                    {carryCount > 0 ? (
                      <span className="text-[11px] text-slate-400">
                        Carried forward {carryCount}× · original assigned {formatDate(todo.originalAssignedDate)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Modal open={createOpen} title="Create todo" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Major task</label>
            <select className={inputClass} value={draft.taskId} onChange={(event) => setDraft({ ...draft, taskId: event.target.value })}>
              <option value="">Select a major task</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Todo title</label>
            <input className={inputClass} onChange={(event) => setDraft({ ...draft, title: event.target.value })} value={draft.title} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Assignee</label>
              <select className={inputClass} value={draft.assigneeId} onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })}>
                <option value="">Me</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select className={inputClass} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Original assigned date</label>
              <input className={inputClass} onChange={(event) => setDraft({ ...draft, originalAssignedDate: event.target.value })} type="date" value={draft.originalAssignedDate} />
            </div>
            <div>
              <label className={labelClass}>Due date</label>
              <input className={inputClass} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} type="date" value={draft.dueDate} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={textareaClass} onChange={(event) => setDraft({ ...draft, description: event.target.value })} value={draft.description} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className={btnSecondary} onClick={() => setCreateOpen(false)} type="button">
              Cancel
            </button>
            <button className={btnPrimary} disabled={busy || !draft.taskId || !draft.title.trim()} onClick={() => void submitCreate()} type="button">
              Create todo
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(carryTodo)} title="Carry forward unfinished work" onClose={() => setCarryTodo(null)}>
        <div className="space-y-3">
          <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
            The original todo keeps its original assigned date and history. A linked continuation is created for the new working day.
          </div>
          <div>
            <label className={labelClass}>Continue to</label>
            <input className={inputClass} onChange={(event) => setCarryForm({ ...carryForm, toDate: event.target.value })} type="date" value={carryForm.toDate} />
          </div>
          <div>
            <label className={labelClass}>Action</label>
            <select className={inputClass} onChange={(event) => setCarryForm({ ...carryForm, action: event.target.value })} value={carryForm.action}>
              <option value="continue_tomorrow">Continue tomorrow</option>
              <option value="schedule">Schedule for another date</option>
              <option value="blocked">Still blocked</option>
              <option value="delegate">Will delegate</option>
              <option value="request_assistance">Request assistance</option>
              <option value="cancel">Cancel remaining work</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Reason</label>
            <textarea className={textareaClass} onChange={(event) => setCarryForm({ ...carryForm, reason: event.target.value })} value={carryForm.reason} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Remaining work</label>
              <textarea className={textareaClass} onChange={(event) => setCarryForm({ ...carryForm, remainingWork: event.target.value })} value={carryForm.remainingWork} />
            </div>
            <div>
              <label className={labelClass}>Next action</label>
              <textarea className={textareaClass} onChange={(event) => setCarryForm({ ...carryForm, nextAction: event.target.value })} value={carryForm.nextAction} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setCarryTodo(null)} type="button">
              Cancel
            </button>
            <button className={btnPrimary} disabled={busy} onClick={() => void submitCarryForward()} type="button">
              Carry forward
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(delegateTodo)} title="Delegate this todo" onClose={() => setDelegateTodo(null)}>
        <div className="space-y-3">
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
            Ownership only transfers after the recipient accepts. The original owner and history stay visible.
          </div>
          <div>
            <label className={labelClass}>Recipient</label>
            <select className={inputClass} onChange={(event) => setDelegateForm({ ...delegateForm, toEmployeeId: event.target.value })} value={delegateForm.toEmployeeId}>
              <option value="">Select an approved member</option>
              {members
                .filter((member) => member.id !== memberIdOf(delegateTodo?.assigneeId))
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Reason</label>
            <textarea className={textareaClass} onChange={(event) => setDelegateForm({ ...delegateForm, reason: event.target.value })} value={delegateForm.reason} />
          </div>
          <div>
            <label className={labelClass}>Handover instructions</label>
            <textarea className={textareaClass} onChange={(event) => setDelegateForm({ ...delegateForm, instructions: event.target.value })} value={delegateForm.instructions} />
          </div>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setDelegateTodo(null)} type="button">
              Cancel
            </button>
            <button className={btnPrimary} disabled={busy || !delegateForm.toEmployeeId || !delegateForm.reason.trim()} onClick={() => void submitDelegation()} type="button">
              Send request
            </button>
          </div>
        </div>
      </Modal>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 shrink-0" size={13} />
        Unfinished work is never reported as complete. A todo marked completed is the only thing an EOD counts as done.
      </div>
    </Card>
  );
}

function memberIdOf(value: TodoRecord["assigneeId"]): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.id ?? value._id ?? "";
}
