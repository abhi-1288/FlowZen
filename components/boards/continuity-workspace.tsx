"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import {
  ArrowLeft,
  Activity,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  GitBranch,
  History,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PlayCircle,
  RefreshCw,
  Users,
} from "lucide-react";
import { BoardsOverviewPanel, ResumeWorkspacePanel } from "@/components/continuity/overview-panel";
import { MyBoardsPanel, MyTasksPanel } from "@/components/continuity/my-work-panel";
import { TodosPanel } from "@/components/continuity/todos-panel";
import { CompactionsPanel } from "@/components/continuity/compactions-panel";
import { DelegatedWorkPanel } from "@/components/continuity/delegated-work-panel";
import { TeamCompactionsPanel } from "@/components/continuity/team-compactions-panel";
import { TaskHistoryPanel } from "@/components/continuity/task-history-panel";
import { ActivityTimelinePanel } from "@/components/continuity/activity-timeline-panel";

type WorkspaceTab =
  | "overview"
  | "timeline"
  | "my-boards"
  | "my-tasks"
  | "my-todos"
  | "resume"
  | "compactions"
  | "delegated-work"
  | "team-compactions"
  | "task-history";

const TABS: { key: WorkspaceTab; label: string; icon: typeof Layers }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "timeline", label: "Activity Timeline", icon: Activity },
  { key: "my-boards", label: "My Boards", icon: FolderKanban },
  { key: "my-tasks", label: "My Tasks", icon: ClipboardList },
  { key: "my-todos", label: "My Todos", icon: ListChecks },
  { key: "resume", label: "Resume", icon: PlayCircle },
  { key: "compactions", label: "Compactions", icon: CheckSquare },
  { key: "delegated-work", label: "Delegated Work", icon: Users },
  { key: "team-compactions", label: "Team Compactions", icon: Layers },
  { key: "task-history", label: "Task History", icon: History },
];

const TAB_KEYS = new Set<string>(TABS.map((tab) => tab.key));

