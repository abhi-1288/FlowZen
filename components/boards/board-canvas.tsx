"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { CalendarDays, GitBranch, MoreHorizontal, Plus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBoardStore, reorder } from "@/store/board-store";
import { ColumnPanel } from "@/components/boards/column-panel";
import { TaskCard } from "@/components/boards/task-card";
import type { Column, Task } from "@/lib/types";

type DragData =
  | { type: "column"; columnId: string }
  | { type: "task"; taskId: string; columnId: string };

export function BoardCanvas({ boardId }: { boardId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const activeBoard = useBoardStore((state) => state.activeBoard);
  const columns = useBoardStore((state) => state.columns);
  const tasks = useBoardStore((state) => state.tasks);
  const loading = useBoardStore((state) => state.loading);
  const setModal = useBoardStore((state) => state.setModal);
  const reorderColumns = useBoardStore((state) => state.reorderColumns);
  const moveTaskLocal = useBoardStore((state) => state.moveTaskLocal);
  const persistTaskMove = useBoardStore((state) => state.persistTaskMove);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const currentMember = activeBoard?.members?.find((member: any) => {
    const memberUser = member.user as any;
    const memberId = typeof memberUser === "string" ? memberUser : memberUser?.id || memberUser?._id;
    return memberId === session?.user?.id;
  }) as any;
  const isOwner = Boolean(session?.user?.id && activeBoard?.owner === session.user.id);
  const isAdminOwner = isOwner && session?.user?.role === "admin";
  const canAssignProject = Boolean(currentMember) && !isOwner;
  const memberStatus = isOwner
    ? "self"
    : currentMember?.assignedTo || ["manager", "tester"].includes(String(currentMember?.role))
      ? "assigned"
      : "invited";
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } })
  );

  const orderedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns]);


  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (data?.type === "column") {
      setActiveColumn(columns.find((column) => column.id === data.columnId) ?? null);
    }
    if (data?.type === "task") {
      setActiveTask(tasks.find((task) => task.id === data.taskId) ?? null);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as DragData | undefined;
    const overData = event.over?.data.current as DragData | undefined;
    setActiveColumn(null);
    setActiveTask(null);
    if (!activeData || !overData) return;

    if (activeData.type === "column" && overData.type === "column" && activeData.columnId !== overData.columnId) {
      if (!isOwner) return;
      const from = orderedColumns.findIndex((column) => column.id === activeData.columnId);
      const to = orderedColumns.findIndex((column) => column.id === overData.columnId);
      if (from >= 0 && to >= 0) {
        await reorderColumns(boardId, reorder(orderedColumns, from, to));
      }
      return;
    }

    if (activeData.type === "task") {
      const toColumnId = overData.type === "task" ? overData.columnId : overData.columnId;
      const overTaskId = overData.type === "task" ? overData.taskId : undefined;
      const move = moveTaskLocal(activeData.taskId, toColumnId, overTaskId);
      if (move) {
        await persistTaskMove(boardId, activeData.taskId, toColumnId, move.orderedTaskIds);
      }
    }
  }

  async function deleteCurrentBoard() {
    if (deleteConfirmText !== "DELETE") return;
    await useBoardStore.getState().deleteBoard(boardId);
    setShowDeleteModal(false);
    setDeleteConfirmText("");
    const remainingBoards = useBoardStore.getState().boards;
    if (remainingBoards.length > 0) router.push(`/board/${remainingBoards[0].id}`);
    else router.push("/board");
  }

  return (
    <section className="flex h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-normal">{activeBoard?.title ?? "Board"}</h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {orderedColumns.length} columns
              </span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {memberStatus}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              {activeBoard?.description || "Organize work by priority, due date, and status."}
            </p>
            {activeBoard?.attachments?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {activeBoard.attachments.map((a) => (
                  <a
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                    href={a.url}
                    key={a.id}
                    target="_blank"
                  >
                    <span className="truncate max-w-[150px]">{a.name}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner ? (
              <>
                {isAdminOwner ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setModal({ type: "assign" })}
                    type="button"
                  >
                    <GitBranch size={16} />
                    Assign
                  </button>
                ) : null}
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setModal({ type: "invite" })}
                  type="button"
                >
                  <UserPlus size={16} />
                  Invite
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setModal({ type: "column" })}
                  type="button"
                >
                  <Plus size={16} />
                  Column
                </button>
                <div className="relative">
                  <button
                    aria-label="Board actions"
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                    onClick={() => setShowBoardMenu((prev) => !prev)}
                    type="button"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {showBoardMenu ? (
                    <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-soft">
                      <button
                        className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setShowBoardMenu(false);
                          setModal({ type: "board-edit" });
                        }}
                        type="button"
                      >
                        Edit board
                      </button>
                      <button
                        className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          setShowBoardMenu(false);
                          setShowDeleteModal(true);
                        }}
                        type="button"
                      >
                        Delete board
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : canAssignProject ? (
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setModal({ type: "assign" })}
                type="button"
              >
                <GitBranch size={16} />
                Assign
              </button>
            ) : !isOwner ? (
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setModal({ type: "invite" })}
                type="button"
              >
                <UserPlus size={16} />
                Members
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 sm:px-6">
        <CalendarDays size={14} />
        <span>{loading ? "Syncing..." : `${tasks.length} tasks tracked`}</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="task-scrollbar flex flex-1 gap-4 overflow-x-auto p-4 sm:p-6">
          {orderedColumns.map((column) => (
            <ColumnPanel
              boardId={boardId}
              canEdit={isOwner}
              column={column}
              key={column.id}
              tasks={tasks.filter((task) => task.column === column.id).sort((a, b) => a.order - b.order)}
            />
          ))}
          {isOwner ? (
            <button
              className="h-12 w-72 shrink-0 rounded-lg border border-dashed border-slate-300 bg-white/70 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-800"
              onClick={() => setModal({ type: "column" })}
              type="button"
            >
              Add column
            </button>
          ) : null}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} overlay canEdit={isOwner} /> : null}
          {activeColumn ? (
            <div className="w-72 rounded-lg border border-slate-200 bg-slate-100 p-3 shadow-soft">
              <div className="font-semibold text-slate-800">{activeColumn.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {showDeleteModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete board?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This action cannot be undone.
              <br />
              Type <span className="font-semibold text-rose-600">DELETE</span> to confirm.
            </p>
            <input
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5"
              placeholder="Type DELETE"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deleteConfirmText !== "DELETE"}
                onClick={() => void deleteCurrentBoard()}
                type="button"
              >
                Delete board
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
