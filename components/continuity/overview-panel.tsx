"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  RotateCcw,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import {
  btnSecondary,
  Card,
  EmptyState,
  ErrorNote,
  formatDate,
  LoadingRows,
  memberName,
  PanelHeader,
  ProgressBar,
  StatusPill,
  taskTitle,
  type HandoverRecord,
  type TodoRecord,
} from "./common";

type ResumeResponse = {
  timeZone: string;
  todayKey: string;
  counts: Record<string, number>;
  groups: Record<string, TodoRecord[]>;
  todos: TodoRecord[];
  handovers: HandoverRecord[];
  compactions: Record<string, any>[];
};

const GROUPS: { key: string; title: string; hint: string; tone: string }[] = [
  { key: "carriedForward", title: "Carried forward", hint: "Work moved to this working day.", tone: "orange" },
  { key: "inProgress", title: "In progress", hint: "Resume from the last known state.", tone: "sky" },
  { key: "blocked", title: "Blocked", hint: "Needs a decision or unblocking.", tone: "rose" },
  { key: "awaitingReview", title: "Awaiting review", hint: "Finished but not yet approved.", tone: "violet" },
  { key: "delegationPending", title: "Delegation pending", hint: "Waiting for the recipient to accept.", tone: "indigo" },
  { key: "notStarted", title: "Not started", hint: "Planned for today.", tone: "slate" },
];

