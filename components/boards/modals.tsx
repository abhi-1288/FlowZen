"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckSquare, Clock3, Settings2, Trash2, Users, X } from "lucide-react";
import { Dialog, Field, TextArea, Submit } from "./modal-primitives";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useBoardStore, type TaskInput } from "@/store/board-store";
import type { Priority } from "@/lib/types";
import {
  canManageBoardTasks,
  requiresTaskApproval,
  type EmployeeTaskMode
} from "@/lib/task-permissions";
import { BoardMemberView, memberUserId, assignedLeadId, memberLabel } from "./assign-modal";
export { AssignModal } from "./assign-modal";


export function BoardModal() {
  const router = useRouter();
  const { createBoard, setModal } = useBoardStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const board = await createBoard(title, description);
    setModal(null);
    router.push(`/board/${board.id}`);
  }

  return (
    <Dialog title="New board">
      <form className="space-y-4 p-5" onSubmit={submit}>
        <Field label="Board name" value={title} onChange={setTitle} required />
        <TextArea label="Description" value={description} onChange={setDescription} />
        <Submit label="Create board" />
      </form>
    </Dialog>
  );
}

export function BoardEditModal({ boardId }: { boardId?: string }) {
  const { activeBoard, boards, updateBoard, setModal } = useBoardStore();
  const board = useMemo(
    () => (boardId ? boards.find((item) => item.id === boardId) : activeBoard),
    [activeBoard, boardId, boards]
  );
  const [title, setTitle] = useState(board?.title ?? "");
  const [description, setDescription] = useState(board?.description ?? "");
  const [attachments, setAttachments] = useState(board?.attachments ?? []);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!board) return;
    await updateBoard(board.id, { title, description, attachments });
    setModal(null);
  }

  function addAttachment() {
    if (!attachmentName.trim() || !attachmentUrl.trim()) return;
    setAttachments((prev) => [...prev, { id: crypto.randomUUID(), name: attachmentName.trim(), url: attachmentUrl.trim() }]);
    setAttachmentName("");
    setAttachmentUrl("");
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <Dialog title="Edit board" panelClassName="max-w-2xl" bodyClassName="max-h-[80vh] overflow-y-auto">
      <form className="space-y-4 p-5" onSubmit={submit}>
        <Field label="Board name" value={title} onChange={setTitle} required />
        <TextArea label="Description" value={description} onChange={setDescription} />
        
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Board Context Attachments</p>
          <div className="space-y-1">
            {attachments.map((a) => (
              <div className="flex items-center justify-between gap-2 rounded bg-white p-2 text-sm" key={a.id}>
                <a className="truncate text-emerald-700 hover:underline" href={a.url} target="_blank">{a.name}</a>
                <button className="text-rose-600 hover:text-rose-800" onClick={() => removeAttachment(a.id)} type="button">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {attachments.length === 0 ? <p className="text-xs text-slate-500 italic">No attachments yet.</p> : null}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
              placeholder="Link name"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
            />
            <input
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
              placeholder="URL (image or link)"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm" onClick={addAttachment} type="button">
              Add
            </button>
          </div>
        </div>

        <Submit label="Save changes" />
      </form>
    </Dialog>
  );
}

export function BoardDeleteModal({ boardId }: { boardId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { boards, deleteBoard, setModal } = useBoardStore();
  const board = useMemo(() => boards.find((item) => item.id === boardId), [boards, boardId]);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (confirmText !== "DELETE" || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteBoard(boardId);
      setModal(null);
      if (pathname === `/board/${boardId}`) {
        const remaining = useBoardStore.getState().boards;
        router.push(remaining.length > 0 ? `/board/${remaining[0].id}` : "/board");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete board.");
      setDeleting(false);
    }
  }

  return (
    <Dialog title="Delete board?" panelClassName="max-w-md">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">{board?.title ?? "this board"}</span>?
            </p>
            <p className="mt-1 text-sm text-slate-500">
              All columns, tasks, comments and attachments will be permanently removed. Type{" "}
              <span className="font-semibold text-rose-600">DELETE</span> to confirm.
            </p>
          </div>
        </div>
        <input
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-emerald-500 focus:ring-2"
          placeholder="Type DELETE"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
        />
        {error ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={deleting}
            onClick={() => setModal(null)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={confirmText !== "DELETE" || deleting}
            onClick={() => void confirmDelete()}
            type="button"
          >
            {deleting ? "Deleting..." : "Delete board"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function ColumnModal({ boardId }: { boardId: string }) {
  const { createColumn, setModal } = useBoardStore();
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await createColumn(boardId, title);
    setModal(null);
  }

  return (
    <Dialog title="New column">
      <form className="space-y-4 p-5" onSubmit={submit}>
        <Field label="Column name" value={title} onChange={setTitle} required />
        <Submit label="Create column" />
      </form>
    </Dialog>
  );
}

// Types, helpers and AssignModal moved to ./assign-modal


export function InviteModal({ boardId }: { boardId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { activeBoard, boards, inviteUser, removeMember, setModal } = useBoardStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const currentUserId = session?.user?.id;
  const board = useMemo(
    () => boards.find((item) => item.id === boardId) ?? activeBoard,
    [activeBoard, boardId, boards]
  );
  const isOwner = Boolean(currentUserId && board?.owner === currentUserId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await inviteUser(boardId, email, role);
    setModal(null);
  }

  async function removeBoardMember(memberId: string) {
    await removeMember(boardId, memberId);
    if (!isOwner && memberId === currentUserId) {
      setModal(null);
      router.push("/board");
    }
  }

  return (
    <Dialog title={isOwner ? "Invite collaborator" : "Board members"} bodyClassName="max-h-[85vh] overflow-y-auto">
      {isOwner ? (
        <form className="space-y-4 p-5" onSubmit={submit}>
          <Field label="Email" value={email} onChange={setEmail} type="email" required />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
              <option value="tester">Tester</option>
              <option value="others">Others</option>
            </select>
          </label>
          <Submit label="Send invite" />
        </form>
      ) : null}

      {board?.members?.length ? (
        <div className={`${isOwner ? "border-t" : ""} border-slate-200 p-5`}>
          <p className="mb-3 text-sm font-semibold text-slate-700">Board Members</p>
          <div className="max-h-48 overflow-y-auto space-y-3">
            {(() => {
              const members = (board.members ?? []) as BoardMemberView[];
              const memberEntries = members.map((member) => {
                const { name, email, teamName } = memberLabel(member);
                return {
                  member,
                  id: memberUserId(member),
                  name,
                  email,
                  teamName,
                  role: member.role,
                  assignedTo: assignedLeadId(member),
                };
              });

              const leadEntries = memberEntries.filter((item) => ["admin", "manager", "tester"].includes(item.role));
              const employeeEntries = memberEntries.filter((item) => ["employee", "others"].includes(item.role));
              const leadMap = new Map(leadEntries.map((lead) => [lead.id, lead]));
              const groupedLeads = leadEntries.map((lead) => ({
                lead,
                employees: employeeEntries.filter((employee) => employee.assignedTo === lead.id),
              }));
              const unassignedEmployees = employeeEntries.filter(
                (employee) => !employee.assignedTo || !leadMap.has(employee.assignedTo),
              );
              const showGrouped = groupedLeads.length > 0 || unassignedEmployees.length > 0;

              if (!showGrouped) {
                return memberEntries.map(({ id, name, email, teamName, role }) => {
                  const canRemoveMember = isOwner ? board.owner !== id : Boolean(currentUserId && id === currentUserId);
                  return (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2 text-sm" key={id}>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{name}</p>
                        <p className="truncate text-xs text-slate-500">{email}</p>
                        {teamName ? <p className="text-xs text-slate-400">Team: {teamName}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          {role}
                        </span>
                        {canRemoveMember ? (
                          <button
                            className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                            onClick={() => void removeBoardMember(id)}
                            title={isOwner ? "Remove member" : "Leave board"}
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                });
              }

              return (
                <div className="space-y-3">
                  {groupedLeads.map(({ lead, employees }) => {
                    const canRemoveLead = isOwner ? board.owner !== lead.id : Boolean(currentUserId && lead.id === currentUserId);
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={lead.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                            <p className="text-xs text-slate-500">{lead.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                              {lead.role}
                            </span>
                            {canRemoveLead ? (
                              <button
                                className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                                onClick={() => void removeBoardMember(lead.id)}
                                title={isOwner ? "Remove member" : "Leave board"}
                                type="button"
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          {employees.length ? (
                            employees.map((employee) => {
                              const canRemoveEmployee = isOwner
                                ? board.owner !== employee.id
                                : Boolean(currentUserId && employee.id === currentUserId);
                              return (
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3" key={employee.id}>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-900">{employee.name}</p>
                                    <p className="truncate text-xs text-slate-500">{employee.email}</p>
                                    {employee.teamName ? <p className="text-xs text-slate-400">Team: {employee.teamName}</p> : null}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                      {employee.role}
                                    </span>
                                    {canRemoveEmployee ? (
                                      <button
                                        className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                                        onClick={() => void removeBoardMember(employee.id)}
                                        title={isOwner ? "Remove member" : "Leave board"}
                                        type="button"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-500">No members assigned to this lead yet.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {unassignedEmployees.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">Unassigned employees</p>
                          <p className="text-xs text-slate-500">Employees without an assigned lead</p>
                        </div>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">Employees</span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {unassignedEmployees.map((employee) => {
                          const canRemoveEmployee = isOwner
                            ? board.owner !== employee.id
                            : Boolean(currentUserId && employee.id === currentUserId);
                          return (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3" key={employee.id}>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900">{employee.name}</p>
                                <p className="truncate text-xs text-slate-500">{employee.email}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                  {employee.role}
                                </span>
                                {canRemoveEmployee ? (
                                  <button
                                    className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                                    onClick={() => void removeBoardMember(employee.id)}
                                    title={isOwner ? "Remove member" : "Leave board"}
                                    type="button"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

export function TaskModal({ boardId, columnId, taskId }: { boardId: string; columnId: string; taskId?: string }) {
  const { data: session } = useSession();
  const { tasks, activeBoard, createTask, updateTask, reviewTask, deleteTask, addComment, addAttachment, removeAttachment, setModal } = useBoardStore();
  const task = useMemo(() => tasks.find((item) => item.id === taskId), [taskId, tasks]);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [comment, setComment] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [subTasks, setSubTasks] = useState(task?.subTasks ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentUserId = session?.user?.id;
  const isOwner = Boolean(currentUserId && activeBoard?.owner === currentUserId);
  const canReview = canManageBoardTasks(activeBoard, currentUserId, session?.user?.role);
  const isCreator = Boolean(currentUserId && task?.createdBy === currentUserId);
  const canEditCore = !task || isOwner || isCreator;
  const willNeedApproval = Boolean(
    !task && requiresTaskApproval(activeBoard, currentUserId, session?.user?.role)
  );
  const isPending = task?.approvalStatus === "pending";
  const assignedNames = (task?.assignees ?? [])
    .map((id) => {
      const member = (activeBoard?.members ?? []).find((item) => memberUserId(item as BoardMemberView) === id);
      return member ? memberLabel(member as BoardMemberView).name : null;
    })
    .filter((name): name is string => Boolean(name));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const payload: TaskInput = {
      column: columnId,
      title,
      description,
      dueDate: dueDate || null,
      priority,
      subTasks
    };

    try {
      if (task) {
        await updateTask(boardId, task.id, payload);
      } else {
        await createTask(boardId, payload);
      }
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteTask(boardId, task.id);
    setModal(null);
  }

  async function review(status: "approved" | "rejected") {
    if (!task || !canReview) return;
    await reviewTask(boardId, task.id, status);
    setModal(null);
  }

  async function submitComment() {
    if (!task || !comment.trim()) return;
    await addComment(boardId, task.id, comment);
    setComment("");
  }

  async function submitAttachment() {
    if (!task || !attachmentName.trim()) return;
    setAttachmentUploading(true);
    try {
      let nextName = attachmentName.trim();
      let nextUrl = attachmentUrl.trim();
      let nextId = "";

      if (attachmentFile) {
        const formData = new FormData();
        formData.append("boardId", boardId);
        formData.append("file", attachmentFile);

        const response = await fetch("/api/boards/attachments", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to upload attachment.");
        }

        nextId = String(payload.id ?? "");
        nextName = String(payload.name ?? nextName);
        nextUrl = String(payload.url ?? "");
      }

      if (!nextUrl) return;

      await addAttachment(boardId, task.id, nextName, nextUrl, nextId || undefined);
      setAttachmentName("");
      setAttachmentUrl("");
      setAttachmentFile(null);
    } finally {
      setAttachmentUploading(false);
    }
  }

  async function removeExistingAttachment(attachmentId: string) {
    if (!task) return;
    await removeAttachment(boardId, task.id, attachmentId);
  }

  function addSubTaskLocal() {
    const titleValue = subTaskTitle.trim();
    if (!titleValue) return;
    setSubTasks((prev) => [...prev, { id: crypto.randomUUID(), title: titleValue, done: false }]);
    setSubTaskTitle("");
  }

  function toggleSubTask(id: string) {
    setSubTasks((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  }

  function deleteSubTask(id: string) {
    setSubTasks((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <Dialog
      title={task ? "Edit task" : "New task"}
      panelClassName="max-w-2xl"
      bodyClassName="max-h-[80vh] overflow-y-auto"
    >
      <form className="space-y-4 p-5" onSubmit={submit}>
        {willNeedApproval ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Clock3 className="mt-0.5 shrink-0" size={16} />
            <span>
              Your task will be submitted for approval. A manager, tester, HR, finance or admin
              must approve it before it can move forward.
            </span>
          </div>
        ) : null}
        {isPending ? (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <Clock3 size={16} />
              This task is waiting for approval.
            </span>
            {canReview ? (
              <span className="flex gap-2">
                <button
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  onClick={() => void review("approved")}
                  type="button"
                >
                  <Check size={14} />
                  Approve
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  onClick={() => void review("rejected")}
                  type="button"
                >
                  <X size={14} />
                  Reject
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
        <Field label="Title" value={title} onChange={setTitle} required disabled={!canEditCore} />
        <TextArea label="Description" value={description} onChange={setDescription} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date" value={dueDate} onChange={setDueDate} type="date" disabled={!canEditCore} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              disabled={!canEditCore}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        {task ? (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {(task.takenByName || task.takenLeadName || task.takenTeamName || assignedNames.length) && (
              <div className="border-b border-slate-200 pb-3">
                <p className="text-sm font-semibold text-slate-800">Assignment Details</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {assignedNames.length ? (
                    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-2 sm:col-span-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Assigned to</span>
                      <span className="text-sm font-medium text-slate-900">{assignedNames.join(", ")}</span>
                    </div>
                  ) : null}
                  {task.takenByName && (
                    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Assigned Employee</span>
                      <span className="text-sm font-medium text-slate-900">{task.takenByName}</span>
                    </div>
                  )}
                  {task.takenLeadName && (
                    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Manager / Tester</span>
                      <span className="text-sm font-medium text-slate-900">{task.takenLeadName}</span>
                    </div>
                  )}
                  {task.takenTeamName && (
                    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Team</span>
                      <span className="text-sm font-medium text-slate-900">{task.takenTeamName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-slate-700">Attachments</p>
              <div className="mt-2 space-y-1">
                {task.attachments.map((attachment) => (
                  <div className="flex items-center justify-between gap-2" key={attachment.id}>
                    <a
                      className="block min-w-0 truncate text-sm text-emerald-700 hover:underline"
                      download={attachment.name}
                      href={attachment.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {attachment.name}
                    </a>
                    <button
                      className="rounded-md p-1 text-rose-600 hover:bg-rose-50"
                      onClick={() => void removeExistingAttachment(attachment.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {task.attachments.length === 0 ? <p className="text-sm text-slate-500">No attachments yet.</p> : null}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setAttachmentFile(file ?? null);
                    if (file && !attachmentName) setAttachmentName(file.name);
                  }}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                  placeholder="File name"
                  value={attachmentName}
                  onChange={(event) => setAttachmentName(event.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                  placeholder="File URL"
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                />
              </div>
              <button
                className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={attachmentUploading || !attachmentName.trim() || (!attachmentFile && !attachmentUrl.trim())}
                onClick={submitAttachment}
                type="button"
              >
                {attachmentUploading ? "Uploading..." : "Add attachment"}
              </button>
            </div>

            <div>
              <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckSquare size={15} />
                Sub-tasks ({subTasks.filter((item) => item.done).length}/{subTasks.length})
              </p>
              <div className="mt-2 space-y-2">
                {subTasks.map((item) => (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2" key={item.id}>
                    <label className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                      <input checked={item.done} onChange={() => toggleSubTask(item.id)} type="checkbox" />
                      <span className={item.done ? "line-through text-slate-400" : ""}>{item.title}</span>
                    </label>
                    <button className="rounded-md p-1 text-rose-600 hover:bg-rose-50" onClick={() => deleteSubTask(item.id)} type="button">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {subTasks.length === 0 ? <p className="text-sm text-slate-500">No sub-tasks yet.</p> : null}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                  placeholder="Add a sub-task"
                  value={subTaskTitle}
                  onChange={(event) => setSubTaskTitle(event.target.value)}
                />
                <button className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:text-slate-950" onClick={addSubTaskLocal} type="button">
                  Add
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700">Comments</p>
              <div className="mt-2 max-h-28 space-y-2 overflow-y-auto">
                {task.comments.map((item) => (
                  <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600" key={`${item.createdAt}-${item.body}`}>
                    {item.body}
                  </p>
                ))}
                {task.comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                  placeholder="Add a comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
                <button className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:text-slate-950" onClick={submitComment} type="button">
                  Add
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700">Activity</p>
              <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-sm text-slate-500">
                {task.activity.slice().reverse().map((item) => (
                  <p key={`${item.createdAt}-${item.action}`}>{item.detail || item.action}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {task && (isOwner || isCreator) ? (
            <button className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${confirmDelete ? "bg-rose-600 text-white hover:bg-rose-700" : "text-rose-600 hover:bg-rose-50"}`} onClick={remove} type="button">
              {confirmDelete ? "Click again to confirm" : "Delete"}
            </button>
          ) : <span />}
          <Submit disabled={submitting} loading={submitting} label={task ? "Save task" : "Create task"} />
        </div>
      </form>
    </Dialog>
  );
}

export function TaskSettingsModal() {
  const { activeBoard, updateTaskSettings, setModal } = useBoardStore();
  const [mode, setMode] = useState<EmployeeTaskMode>(
    activeBoard?.employeeTaskCreation ?? "approval"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: {
    value: EmployeeTaskMode;
    title: string;
    description: string;
  }[] = [
    {
      value: "approval",
      title: "Employees need approval",
      description:
        "Managers, testers, HR, finance and admins create tasks instantly. Employees and others submit tasks that wait for approval."
    },
    {
      value: "allowed",
      title: "Employees can create directly",
      description:
        "Everyone on the board can create tasks immediately. No approval is required."
    },
    {
      value: "blocked",
      title: "Employees cannot create tasks",
      description:
        "Only managers, testers, HR, finance and admins can create tasks. Employees and others cannot add new tasks."
    }
  ];

  async function save() {
    if (!activeBoard || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateTaskSettings(activeBoard.id, mode);
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save task rules.");
      setSaving(false);
    }
  }

  return (
    <Dialog title="Task creation rules" panelClassName="max-w-xl">
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Settings2 className="mt-0.5 shrink-0" size={16} />
          <span>
            These rules apply to employees and the <strong>others</strong> role on this board.
            Managers, testers, HR, finance and admins always create tasks directly.
          </span>
        </div>

        <div className="space-y-2">
          {options.map((option) => (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                mode === option.value
                  ? "border-emerald-400 bg-emerald-50/60"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              key={option.value}
            >
              <input
                checked={mode === option.value}
                className="mt-1"
                name="employee-task-mode"
                onChange={() => setMode(option.value)}
                type="radio"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                <span className="mt-0.5 block text-sm text-slate-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={saving}
            onClick={() => setModal(null)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || !activeBoard}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Saving..." : "Save rules"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function TaskDeleteModal({ boardId, taskId }: { boardId: string; taskId: string }) {
  const { tasks, deleteTask, setModal } = useBoardStore();
  const task = useMemo(() => tasks.find((item) => item.id === taskId), [taskId, tasks]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!task || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTask(boardId, task.id);
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete task.");
      setDeleting(false);
    }
  }

  return (
    <Dialog title="Delete task?" panelClassName="max-w-md">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">{task?.title ?? "this task"}</span>?
            </p>
            <p className="mt-1 text-sm text-slate-500">
              This permanently removes the task, its sub-tasks, comments and attachments. This action cannot be undone.
            </p>
          </div>
        </div>
        {error ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={deleting}
            onClick={() => setModal(null)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!task || deleting}
            onClick={() => void confirmDelete()}
            type="button"
          >
            {deleting ? "Deleting..." : "Delete task"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function TaskMembersModal({ taskId }: { taskId: string }) {
  const { tasks, activeBoard } = useBoardStore();
  const task = useMemo(() => tasks.find((item) => item.id === taskId), [taskId, tasks]);
  const members = (activeBoard?.members ?? []) as BoardMemberView[];

  const workingMembers = [
    { label: "Assigned employee", value: task?.takenByName },
    { label: "Manager / Tester", value: task?.takenLeadName },
    { label: "Team", value: task?.takenTeamName },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  const assignees = (task?.assignees ?? [])
    .map((id) => {
      const member = members.find((item) => memberUserId(item) === id);
      return member ? memberLabel(member).name : null;
    })
    .filter((name): name is string => Boolean(name));

  return (
    <Dialog title="Working members" panelClassName="max-w-md">
      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Task</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900">{task?.title ?? "Task"}</p>
        </div>

        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users size={15} />
            Currently working on this task
          </p>
          {workingMembers.length ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {workingMembers.map((member) => (
                <div className="rounded-lg border border-slate-200 bg-white p-3" key={member.label}>
                  <span className="text-[10px] font-bold uppercase text-slate-400">{member.label}</span>
                  <p className="mt-0.5 break-words text-sm font-medium text-slate-900">{member.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
              No one has started working on this task yet.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">Assigned to</p>
          {assignees.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {assignees.map((name) => (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700" key={name}>
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No members are assigned to this task.</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}


