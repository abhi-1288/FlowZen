"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LogOut, Plus, Search } from "lucide-react";
import { useBoardStore } from "@/store/board-store";
import { BoardCanvas } from "@/components/boards/board-canvas";
import { AssignModal, BoardModal, BoardEditModal, ColumnModal, InviteModal, TaskModal } from "@/components/boards/modals";
import { apiFetch } from "@/lib/client-utils";

type NotificationPreview = {
  readAt?: string | null;
};

export function BoardShell({ boardId }: { boardId?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const boards = useBoardStore((state) => state.boards);
  const activeBoard = useBoardStore((state) => state.activeBoard);
  const loading = useBoardStore((state) => state.loading);
  const error = useBoardStore((state) => state.error);
  const modal = useBoardStore((state) => state.modal);
  const fetchBoards = useBoardStore((state) => state.fetchBoards);
  const fetchBoard = useBoardStore((state) => state.fetchBoard);
  const createBoard = useBoardStore((state) => state.createBoard);
  const setModal = useBoardStore((state) => state.setModal);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [filter, setFilter] = useState<"all" | "self" | "assigned" | "invited">("all");

  const filteredBoards = useMemo(() => {
    return boards.filter((board) => {
      if (filter === "all") return true;
      const isOwner = board.owner === session?.user?.id;
      if (filter === "self") return isOwner;

      const memberInfo = (board.members as any[]).find((m) => {
        const mUserId = typeof m.user === "string" ? m.user : m.user?.id || m.user?._id;
        return mUserId === session?.user?.id;
      });

      const isAssignedMember = Boolean(memberInfo?.assignedTo) || ["manager", "tester"].includes(String(memberInfo?.role));
      if (filter === "assigned") return !isOwner && isAssignedMember;
      if (filter === "invited") return !isOwner && !isAssignedMember;
      return true;
    });
  }, [boards, filter, session?.user?.id]);

  useEffect(() => {
    void fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (boardId) {
      void fetchBoard(boardId);
    }
  }, [boardId, fetchBoard]);

  useEffect(() => {
    async function fetchNotificationCount() {
      const result = await apiFetch<{ notifications: NotificationPreview[] }>("/api/notifications").catch(() => null);
      setUnreadNotifications(result?.notifications.filter((item) => !item.readAt).length ?? 0);
    }

    void fetchNotificationCount();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let eventSource: EventSource | null = null;
    let mounted = true;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/events", { withCredentials: true });

        eventSource.addEventListener("board:update", (event: any) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(event.data);
            const boardIdFromEvent = typeof data === "string" ? data : data?.id || data?.boardId;
            console.log("SSE: board:update received", boardIdFromEvent);
            void fetchBoards(true);
            if (boardIdFromEvent === boardId) void fetchBoard(boardIdFromEvent, true);
          } catch (err) {
            console.error("SSE: failed to parse board:update", err);
          }
        });

        eventSource.addEventListener("notification:new", () => {
          if (!mounted) return;
          console.log("SSE: notification:new received");
          void fetchBoards(true);
          const refreshCount = async () => {
            const result = await apiFetch<{ notifications: NotificationPreview[] }>("/api/notifications").catch(() => null);
            setUnreadNotifications(result?.notifications.filter((item) => !item.readAt).length ?? 0);
          };
          void refreshCount();
        });

        eventSource.onerror = () => {
          if (mounted) {
            eventSource?.close();
            // Reconnect after 3 seconds on error
            setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error("SSE connection failed:", err);
      }
    };

    connect();
    return () => {
      mounted = false;
      eventSource?.close();
    };
  }, [session?.user?.id, boardId, fetchBoard, fetchBoards]);

  useEffect(() => {
    if (!boardId && boards.length > 0) {
      router.replace(`/board/${boards[0].id}`);
    }
  }, [boardId, boards, router]);

  async function quickCreateBoard() {
    const board = await createBoard("New board");
    router.push(`/board/${board.id}`);
  }

  const FilterBtn = ({ type, label }: { type: typeof filter; label: string }) => (
    <button
      className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${filter === type ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        }`}
      onClick={() => setFilter(type)}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#f7f8fb] text-slate-950">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="relative h-8 w-8 overflow-hidden rounded-lg shadow-sm shadow-indigo-500/20">
                  <Image src="/Logos/logo.jpg" alt="FlowZen Logo" fill className="object-cover" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">FlowZen</h1>
              </div>
              <p className="mt-1 text-sm text-slate-500 capitalize">{session?.user?.name} &bull; {session?.user?.role}</p>
              <p className="mt-1 text-sm text-slate-500">
                {session?.user?.company ? session?.user?.company : 'Unemployed'}
                <span className="mx-1">•</span>
                {session?.user?.team ? `${session.user.team}` : 'No Team'}
              </p>
            </div>
            <button
              aria-label="Sign out"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              onClick={() => signOut({ callbackUrl: "/login" })}
              type="button"
            >
              <LogOut size={18} />
            </button>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">
            <Search size={16} />
            <span>Search boards</span>
          </div>
          <Link className="mt-3 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950" href="/profile">
            Profile center{unreadNotifications ? ` (${unreadNotifications})` : ""}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Boards: ({filteredBoards.length})</span>
            <button
              aria-label="Create board"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              onClick={() => setModal({ type: "board" })}
              type="button"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="mb-4 flex flex-wrap gap-1 px-2">
            <FilterBtn label="All" type="all" />
            <FilterBtn label="Self" type="self" />
            <FilterBtn label="Assigned" type="assigned" />
            <FilterBtn label="Invite" type="invited" />
          </div>
          <div className="space-y-1">
            {loading && boards.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={`board-skel-${i}`} className="h-9 w-full animate-pulse rounded-lg bg-slate-200" />
              ))
            ) : (
              filteredBoards.map((board) => (
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${board.id === boardId ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  key={board.id}
                  onClick={() => router.push(`/board/${board.id}`)}
                  type="button"
                >
                  {board.title}
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {!boardId && boards.length === 0 && !loading ? (
          <div className="grid h-screen place-items-center px-4">
            <div className="max-w-md text-center">
              <h2 className="text-2xl font-semibold">Create your first board</h2>
              <p className="mt-2 text-slate-500">Start with Todo, In Progress, and Done columns, then customize from there.</p>
              <button
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white hover:bg-slate-800"
                onClick={quickCreateBoard}
                type="button"
              >
                <Plus size={18} />
                New board
              </button>
            </div>
          </div>
        ) : null}

        {error ? <div className="m-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {boardId && activeBoard ? <BoardCanvas boardId={boardId} /> : null}
        {loading && !activeBoard ? (
          <div className="flex h-screen flex-col animate-pulse bg-[#f7f8fb]">
            <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="h-8 w-48 rounded-lg bg-slate-200" />
                    <div className="h-6 w-24 rounded-full bg-slate-200" />
                  </div>
                  <div className="mt-2 h-4 w-96 rounded bg-slate-200" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-24 rounded-lg bg-slate-200" />
                  <div className="h-9 w-24 rounded-lg bg-slate-200" />
                </div>
              </div>
            </header>
            <div className="flex flex-1 gap-4 overflow-x-hidden p-4 sm:p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`col-skel-${i}`} className="w-72 shrink-0 space-y-3 rounded-xl bg-slate-100 p-3">
                  <div className="h-6 w-32 rounded bg-slate-200" />
                  <div className="h-24 w-full rounded-lg bg-slate-200" />
                  <div className="h-32 w-full rounded-lg bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>

      {modal?.type === "board" ? <BoardModal /> : null}
      {modal?.type === "board-edit" ? <BoardEditModal /> : null}
      {modal?.type === "column" ? <ColumnModal boardId={boardId ?? ""} /> : null}
      {modal?.type === "assign" ? <AssignModal boardId={boardId ?? ""} /> : null}
      {modal?.type === "invite" ? <InviteModal boardId={boardId ?? ""} /> : null}
      {modal?.type === "task" ? <TaskModal boardId={boardId ?? ""} columnId={modal.columnId} taskId={modal.taskId} /> : null}
    </div>
  );
}
