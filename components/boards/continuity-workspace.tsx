"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  GitBranch,
  History,
  Layers,
  LayoutDashboard,
  ListChecks,
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

type WorkspaceTab =
  | "overview"
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
  const rawTab = searchParams?.get("tab") ?? "";
  const tab: WorkspaceTab = TAB_KEYS.has(rawTab) ? (rawTab as WorkspaceTab) : "overview";
  const todoFocus = searchParams?.get("todo") ?? "";
  const compactionFocus = searchParams?.get("focus") ?? "";
  const teamCompactionFocus = searchParams?.get("teamCompaction") ?? "";

  const goToTab = useCallback(
    (next: WorkspaceTab) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", next);
      params.delete("todo");
      params.delete("focus");
      params.delete("teamCompaction");
      router.push(`/boards?${params.toString()}`);
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

        <div className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2">
          <nav className="flex items-center gap-1">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
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
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {tab === "overview" ? (
          <div className="space-y-4">
            <BoardsOverviewPanel />
            <TodosPanel defaultScope="mine" />
          </div>
        ) : null}
        {tab === "my-boards" ? <MyBoardsPanel /> : null}
        {tab === "my-tasks" ? <MyTasksPanel /> : null}
        {tab === "my-todos" ? <TodosPanel defaultScope="mine" /> : null}
        {tab === "resume" ? <ResumeWorkspacePanel /> : null}
        {tab === "compactions" ? <CompactionsPanel defaultScope="mine" focusId={compactionFocus} /> : null}
        {tab === "delegated-work" ? <DelegatedWorkPanel defaultScope="incoming" /> : null}
        {tab === "team-compactions" ? <TeamCompactionsPanel defaultScope="owned" focusId={teamCompactionFocus} /> : null}
        {tab === "task-history" ? <TaskHistoryPanel defaultTodoId={todoFocus} /> : null}
      </main>

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