export function ResumeWorkspacePanel() {
  const [data, setData] = useState<ResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openGroup, setOpenGroup] = useState<string>("carriedForward");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<ResumeResponse>("/api/boards/resume", undefined, { toast: false });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the resume workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = data?.counts ?? {};

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-sky-400">
        <PanelHeader
          title="Resume workspace"
          description="Pick up exactly where you left off. Carry-forward keeps the original assigned date and every previous note."
          actions={
            <button className={btnSecondary} onClick={() => void load()} type="button">
              <RefreshCw size={13} /> Refresh
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Active work" value={counts.total ?? 0} tone="slate" />
          <Metric label="Carried forward" value={counts.carriedForward ?? 0} tone="orange" />
          <Metric label="Due today" value={counts.dueToday ?? 0} tone="sky" />
          <Metric label="Overdue" value={counts.overdue ?? 0} tone="rose" />
        </div>
        {(counts.pendingHandovers ?? 0) > 0 || (counts.pendingCompactions ?? 0) > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {(counts.pendingHandovers ?? 0) > 0 ? (
              <Link className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" href="/boards?tab=delegated-work">
                {counts.pendingHandovers} handover request(s) need your response
              </Link>
            ) : null}
            {(counts.pendingCompactions ?? 0) > 0 ? (
              <Link className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" href="/profile/compactions">
                {counts.pendingCompactions} compaction draft(s) await confirmation
              </Link>
            ) : null}
          </div>
        ) : null}
      </Card>

      <ErrorNote message={error} />
      {loading ? <LoadingRows rows={4} /> : null}

      {!loading && data && !data.todos.length ? (
        <Card>
          <EmptyState
            title="Nothing to resume"
            description="Once a todo is assigned, carried forward or left in progress, it appears here at the start of your next working day."
          />
        </Card>
      ) : null}

      {!loading ? (
        <div className="space-y-3">
          {GROUPS.filter((group) => (data?.groups?.[group.key]?.length ?? 0) > 0).map((group) => {
            const items = data?.groups?.[group.key] ?? [];
            const isOpen = openGroup === group.key;
            return (
              <Card key={group.key}>
                <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpenGroup(isOpen ? "" : group.key)} type="button">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    group.tone === "orange"
                      ? "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300"
                      : group.tone === "sky"
                        ? "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300"
                        : group.tone === "rose"
                          ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300"
                          : group.tone === "violet"
                            ? "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"
                            : group.tone === "indigo"
                              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"
                              : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}>
                    <Layers size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{group.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">{group.hint}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {items.length}
                  </span>
                </button>

                {isOpen ? (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                    {items.map((todo) => (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-[#0b0b0b]" key={todo.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{todo.title}</span>
                          <StatusPill status={todo.status} />
                          {todo.isContinuation ? (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                              Continuation
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-zinc-400">
                          {taskTitle(todo) ? <span>{taskTitle(todo)}</span> : null}
                          <span>{memberName(todo.assigneeId)}</span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock size={10} /> Original {formatDate(todo.originalAssignedDate)}
                          </span>
                          <span>Working {formatDate(todo.currentWorkingDate)}</span>
                          {todo.dueDate ? <span>Due {formatDate(todo.dueDate)}</span> : null}
                        </div>
                        {todo.resumeNote ? (
                          <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                            <span className="font-semibold">Resume: </span>
                            {todo.resumeNote}
                          </p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          <ProgressBar value={Number(todo.progress ?? 0)} />
                          <span className="w-8 text-right text-[10px] font-semibold text-slate-500">{Number(todo.progress ?? 0)}%</span>
                          <Link
                            className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                            href={`/boards?tab=task-history&todo=${todo.id}`}
                          >
                            History <ArrowRight size={10} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type OverviewResponse = {
  scope: string;
  counts: Record<string, number>;
  boards: Record<string, any>[];
  pendingHandovers: HandoverRecord[];
  awaitingCompactions: Record<string, any>[];
};

export function BoardsOverviewPanel() {
  const [scope, setScope] = useState<"mine" | "team" | "company">("mine");
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<OverviewResponse>(`/api/boards/overview?scope=${scope}`, undefined, { toast: false });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the overview.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = data?.counts ?? {};
  const boards = useMemo(() => data?.boards ?? [], [data]);

  return (
    <div className="space-y-4">
      <Card>
        <PanelHeader
          title="Boards overview"
          description="How work is flowing across boards, todos, delegations and compactions."
          actions={
            <>
              <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-zinc-700">
                {(["mine", "team", "company"] as const).map((value) => (
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
                    {value}
                  </button>
                ))}
              </div>
              <button className={btnSecondary} onClick={() => void load()} type="button">
                <RefreshCw size={13} /> Refresh
              </button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Total todos" value={counts.total ?? 0} tone="slate" />
          <Metric label="Active" value={counts.active ?? 0} tone="sky" />
          <Metric label="Completed" value={counts.completed ?? 0} tone="emerald" />
          <Metric label="Carried forward" value={counts.carriedForward ?? 0} tone="orange" />
          <Metric label="Blocked" value={counts.blocked ?? 0} tone="rose" />
          <Metric label="Partially completed" value={counts.partiallyCompleted ?? 0} tone="amber" />
          <Metric label="Pending review" value={counts.pendingReview ?? 0} tone="violet" />
          <Metric label="Average progress" value={counts.averageProgress ?? 0} tone="slate" suffix="%" />
        </div>
      </Card>

      <ErrorNote message={error} />
      {loading ? <LoadingRows rows={3} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <PanelHeader title="Boards" description="Open a board to manage its major tasks." />
          {!loading && !boards.length ? (
            <EmptyState title="No boards yet" description="Create a board to start breaking major tasks into todos." action={<Link className={btnSecondary} href="/board">Go to boards</Link>} />
          ) : (
            <div className="space-y-2">
              {boards.slice(0, 12).map((board) => (
                <Link
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                  href={`/board/${String(board.id ?? "")}`}
                  key={String(board.id ?? "")}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Layers size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">{String(board.title ?? "Board")}</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                      {Number(board.taskCount ?? 0)} tasks · {Number(board.todoCount ?? 0)} todos · {Number(board.activeTodoCount ?? 0)} active
                    </p>
                  </div>
                  <ArrowRight size={13} className="text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <PanelHeader title="Needs attention" description="Handovers waiting for acceptance and compactions waiting for confirmation." />
            <div className="space-y-2">
              {(data?.pendingHandovers ?? []).map((handover) => (
                <Link
                  className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-[11px] text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200"
                  href="/boards?tab=delegated-work"
                  key={handover.id}
                >
                  <Users size={12} />
                  <span className="font-semibold">{memberName(handover.fromEmployee)}</span>
                  wants to hand over{" "}
                  <span className="font-semibold">{handover.todo && typeof handover.todo === "object" ? handover.todo.title : "a todo"}</span>
                </Link>
              ))}
              {(data?.awaitingCompactions ?? []).map((item) => (
                <Link
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                  href="/profile/compactions"
                  key={String(item.id)}
                >
                  <Clock size={12} />
                  <span className="font-semibold">{String(item.compactionType ?? "EOD")}</span> for {formatDate(item.reportingDate)} needs confirmation
                </Link>
              ))}
              {!loading && !(data?.pendingHandovers ?? []).length && !(data?.awaitingCompactions ?? []).length ? (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} /> Nothing waiting on you right now.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <PanelHeader title="Work health" description="Blocked and overdue work should be the first thing a manager reviews." />
            <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-300">
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-zinc-950">
                <span className="inline-flex items-center gap-1.5"><AlertTriangle size={12} className="text-rose-500" /> Blocked todos</span>
                <span className="font-semibold">{counts.blocked ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-zinc-950">
                <span className="inline-flex items-center gap-1.5"><RotateCcw size={12} className="text-orange-500" /> Delegations pending</span>
                <span className="font-semibold">{counts.pendingHandovers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-zinc-950">
                <span className="inline-flex items-center gap-1.5"><Clock size={12} className="text-amber-500" /> Awaiting compaction</span>
                <span className="font-semibold">{counts.awaitingCompactions ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone, suffix = "" }: { label: string; value: number; tone: string; suffix?: string }) {
  const tones: Record<string, string> = {
    slate: "border-slate-200 dark:border-zinc-800",
    sky: "border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20",
    emerald: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
    orange: "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20",
    rose: "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20",
    amber: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
    violet: "border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone] ?? tones.slate}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-zinc-100">
        {value}
        {suffix}
      </p>
    </div>
  );
}
