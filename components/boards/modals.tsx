"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckSquare, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useBoardStore, type TaskInput } from "@/store/board-store";
import { apiFetch } from "@/lib/client-utils";
import type { Priority } from "@/lib/types";

function Dialog({
  title,
  children,
  panelClassName,
  bodyClassName
}: {
  title: string;
  children: React.ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
}) {
  const setModal = useBoardStore((state) => state.setModal);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <section className={`w-full max-w-lg rounded-lg bg-white shadow-soft ${panelClassName ?? ""}`}>
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)} type="button">
            <X size={18} />
          </button>
        </header>
        <div className={bodyClassName}>{children}</div>
      </section>
    </div>
  );
}

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

export function BoardEditModal() {
  const { activeBoard, updateBoard, setModal } = useBoardStore();
  const [title, setTitle] = useState(activeBoard?.title ?? "");
  const [description, setDescription] = useState(activeBoard?.description ?? "");
  const [attachments, setAttachments] = useState(activeBoard?.attachments ?? []);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!activeBoard) return;
    await updateBoard(activeBoard.id, { title, description, attachments });
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

type BoardMemberView = {
  user?: { id?: string; _id?: string; name?: string; email?: string } | string;
  assignedTo?: { id?: string; _id?: string; name?: string; email?: string } | string | null;
  role: string;
};

type AssignCandidate = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AssignTeam = {
  id: string;
  name: string;
  employeeCount: number;
  employeeIds: string[];
};

type AssignCandidates = {
  managers: AssignCandidate[];
  testers: AssignCandidate[];
  employees: AssignCandidate[];
  teams: AssignTeam[];
};

function memberUserId(member: BoardMemberView) {
  if (typeof member.user === "string") return member.user;
  return member.user?.id || member.user?._id || "";
}

function assignedLeadId(member: BoardMemberView) {
  if (typeof member.assignedTo === "string") return member.assignedTo;
  return member.assignedTo?.id || member.assignedTo?._id || "";
}

function memberLabel(member: BoardMemberView) {
  if (typeof member.user === "string") return { name: "User", email: "" };
  return { name: member.user?.name || "User", email: member.user?.email || "" };
}

