"use client";

import { CSSProperties } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { Calendar, GripVertical, Lock } from "lucide-react";
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
}: {
  task: Task;
  overlay?: boolean;
  canEdit?: boolean;
}) {
  const { data: session } = useSession();
  const { activeBoard, columns, setModal } = useBoardStore();
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
  const isLocked = task.takenBy && task.takenBy !== session?.user?.id && !isOwner;

  return (
    <article
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md",
        isDoneColumn && "border-emerald-500 ring-1 ring-emerald-200",
        isDueSoon && !isDoneColumn && "animate-pulse border-amber-300",
        isDueToday && !isDoneColumn && "border-rose-500 ring-1 ring-rose-200",
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
          <h4 className="break-words text-sm font-semibold leading-5 text-slate-900">
            {task.title}
          </h4>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
              {task.description}
            </p>
          ) : null}
        </button>
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
