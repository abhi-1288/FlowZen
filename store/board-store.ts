"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/client-utils";
import type { Board, BoardPayload, Column, Priority, Task } from "@/lib/types";

type ModalState =
  | { type: "task"; columnId: string; taskId?: string }
  | { type: "column" }
  | { type: "board" }
  | { type: "board-edit" }
  | { type: "assign" }
  | { type: "invite" }
  | null;

type BoardStore = {
  boards: Board[];
  activeBoard: Board | null;
  columns: Column[];
  tasks: Task[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  modal: ModalState;
  setModal: (modal: ModalState) => void;
  setError: (error: string | null) => void;
  fetchBoards: (silent?: boolean) => Promise<void>;
  fetchBoard: (boardId: string, silent?: boolean) => Promise<void>;
  createBoard: (title: string, description?: string) => Promise<Board>;
  updateBoard: (boardId: string, updates: Partial<Pick<Board, "title" | "description" | "attachments">>) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  inviteUser: (boardId: string, email: string, role: string) => Promise<void>;
  assignMember: (boardId: string, memberId?: string, leadId?: string, teamId?: string) => Promise<void>;
  unassignTeam: (boardId: string, teamId: string) => Promise<void>;
  removeMember: (boardId: string, memberId: string) => Promise<void>;
  createColumn: (boardId: string, title: string) => Promise<void>;
  updateColumn: (columnId: string, title: string) => Promise<void>;
  deleteColumn: (boardId: string, columnId: string) => Promise<void>;
  reorderColumns: (boardId: string, columns: Column[]) => Promise<void>;
  createTask: (boardId: string, payload: TaskInput) => Promise<void>;
  updateTask: (boardId: string, taskId: string, payload: Partial<TaskInput>) => Promise<void>;
  deleteTask: (boardId: string, taskId: string) => Promise<void>;
  addComment: (boardId: string, taskId: string, body: string) => Promise<void>;
  addAttachment: (boardId: string, taskId: string, name: string, url: string, id?: string) => Promise<void>;
  removeAttachment: (boardId: string, taskId: string, attachmentId: string) => Promise<void>;
  moveTaskLocal: (taskId: string, toColumnId: string, overTaskId?: string) => { orderedTaskIds: string[] } | null;
  persistTaskMove: (boardId: string, taskId: string, toColumnId: string, orderedTaskIds: string[]) => Promise<void>;
};

export type TaskInput = {
  column: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: Priority;
  assignees?: string[];
  subTasks?: { id: string; title: string; done: boolean }[];
};

function reorder<T>(items: T[], fromIndex: number, toIndex: number) {
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  boards: [],
  activeBoard: null,
  columns: [],
  tasks: [],
  loading: false,
  saving: false,
  error: null,
  modal: null,
  setModal: (modal) => set({ modal }),
  setError: (error) => set({ error }),
  fetchBoards: async (silent = false) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const { boards } = await apiFetch<{ boards: Board[] }>("/api/boards");
      set({ boards });
    } catch (error) {
      if (!silent) set({ error: error instanceof Error ? error.message : "Failed to load boards." });
    } finally {
      if (!silent) set({ loading: false });
    }
  },
  fetchBoard: async (boardId, silent = false) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const payload = await apiFetch<BoardPayload>(`/api/boards/${boardId}`);
      set({ activeBoard: payload.board, columns: payload.columns, tasks: payload.tasks });
    } catch (error) {
      if (!silent) set({ error: error instanceof Error ? error.message : "Failed to load board." });
    } finally {
      if (!silent) set({ loading: false });
    }
  },
  createBoard: async (title, description = "") => {
    set({ saving: true, error: null });
    try {
      const { board } = await apiFetch<{ board: Board }>("/api/boards", {
        method: "POST",
        body: JSON.stringify({ title, description })
      });
      set((state) => ({ boards: [board, ...state.boards] }));
      return board;
    } finally {
      set({ saving: false });
    }
  },
  updateBoard: async (boardId, updates) => {
    const { board } = await apiFetch<{ board: Board }>(`/api/boards/${boardId}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
    set((state) => ({
      boards: state.boards.map((item) => (item.id === board.id ? board : item)),
      activeBoard: state.activeBoard?.id === board.id ? board : state.activeBoard
    }));
  },
  deleteBoard: async (boardId) => {
    await apiFetch<{ ok: true }>(`/api/boards/${boardId}`, { method: "DELETE" });
    set((state) => ({
      boards: state.boards.filter((board) => board.id !== boardId),
      activeBoard: state.activeBoard?.id === boardId ? null : state.activeBoard
    }));
  },
  inviteUser: async (boardId, email, role) => {
    const { board } = await apiFetch<{ board: Board }>(`/api/boards/${boardId}/invite`, {
      method: "POST",
      body: JSON.stringify({ email, role })
    });
    set({ activeBoard: board });
  },
  assignMember: async (boardId, memberId, leadId, teamId) => {
    const { board } = await apiFetch<{ board: Board }>(`/api/boards/${boardId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ memberId, leadId, teamId })
    });
    set({ activeBoard: board });
  },
  unassignTeam: async (boardId, teamId) => {
    const { board } = await apiFetch<{ board: Board }>(`/api/boards/${boardId}/assign`, {
      method: "DELETE",
      body: JSON.stringify({ teamId })
    });
    set({ activeBoard: board });
  },
  removeMember: async (boardId, memberId) => {
    const { board, removedSelf } = await apiFetch<{ board: Board; removedSelf?: boolean }>(`/api/boards/${boardId}/invite`, {
      method: "DELETE",
      body: JSON.stringify({ memberId })
    });
    if (removedSelf) {
      set((state) => ({
        boards: state.boards.filter((item) => item.id !== boardId),
        activeBoard: state.activeBoard?.id === boardId ? null : state.activeBoard,
        columns: state.activeBoard?.id === boardId ? [] : state.columns,
        tasks: state.activeBoard?.id === boardId ? [] : state.tasks
      }));
      return;
    }
    set({ activeBoard: board });
  },
  createColumn: async (boardId, title) => {
    const { column } = await apiFetch<{ column: Column }>(`/api/boards/${boardId}/columns`, {
      method: "POST",
      body: JSON.stringify({ title })
    });
    set((state) => ({ columns: [...state.columns, column].sort((a, b) => a.order - b.order) }));
  },
  updateColumn: async (columnId, title) => {
    const boardId = get().activeBoard?.id;
    if (!boardId) return;
    const { column } = await apiFetch<{ column: Column }>(`/api/boards/${boardId}/columns/${columnId}`, {
      method: "PATCH",
      body: JSON.stringify({ title })
    });
    set((state) => ({
      columns: state.columns.map((item) => (item.id === column.id ? column : item))
    }));
  },
  deleteColumn: async (boardId, columnId) => {
    await apiFetch<{ ok: true }>(`/api/boards/${boardId}/columns?columnId=${columnId}`, { method: "DELETE" });
    set((state) => ({
      columns: state.columns.filter((column) => column.id !== columnId),
      tasks: state.tasks.filter((task) => task.column !== columnId)
    }));
  },
  reorderColumns: async (boardId, columns) => {
    const ordered = columns.map((column, order) => ({ ...column, order }));
    set({ columns: ordered });
    await apiFetch<{ columns: Column[] }>(`/api/boards/${boardId}/columns`, {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: ordered.map((column) => column.id) })
    });
  },
  createTask: async (boardId, payload) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/boards/${boardId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    set((state) => ({ tasks: [...state.tasks, task].sort((a, b) => a.order - b.order) }));
  },
  updateTask: async (boardId, taskId, payload) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/boards/${boardId}/tasks`, {
      method: "PATCH",
      body: JSON.stringify({ id: taskId, ...payload })
    });
    set((state) => ({ tasks: state.tasks.map((item) => (item.id === task.id ? task : item)) }));
  },
  deleteTask: async (boardId, taskId) => {
    await apiFetch<{ ok: true }>(`/api/boards/${boardId}/tasks?taskId=${taskId}`, { method: "DELETE" });
    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== taskId) }));
  },
  addComment: async (boardId, taskId, body) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/boards/${boardId}/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
    set((state) => ({ tasks: state.tasks.map((item) => (item.id === task.id ? task : item)) }));
  },
  addAttachment: async (boardId, taskId, name, url, id) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/boards/${boardId}/tasks/${taskId}/attachments`, {
      method: "POST",
      body: JSON.stringify({ name, url, id })
    });
    set((state) => ({ tasks: state.tasks.map((item) => (item.id === task.id ? task : item)) }));
  },
  removeAttachment: async (boardId, taskId, attachmentId) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/boards/${boardId}/tasks/${taskId}/attachments`, {
      method: "DELETE",
      body: JSON.stringify({ attachmentId })
    });
    set((state) => ({ tasks: state.tasks.map((item) => (item.id === task.id ? task : item)) }));
  },
  moveTaskLocal: (taskId, toColumnId, overTaskId) => {
    const { tasks } = get();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return null;

    const sourceColumnId = task.column;
    const targetTasks = tasks
      .filter((item) => item.column === toColumnId && item.id !== taskId)
      .sort((a, b) => a.order - b.order);

    const nextTask = { ...task, column: toColumnId };
    const overIndex = overTaskId ? targetTasks.findIndex((item) => item.id === overTaskId) : -1;
    const insertIndex = overIndex >= 0 ? overIndex : targetTasks.length;
    targetTasks.splice(insertIndex, 0, nextTask);

    const sourceTasks = sourceColumnId === toColumnId
      ? targetTasks
      : tasks.filter((item) => item.column === sourceColumnId && item.id !== taskId).sort((a, b) => a.order - b.order);

    const renumberedSource = sourceTasks.map((item, order) => ({ ...item, order }));
    const renumberedTarget = targetTasks.map((item, order) => ({ ...item, order }));
    const untouched = tasks.filter((item) => item.column !== sourceColumnId && item.column !== toColumnId);
    const merged = sourceColumnId === toColumnId ? [...untouched, ...renumberedTarget] : [...untouched, ...renumberedSource, ...renumberedTarget];

    set({ tasks: merged });
    return { orderedTaskIds: renumberedTarget.map((item) => item.id) };
  },
  persistTaskMove: async (boardId, taskId, toColumnId, orderedTaskIds) => {
    const { tasks } = await apiFetch<{ tasks: Task[] }>(`/api/boards/${boardId}/tasks/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ taskId, toColumnId, orderedTaskIds })
    });
    set({ tasks });
  }
}));

export { reorder };
