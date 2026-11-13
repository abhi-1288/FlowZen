"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Bell,
  ChevronDown,
  Grid2X2,
  Layers,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
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
              <Link className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" href="/board/workspace?tab=delegated-work">
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
  priority?: { high: number; medium: number; low: number };
  activity?: { date: string; count: number }[];
};

export function BoardsOverviewPanel() {
  const { data: session } = useSession();
  const [scope, setScope] = useState<"mine" | "team" | "company">("mine");
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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
  const boards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.boards ?? []).filter((board) => !normalized || String(board.title ?? "").toLowerCase().includes(normalized));
  }, [data, query]);
  const statusTotal = Math.max(1, Number(counts.total ?? 0));
  const active = Number(counts.active ?? counts.inProgress ?? 0);
  const completed = Number(counts.completed ?? 0);
  const blocked = Number(counts.blocked ?? 0);
  const notStarted = Number(counts.notStarted ?? Math.max(0, Number(counts.total ?? 0) - active - completed - blocked));
  const statusItems = [
    { label: "In progress", value: active, tone: "bg-blue-600", text: "text-blue-700" },
    { label: "Completed", value: completed, tone: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Overdue", value: blocked, tone: "bg-amber-500", text: "text-amber-700" },
  ];
  const priorityItems = [
    { label: "High priority", value: Number(data?.priority?.high ?? 0), color: "bg-blue-700" },
    { label: "Medium priority", value: Number(data?.priority?.medium ?? 0), color: "bg-sky-500" },
    { label: "Low priority", value: Number(data?.priority?.low ?? 0), color: "bg-slate-200" },
  ];
  const priorityTotal = priorityItems.reduce((sum, item) => sum + item.value, 0);
  const activityValues = data?.activity ?? [];
  const maxActivity = Math.max(1, ...activityValues.map((item) => item.count));
  const displayName = session?.user?.name?.split(" ")[0] || "there";
  const initials = (session?.user?.name || "FlowZen User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden bg-gradient-to-br from-white via-white to-slate-50 p-0 dark:from-[#0b0b0b] dark:via-[#0b0b0b] dark:to-zinc-950">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white"><Grid2X2 size={18} /></span> TaskFlow</div>
          <div className="hidden h-7 w-px bg-slate-200 sm:block dark:bg-zinc-800" />
          <div className="min-w-[180px] flex-1"><h2 className="text-xl font-semibold tracking-tight">Welcome back, {displayName}! 👋</h2><p className="text-xs text-slate-500 dark:text-zinc-400">Here&apos;s what&apos;s happening with your team today.</p></div>
          <label className="flex min-w-[210px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 dark:border-zinc-700 dark:bg-zinc-950"><Search size={16} /><input aria-label="Search boards" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" placeholder="Search here..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <button aria-label="Notifications" className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 dark:border-zinc-700 dark:text-zinc-300" type="button"><Bell size={17} />{Number(counts.pendingHandovers ?? 0) > 0 ? <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">{Number(counts.pendingHandovers ?? 0)}</span> : null}</button>
          <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5 text-left dark:border-zinc-700" type="button"><span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{initials}</span><span className="hidden text-xs sm:block"><strong className="block text-slate-900 dark:text-zinc-100">{session?.user?.name || "My workspace"}</strong><span className="text-slate-500 dark:text-zinc-400">{session?.user?.email || "Personal overview"}</span></span><ChevronDown size={14} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          <Metric label="Active projects" value={boards.length} tone="sky" />
          <Metric label="Utilization rate" value={Number(counts.averageProgress ?? 0)} tone="violet" suffix="%" />
          <Metric label="Completed tasks" value={completed} tone="emerald" />
          <Metric label="At risk projects" value={blocked} tone="rose" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <Card><PanelHeader title="Task status distribution" description="How your tracked work is moving across the workflow." actions={<button aria-label="Task status options" className="rounded-full border border-slate-200 p-2 dark:border-zinc-700" type="button"><MoreHorizontal size={16} /></button>} /><div className="grid gap-5 sm:grid-cols-3">{statusItems.map((item) => <div key={item.label}><div className={`mb-2 h-2 rounded-full ${item.tone}`} /><p className={`text-xs font-medium ${item.text}`}>{item.label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-zinc-100">{Math.round((item.value / statusTotal) * 100)}%</p><p className="text-[11px] text-slate-500 dark:text-zinc-400">{item.value} tasks</p></div>)}</div></Card>

        <Card>
          <PanelHeader title="Task priority" description="Distribution by priority level" actions={<button aria-label="Task priority options" className="rounded-full border border-slate-200 p-2 dark:border-zinc-700" type="button"><MoreHorizontal size={16} /></button>} />
          <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={{ background: priorityTotal ? `conic-gradient(#1d4ed8 0 ${(priorityItems[0].value / priorityTotal) * 100}%, #38bdf8 ${(priorityItems[0].value / priorityTotal) * 100}% ${((priorityItems[0].value + priorityItems[1].value) / priorityTotal) * 100}%, #dbe4f0 ${((priorityItems[0].value + priorityItems[1].value) / priorityTotal) * 100}% 100%)` : "conic-gradient(#dbe4f0 0 100%)" }}><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center dark:bg-zinc-900"><strong className="text-2xl text-slate-900 dark:text-zinc-100">{priorityTotal}</strong><span className="text-[10px] text-slate-500">tasks</span></div></div>
          <div className="mt-4 space-y-2">{priorityItems.map((item) => <div className="flex items-center justify-between text-xs" key={item.label}><span className="inline-flex items-center gap-2 text-slate-600 dark:text-zinc-300"><span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />{item.label}</span><strong>{item.value}</strong></div>)}</div>
        </Card>
      </div>

      <ErrorNote message={error} />
      {loading ? <LoadingRows rows={3} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card><PanelHeader title="Team activity" description="Activity from your tracked work over the last 7 days." actions={<button aria-label="Team activity options" className="rounded-full border border-slate-200 p-2 dark:border-zinc-700" type="button"><MoreHorizontal size={16} /></button>} /><div className="flex items-end gap-2"><span className="text-4xl font-bold text-slate-900 dark:text-zinc-100">{Number(counts.averageProgress ?? 0)}%</span><span className="text-[11px] text-slate-500 dark:text-zinc-400">average progress</span></div><div className="mt-5 grid h-28 grid-cols-7 items-end gap-2">{activityValues.map((item) => <div className="flex h-full flex-col items-center justify-end gap-1" key={item.date}><span className="text-[10px] text-slate-500">{item.count}</span><span aria-label={`${item.date}: ${item.count} updates`} className="w-full rounded-t-md bg-blue-600" style={{ height: `${Math.max(item.count ? 8 : 2, (item.count / maxActivity) * 100)}%` }} /></div>)}</div><div className="mt-2 grid grid-cols-7 text-center text-[10px] text-slate-500">{activityValues.map((item) => <span key={item.date}>{new Date(`${item.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}</span>)}</div></Card>
        <Card>
          <PanelHeader title="Team workload" description="Open a board to manage its major tasks." actions={<Link className="text-xs font-semibold text-blue-700" href="/board">See all</Link>} />
          {!loading && !boards.length ? (
            <EmptyState title="No boards yet" description="Create a board to start breaking major tasks into todos." action={<Link className={btnSecondary} href="/board">Go to boards</Link>} />
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-slate-100 text-slate-500 dark:border-zinc-800"><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Active work</th><th className="pb-2 font-medium">Status</th><th /></tr></thead><tbody>{boards.slice(0, 8).map((board) => (
                <tr className="border-b border-slate-50 last:border-0 dark:border-zinc-900" key={String(board.id ?? "")}>
                  <td className="py-3"><Link className="inline-flex items-center gap-2 font-semibold text-slate-900 hover:text-blue-700 dark:text-zinc-100" href={`/board/${String(board.id ?? "")}`}><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-zinc-800"><Layers size={13} /></span>{String(board.title ?? "Board")}</Link></td><td className="py-3 font-semibold">{Number(board.activeTodoCount ?? board.todoCount ?? 0)}</td><td className="py-3"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />On track</span></td><td className="py-3 text-right"><MoreHorizontal size={15} className="ml-auto text-slate-400" /></td>
                </tr>
              ))}</tbody></table></div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <PanelHeader title="Needs attention" description="Handovers waiting for acceptance and compactions waiting for confirmation." />
            <div className="space-y-2">
              {(data?.pendingHandovers ?? []).map((handover) => (
                <Link
                  className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-[11px] text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200"
                  href="/board/workspace?tab=delegated-work"
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

function DashboardSignal({ label, value, tone }: { label: string; value: string; tone: "blue" | "rose" | "amber" | "violet" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  };
  return <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs ${tones[tone]}`}><span className="font-medium">{label}</span><span className="text-sm font-bold">{value}</span></div>;
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