export function ContinuityWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const rawTab = searchParams?.get("tab") ?? "";
  const normalizedTab = rawTab === "activity" ? "timeline" : rawTab;
  const requestedTab: WorkspaceTab = TAB_KEYS.has(normalizedTab) ? (normalizedTab as WorkspaceTab) : "overview";
  const tab: WorkspaceTab = requestedTab;
  const todoFocus = searchParams?.get("todo") ?? "";
  const compactionFocus = searchParams?.get("focus") ?? "";
  const teamCompactionFocus = searchParams?.get("teamCompaction") ?? "";
  const visibleTabs = TABS;

  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadCounts = useCallback(async () => {
    const results = await Promise.allSettled([
      apiFetch<{ boards?: any[] }>("/api/boards", undefined, { toast: false }).then((r) => r?.boards?.length ?? 0).catch(() => 0),
      apiFetch<{ tasks?: any[] }>("/api/boards/major-tasks?limit=200", undefined, { toast: false }).then((r) => r?.tasks?.length ?? 0).catch(() => 0),
      apiFetch<{ todos?: any[] }>("/api/boards/todos?scope=mine&limit=200", undefined, { toast: false }).then((r) => r?.todos?.length ?? 0).catch(() => 0),
      apiFetch<{ compactions?: any[]; counts?: Record<string, number> }>("/api/compactions?scope=mine&limit=1", undefined, { toast: false }).then((r) => r?.counts?.actionRequired ?? r?.compactions?.length ?? 0).catch(() => 0),
      apiFetch<{ handovers?: any[] }>("/api/boards/todos/handover?scope=incoming&status=pending", undefined, { toast: false }).then((r) => r?.handovers?.length ?? 0).catch(() => 0),
      apiFetch<{ compactions?: any[]; counts?: Record<string, number> }>("/api/team-compactions?scope=owned&limit=1", undefined, { toast: false }).then((r) => r?.counts?.actionRequired ?? r?.compactions?.length ?? 0).catch(() => 0),
    ]);
    setCounts({
      "my-boards": results[0].status === "fulfilled" ? results[0].value : 0,
      "my-tasks": results[1].status === "fulfilled" ? results[1].value : 0,
      "my-todos": results[2].status === "fulfilled" ? results[2].value : 0,
      compactions: results[3].status === "fulfilled" ? results[3].value : 0,
      "delegated-work": results[4].status === "fulfilled" ? results[4].value : 0,
      "team-compactions": results[5].status === "fulfilled" ? results[5].value : 0,
    });
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const goToTab = useCallback(
    (next: WorkspaceTab) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", next);
      params.delete("todo");
      params.delete("focus");
      params.delete("teamCompaction");
      router.push(`/board/workspace?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070707] dark:text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-[#0b0b0b]/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            href="/board"
          >
            <ArrowLeft size={14} /> Kanban
          </Link>
          <div className="h-5 w-px bg-slate-200 dark:bg-zinc-800" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">Boards workspace</h1>
            <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
              Tasks, todos, carry-forward, compactions and delegations in one place.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              href="/profile/compactions"
            >
              <CheckSquare size={12} /> My compactions
            </Link>
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              href="/profile/team-compactions"
            >
              <Layers size={12} /> Team inbox
            </Link>
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              href="/profile"
            >
              Profile
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-5">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-20 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#0b0b0b]">
            <div className="border-b border-slate-200 p-4 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <Link className="flex min-w-0 items-center gap-2" href="/profile" aria-label="Open profile">
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg shadow-sm shadow-indigo-500/20">
                    <Image src="/Logos/logo.jpg" alt="FlowZen logo" fill className="object-cover" />
                  </span>
                  <span className="truncate text-lg font-bold tracking-tight text-slate-950 dark:text-zinc-100">FlowZen</span>
                </Link>
                <button
                  aria-label="Sign out"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  type="button"
                >
                  <LogOut size={16} />
                </button>
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">
                {session?.user?.name || "FlowZen User"}
                <span className="mx-1 text-slate-400">•</span>
                <span className="font-medium capitalize text-slate-500 dark:text-zinc-400">{session?.user?.role || "member"}</span>
              </p>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-zinc-400">
                {session?.user?.company || "Unemployed"}
                <span className="mx-1">•</span>
                {session?.user?.team
                  ? session.user.team
                  : session?.user?.managedTeamCount
                    ? `${session.user.managedTeamCount} Team${session.user.managedTeamCount > 1 ? "s" : ""}`
                    : "No Team"}
              </p>
            </div>

            <nav className="space-y-1 p-2">
            {visibleTabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              const count = counts[item.key];
              return (
                <button
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                  key={item.key}
                  onClick={() => goToTab(item.key)}
                  type="button"
                >
                  <Icon size={14} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {typeof count === "number" && count > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active
                          ? "bg-white/20 text-white dark:bg-zinc-900/40 dark:text-zinc-900"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 md:hidden">
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-zinc-800 dark:bg-[#0b0b0b]">
              {visibleTabs.map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                const count = counts[item.key];
                return (
                  <button
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                      active
                        ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                    key={item.key}
                    onClick={() => goToTab(item.key)}
                    type="button"
                  >
                    <Icon size={13} /> {item.label}
                    {typeof count === "number" && count > 0 ? (
                      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {tab === "overview" ? (
            <div className="space-y-4">
              <BoardsOverviewPanel />
              <TodosPanel defaultScope="mine" />
            </div>
          ) : null}
          {tab === "timeline" ? <ActivityTimelinePanel /> : null}
          {tab === "my-boards" ? <MyBoardsPanel /> : null}
          {tab === "my-tasks" ? <MyTasksPanel /> : null}
          {tab === "my-todos" ? <TodosPanel defaultScope="mine" /> : null}
          {tab === "resume" ? <ResumeWorkspacePanel /> : null}
          {tab === "compactions" ? <CompactionsPanel defaultScope="mine" focusId={compactionFocus} /> : null}
          {tab === "delegated-work" ? <DelegatedWorkPanel defaultScope="incoming" /> : null}
          {tab === "team-compactions" ? <TeamCompactionsPanel defaultScope="owned" focusId={teamCompactionFocus} /> : null}
          {tab === "task-history" ? <TaskHistoryPanel defaultTodoId={todoFocus} /> : null}
        </main>
      </div>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pb-8 text-[11px] text-slate-400 dark:text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <GitBranch size={11} /> Carry-forward keeps the original assigned date and history.
        </span>
        <button
          className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          onClick={() => router.refresh()}
          type="button"
        >
          <RefreshCw size={11} /> Refresh workspace
        </button>
      </footer>
    </div>
  );
}
