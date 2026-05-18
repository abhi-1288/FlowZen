"use client";

import { CSSProperties } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useBoardStore } from "@/store/board-store";
import { TaskCard } from "@/components/boards/task-card";
import type { Column, Task } from "@/lib/types";
import { cn } from "@/lib/client-utils";

export function ColumnPanel({ boardId, column, tasks, canEdit }: { boardId: string; column: Column; tasks: Task[]; canEdit: boolean }) {
  const { setModal, deleteColumn } = useBoardStore();
  const isExpiredColumn = column.title.toLowerCase() === "expired-due";
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: "column", columnId: column.id }
  });
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: `column-drag-${column.id}`,
    data: { type: "column", columnId: column.id }
  });

  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <section
      className={cn(
        "flex max-h-full w-72 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-100/80",
        isDragging && "opacity-40",
        isOver && "ring-2 ring-emerald-400"
      )}
      ref={setDroppableRef}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2" ref={setDraggableRef} style={style}>
          {canEdit ? (
            <button
              aria-label="Drag column"
              className="cursor-grab rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
              type="button"
              {...listeners}
              {...attributes}
            >
              <GripVertical size={16} />
            </button>
          ) : (
            <span className="rounded-md p-1 text-slate-300">
              <GripVertical size={16} />
            </span>
          )}
          <h3 className="truncate text-sm font-semibold text-slate-800">{column.title}</h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{tasks.length}</span>
        </div>
        {canEdit ? (
          <button
            aria-label="Delete column"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
            onClick={() => deleteColumn(boardId, column.id)}
            type="button"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </header>

      <div className="task-scrollbar min-h-24 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} canEdit={canEdit} />
        ))}
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-500">
            Drop tasks here
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200 p-3">
        {isExpiredColumn ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700">
            Auto-managed by due date
          </p>
        ) : canEdit ? (
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:text-slate-950"
            onClick={() => setModal({ type: "task", columnId: column.id })}
            type="button"
          >
            <Plus size={16} />
            Add task
          </button>
        ) : null}
      </div>
    </section>
  );
}
