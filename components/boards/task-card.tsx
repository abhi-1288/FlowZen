"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  Clock3,
  GripVertical,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/client-utils";
import { useBoardStore } from "@/store/board-store";
import type { Task } from "@/lib/types";

const priorityStyles = {
  low: "bg-sky-50 text-sky-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-rose-50 text-rose-700",
};

export function TaskCard({
  task,
  overlay = false,
  canEdit = true,
  canReview = false,
}: {
  task: Task;
  overlay?: boolean;
  canEdit?: boolean;
  canReview?: boolean;
}) {
  const { data: session } = useSession();
  const { activeBoard, columns, setModal, updateTask, reviewTask } = useBoardStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `task-drop-${task.id}`,
    data: { type: "task", taskId: task.id, columnId: task.column },
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `task-drag-${task.id}`,
    data: { type: "task", taskId: task.id, columnId: task.column },
  });

  const style: CSSProperties | undefined =
    transform && !overlay
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : undefined;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = task.dueDate ? new Date(task.dueDate) : null;
  if (due) due.setHours(0, 0, 0, 0);
  const diffDays = due
    ? Math.ceil((due.getTime() - now.getTime()) / 86400000)
    : null;
  const isDueToday = diffDays === 0;
  const isDueSoon = diffDays !== null && diffDays > 0 && diffDays <= 5;
  const totalSubTasks = Array.isArray(task.subTasks) ? task.subTasks.length : 0;
  const doneSubTasks = Array.isArray(task.subTasks)
    ? task.subTasks.filter((item) => item.done).length
    : 0;

  const currentColumn = columns.find((col) => col.id === task.column);
  const isDoneColumn = currentColumn?.title?.toLowerCase() === "done";
  const ownershipChips = [
    task.takenLeadName,
    task.takenTeamName,
    task.takenByName,
  ].filter(Boolean);

  const isOwner = Boolean(session?.user?.id && activeBoard?.owner === session.user.id);
  const isPending = task.approvalStatus === "pending";
  const isRejected = task.approvalStatus === "rejected";
  const isCreator = Boolean(session?.user?.id && task.createdBy === session.user.id);
  const canDelete = isOwner || isCreator;
  const isLocked =
    Boolean(task.takenBy && task.takenBy !== session?.user?.id && !isOwner) ||
    (isPending && !canReview);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const handleViewportChange = () => setMenuOpen(false);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [menuOpen]);

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 192;
    const menuHeight = 196;
    const top =
      rect.bottom + menuHeight > window.innerHeight
        ? Math.max(8, rect.top - menuHeight - 4)
        : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );
    setMenuPosition({ top, left });
    setMenuOpen(true);
  }

  function openEdit() {
    setMenuOpen(false);
    if (isLocked) return;
    setModal({ type: "task", columnId: task.column, taskId: task.id });
  }

  function openWorkingMembers() {
    setMenuOpen(false);
    setModal({ type: "task-members", columnId: task.column, taskId: task.id });
  }

  function openDelete() {
    setMenuOpen(false);
    setModal({ type: "task-delete", columnId: task.column, taskId: task.id });
  }

  function togglePin() {
    setMenuOpen(false);
    if (!activeBoard || isLocked) return;
    void updateTask(activeBoard.id, task.id, { pinned: !task.pinned }).catch(() => {});
  }

  function review(status: "approved" | "rejected") {
    setMenuOpen(false);
    if (!activeBoard || !canReview) return;
    void reviewTask(activeBoard.id, task.id, status).catch(() => {});
  }

  return (
    <article
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-[#000000]",
        isDoneColumn && "border-emerald-500 ring-1 ring-emerald-200",
        isDueSoon && !isDoneColumn && "animate-pulse border-amber-300",
        isDueToday && !isDoneColumn && "border-rose-500 ring-1 ring-rose-200",
        task.pinned && "border-amber-400 ring-1 ring-amber-200",
        isDragging && "opacity-40",
        isOver && "ring-2 ring-emerald-300",
        overlay && "w-72 shadow-soft",
        isLocked && "opacity-75 grayscale-[0.5]"
      )}
      ref={setDroppableRef}
      style={style}
    >
      <div className="flex items-start gap-2">
        <button
          aria-label={isLocked ? "Task is locked" : "Drag task"}
          className={cn(
            "mt-0.5 rounded-md p-1 text-slate-300 transition",
            isLocked ? "cursor-not-allowed opacity-50" : "cursor-grab hover:bg-slate-100 hover:text-slate-600"
          )}
          ref={isLocked ? null : setDraggableRef}
          type="button"
          {...(isLocked ? {} : { ...listeners, ...attributes })}
        >
          {isLocked ? <Lock size={15} /> : <GripVertical size={15} />}
        </button>
        <button
          className={cn("min-w-0 flex-1 text-left", isLocked && "cursor-default")}
          onClick={() => {
            if (!isLocked) setModal({ type: "task", columnId: task.column, taskId: task.id });
          }}
          type="button"
        >
          <h4 className="flex items-center gap-1.5 break-words text-sm font-semibold leading-5 text-slate-900 dark:text-zinc-100">
            {task.pinned ? <Pin className="shrink-0 text-amber-500" size={13} /> : null}
            <span className="min-w-0 break-words">{task.title}</span>
          </h4>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              {task.description}
            </p>
          ) : null}
        </button>
        {!overlay ? (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              aria-label="Task actions"
              className={cn(
                "rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
                menuOpen && "bg-slate-100 text-slate-700"
              )}
              onClick={toggleMenu}
              ref={menuButtonRef}
              type="button"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && menuPosition ? (
              <div
                className="fixed z-[60] w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-soft dark:border-zinc-700 dark:bg-zinc-900"
                style={{ top: menuPosition.top, left: menuPosition.left }}
              >
                {isPending && canReview ? (
                  <>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                      onClick={() => review("approved")}
                      type="button"
                    >
                      <Check size={15} />
                      Approve task
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => review("rejected")}
                      type="button"
                    >
                      <X size={15} />
                      Reject task
                    </button>
                    <div className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />
                  </>
                ) : null}
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  disabled={Boolean(isLocked)}
                  onClick={togglePin}
                  type="button"
                >
                  {task.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                  {task.pinned ? "Unpin task" : "Pin task"}
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  disabled={Boolean(isLocked)}
                  onClick={openEdit}
                  type="button"
                >
                  <Pencil size={15} />
                  Edit task
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={openWorkingMembers}
                  type="button"
                >
                  <Users size={15} />
                  Working members
                </button>
                {canDelete ? (
                  <>
                    <div className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={openDelete}
                      type="button"
                    >
                      <Trash2 size={15} />
                      Delete task
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {ownershipChips.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.takenByName && (
            <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {task.takenByName}
            </span>
          )}
          {task.takenLeadName && (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
              Lead: {task.takenLeadName}
            </span>
          )}
          {task.takenTeamName && (
            <span className="rounded-full bg-[var(--color-primary-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--color-primary-dark)]">
              Team: {task.takenTeamName}
            </span>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isPending ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
            <Clock3 size={12} />
            Pending approval
          </span>
        ) : null}
        {isRejected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
            <X size={12} />
            Rejected
          </span>
        ) : null}
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium capitalize",
            priorityStyles[task.priority],
          )}
        >
          {task.priority}
        </span>
        {task.dueDate ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            <Calendar size={12} />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        ) : null}
        {totalSubTasks > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
            {doneSubTasks}/{totalSubTasks} sub-tasks
          </span>
        ) : null}
      </div>
    </article>
  );
}