export function AssignModal({ boardId }: { boardId: string }) {
  const { data: session } = useSession();
  const { activeBoard, assignMember, unassignTeam, removeMember } = useBoardStore();
  const members = (activeBoard?.members ?? []) as BoardMemberView[];
  const leads = members.filter((member) => ["manager", "tester"].includes(member.role));
  const assignableMembers = members.filter((member) => member.role !== "admin" && memberUserId(member) !== activeBoard?.owner);
  const [candidates, setCandidates] = useState<AssignCandidates>({ managers: [], testers: [], employees: [], teams: [] });
  const [memberId, setMemberId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [openLeadId, setOpenLeadId] = useState(() => memberUserId(leads[0] ?? { role: "manager" }));
  const currentMember = members.find((member) => memberUserId(member) === session?.user?.id);
  const isAdminOwner = Boolean(session?.user?.role === "admin" && activeBoard?.owner === session.user.id);

  useEffect(() => {
    async function loadCandidates() {
      const result = await apiFetch<AssignCandidates>(`/api/boards/${boardId}/assign`).catch(() => null);
      if (result) setCandidates(result);
    }

    void loadCandidates();
  }, [boardId]);

  useEffect(() => {
    if (memberId) return;
    const firstCandidate = isAdminOwner
      ? candidates.managers[0] ?? candidates.testers[0]
      : candidates.employees[0] ?? assignableMembers[0];
    if (firstCandidate) setMemberId(firstCandidate.id);
    else if (assignableMembers[0]) setMemberId(memberUserId(assignableMembers[0]));
  }, [assignableMembers, candidates, isAdminOwner, memberId]);

  useEffect(() => {
    if (isAdminOwner || leadId) return;
    if (currentMember) setLeadId(memberUserId(currentMember));
    else if (leads[0]) setLeadId(memberUserId(leads[0]));
  }, [currentMember, isAdminOwner, leadId, leads]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!memberId) return;
    await assignMember(boardId, memberId, leadId);
  }

  async function assignCandidate(candidateId: string, nextLeadId = "") {
    await assignMember(boardId, candidateId, nextLeadId);
    setMemberId(candidateId);
  }

  async function assignTeam(teamId: string) {
    await assignMember(boardId, undefined, undefined, teamId);
  }

  const admin = members.find((member) => member.role === "admin") ?? members.find((member) => memberUserId(member) === activeBoard?.owner);
  const unassigned = assignableMembers.filter((member) => ["employee", "others"].includes(member.role) && !assignedLeadId(member));
  const boardMemberIds = new Set(members.map(memberUserId));
  const assignedToMeIds = new Set(members.filter((m) => assignedLeadId(m) === session?.user?.id).map(memberUserId));

  const candidateSections = [
    { title: "Project managers", items: candidates.managers, type: "user" as const },
    { title: "Q-A testers", items: candidates.testers, type: "user" as const },
    { title: "My Teams", items: candidates.teams, type: "team" as const },
    { title: "Employees", items: candidates.employees, type: "user" as const },
  ].filter((section) => section.items.length > 0);

  return (
    <Dialog title={`${activeBoard?.title ?? "Board"} project assignments`} panelClassName="max-w-3xl" bodyClassName="max-h-[80vh] overflow-y-auto">
      {candidateSections.length ? (
        <div className="space-y-3 border-b border-slate-200 p-5">
          {candidateSections.map((section) => (
            <section className="rounded-lg border border-slate-200 p-3" key={section.title}>
              <p className="text-sm font-semibold text-slate-800">{section.title}</p>
              <div className="mt-2 space-y-2">
                {section.items.map((item: any) => {
                  const isAssigned = section.type === "user" 
                    ? boardMemberIds.has(item.id)
                    : (item.employeeIds?.length > 0 && item.employeeIds.every((id: string) => boardMemberIds.has(id)));
                  
                  const isAssignedToMe = section.type === "user"
                    ? assignedToMeIds.has(item.id)
                    : (item.employeeIds?.length > 0 && item.employeeIds.every((id: string) => assignedToMeIds.has(id)));

                  return (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm" key={item.id}>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {section.type === "team" ? `${item.employeeCount} approved employees` : item.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAssignedToMe ? (
                          <>
                            {section.type === "team" ? (
                              <button
                                className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
                                onClick={() => void unassignTeam(boardId, item.id)}
                                type="button"
                              >
                                Unassign Team
                              </button>
                            ) : (
                              <>
                                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Assigned</span>
                                <button
                                  className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
                                  onClick={() => void removeMember(boardId, item.id)}
                                  type="button"
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </>
                        ) : isAssigned ? (
                          <>
                            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Assigned</span>
                            {isAdminOwner && (
                              <button
                                className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
                                onClick={() => void removeMember(boardId, item.id)}
                                type="button"
                              >
                                Remove
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                            onClick={() => {
                              if (section.type === "team") void assignTeam(item.id);
                              else void assignCandidate(item.id, isAdminOwner ? "" : session?.user?.id ?? "");
                            }}
                            type="button"
                          >
                            {section.type === "team" ? "Assign Team" : "Assign"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {!isAdminOwner && assignableMembers.filter((member) => ["employee", "others"].includes(member.role)).length ? (
        <form className="grid gap-3 border-b border-slate-200 p-5 sm:grid-cols-[1fr_1fr_auto]" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Member</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              {assignableMembers.filter((item) => ["employee", "others"].includes(item.role)).map((member) => {
                const user = memberLabel(member);
                return (
                  <option key={memberUserId(member)} value={memberUserId(member)}>
                    {user.name} - {member.role}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Assign under</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2"
              value={leadId}
              onChange={(event) => setLeadId(event.target.value)}
              disabled={!isAdminOwner}
            >
              <option value="">Unassigned</option>
              {leads.map((member) => {
                const user = memberLabel(member);
                return (
                  <option key={memberUserId(member)} value={memberUserId(member)}>
                    {user.name} - {member.role}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="flex items-end">
            <Submit label="Assign" />
          </div>
        </form>
      ) : null}

      <div className="space-y-3 p-5">
        {admin ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-bold uppercase text-slate-900">Admin</p>
            <p className="mt-1 text-sm text-slate-600">{memberLabel(admin).email}</p>
          </div>
        ) : null}

        {leads.map((lead) => {
          const leadIdValue = memberUserId(lead);
          const leadUser = memberLabel(lead);
          const assignedMembers = assignableMembers.filter((member) => assignedLeadId(member) === leadIdValue);
          const isOpen = openLeadId === leadIdValue;
          return (
            <section className="rounded-lg border border-slate-200" key={leadIdValue}>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  className="flex flex-1 items-center justify-between gap-3 text-left"
                  onClick={() => setOpenLeadId(isOpen ? "" : leadIdValue)}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-semibold capitalize text-slate-900">{lead.role}</span>
                    <span className="block text-sm text-slate-500">{leadUser.email}</span>
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                    {assignedMembers.length}
                  </span>
                </button>
                {isAdminOwner && leadIdValue !== session?.user?.id && (
                  <button
                    className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                    onClick={() => void removeMember(boardId, leadIdValue)}
                    title="Remove from board"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {isOpen ? (
                <div className="border-t border-slate-200 px-4 py-3">
                  {assignedMembers.length ? (
                    <ol className="space-y-2 text-sm text-slate-700">
                      {assignedMembers.map((member, index) => {
                        const user = memberLabel(member);
                        const mId = memberUserId(member);
                        return (
                          <li className="flex items-center justify-between gap-2" key={mId}>
                            <div className="flex gap-2">
                              <span className="w-5 shrink-0 text-slate-400">{index + 1}.</span>
                              <span>
                                <span className="font-medium capitalize">{member.role}: </span>
                                {user.email}
                              </span>
                            </div>
                            <button
                              className="rounded-md p-1 text-rose-600 hover:bg-rose-50"
                              onClick={() => void removeMember(boardId, mId)}
                              title="Remove from board"
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">No members assigned yet.</p>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}

        {unassigned.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-3">
            <p className="text-sm font-semibold text-slate-700">Unassigned</p>
            <div className="mt-2 space-y-2">
              {unassigned.map((member) => (
                <div className="flex items-center justify-between gap-2 text-sm text-slate-500" key={memberUserId(member)}>
                  <span>{memberLabel(member).email || memberLabel(member).name}</span>
                  <button
                    className="rounded-md p-1 text-rose-600 hover:bg-rose-50"
                    onClick={() => void removeMember(boardId, memberUserId(member))}
                    title="Remove from board"
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}


export function InviteModal({ boardId }: { boardId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { activeBoard, inviteUser, removeMember, setModal } = useBoardStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const currentUserId = session?.user?.id;
  const isOwner = Boolean(currentUserId && activeBoard?.owner === currentUserId);

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
    <Dialog title={isOwner ? "Invite collaborator" : "Board members"}>
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

      {activeBoard?.members?.length ? (
        <div className={`${isOwner ? "border-t" : ""} border-slate-200 p-5`}>
          <p className="mb-3 text-sm font-semibold text-slate-700">Board Members</p>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {activeBoard.members.map((member: any) => {
              const mUser = (member.user as any) ?? {};
              const memberId = mUser.id || mUser._id || member.user;
              const canRemoveMember = isOwner
                ? activeBoard.owner !== memberId
                : Boolean(currentUserId && memberId === currentUserId);
              return (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2 text-sm" key={memberId}>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{mUser.name || "User"}</p>
                    <p className="truncate text-xs text-slate-500">{mUser.email || ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {member.role}
                    </span>
                    {canRemoveMember ? (
                      <button
                        className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                        onClick={() => void removeBoardMember(memberId)}
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
    </Dialog>
  );
}

export function TaskModal({ boardId, columnId, taskId }: { boardId: string; columnId: string; taskId?: string }) {
  const { data: session } = useSession();
  const { tasks, activeBoard, createTask, updateTask, deleteTask, addComment, addAttachment, removeAttachment, setModal } = useBoardStore();
  const task = useMemo(() => tasks.find((item) => item.id === taskId), [taskId, tasks]);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [comment, setComment] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [subTasks, setSubTasks] = useState(task?.subTasks ?? []);

  const currentUserId = session?.user?.id;
  const isOwner = Boolean(currentUserId && activeBoard?.owner === currentUserId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload: TaskInput = {
      column: columnId,
      title,
      description,
      dueDate: dueDate || null,
      priority,
      subTasks
    };

    if (task) {
      await updateTask(boardId, task.id, payload);
    } else {
      await createTask(boardId, payload);
    }
    setModal(null);
  }

  async function remove() {
    if (!task) return;
    await deleteTask(boardId, task.id);
    setModal(null);
  }

  async function submitComment() {
    if (!task || !comment.trim()) return;
    await addComment(boardId, task.id, comment);
    setComment("");
  }

  async function submitAttachment() {
    if (!task || !attachmentName.trim()) return;
    const safeUrl = attachmentUrl.trim() || `file://${encodeURIComponent(attachmentName.trim())}`;
    await addAttachment(boardId, task.id, attachmentName, safeUrl);
    setAttachmentName("");
    setAttachmentUrl("");
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
        <Field label="Title" value={title} onChange={setTitle} required disabled={!isOwner} />
        <TextArea label="Description" value={description} onChange={setDescription} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date" value={dueDate} onChange={setDueDate} type="date" disabled={!isOwner} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              disabled={!isOwner}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        {task ? (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {(task.takenByName || task.takenLeadName || task.takenTeamName) && (
              <div className="border-b border-slate-200 pb-3">
                <p className="text-sm font-semibold text-slate-800">Assignment Details</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    <a className="block min-w-0 truncate text-sm text-emerald-700 hover:underline" href={attachment.url} target="_blank">
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
              <button className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:text-slate-950" onClick={submitAttachment} type="button">
                Add attachment
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
          {task && isOwner ? (
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50" onClick={remove} type="button">
              Delete
            </button>
          ) : <span />}
          <Submit label={task ? "Save task" : "Create task"} />
        </div>
      </form>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="min-h-28 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function Submit({ label }: { label: string }) {
  return (
    <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800" type="submit">
      {label}
    </button>
  );
}
