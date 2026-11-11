"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/client-utils";
import type { Board } from "@/lib/types";

export function BoardListItem({
  board,
  active,
  canManage,
  onSelect,
  onTogglePin,
  onEdit,
  onMembers,
  onDelete,
}: {
  board: Board;
  active: boolean;
  canManage: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onMembers: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

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
    const menuHeight = canManage ? 190 : 52;
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

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg pr-1 transition",
        active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
      )}
    >
      <button
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
          !active && "hover:text-slate-950"
        )}
        onClick={onSelect}
        type="button"
      >
        {board.pinned ? (
          <Pin className={cn("shrink-0", active ? "text-amber-300" : "text-amber-500")} size={12} />
        ) : null}
        <span className="truncate">{board.title}</span>
      </button>
      <div className="relative shrink-0" ref={menuRef}>
        <button
          aria-label={`Actions for ${board.title}`}
          className={cn(
            "rounded-md p-1.5 transition",
            active
              ? "text-white/70 hover:bg-white/10 hover:text-white"
              : "text-slate-400 hover:bg-white hover:text-slate-700"
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
            {canManage ? (
              <>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => run(onTogglePin)}
                  type="button"
                >
                  {board.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                  {board.pinned ? "Unpin board" : "Pin board"}
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => run(onEdit)}
                  type="button"
                >
                  <Pencil size={15} />
                  Edit board
                </button>
              </>
            ) : null}
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => run(onMembers)}
              type="button"
            >
              <Users size={15} />
              View members
            </button>
            {canManage ? (
              <>
                <div className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  onClick={() => run(onDelete)}
                  type="button"
                >
                  <Trash2 size={15} />
                  Delete board
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
