"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useBoardStore } from "@/store/board-store";
import { apiFetch } from "@/lib/client-utils";
import { Dialog } from "./modal-primitives";

export type BoardMemberView = {
  user?: { id?: string; _id?: string; name?: string; email?: string; team?: { name?: string } } | string;
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
  employees: AssignCandidate[];
};

type AssignCandidates = {
  managers: AssignCandidate[];
  testers: AssignCandidate[];
  finance: AssignCandidate[];
  hr: AssignCandidate[];
  employees: AssignCandidate[];
  teams: AssignTeam[];
};

export function memberUserId(member: BoardMemberView) {
  if (typeof member.user === "string") return member.user;
  return member.user?.id || member.user?._id || "";
}

export function assignedLeadId(member: BoardMemberView) {
  if (typeof member.assignedTo === "string") return member.assignedTo;
  return member.assignedTo?.id || member.assignedTo?._id || "";
}

export function memberLabel(member: BoardMemberView) {
  if (typeof member.user === "string") return { name: "User", email: "", teamName: "" };
  return {
    name: member.user?.name || "User",
    email: member.user?.email || "",
    teamName: typeof member.user?.team === "object" ? String(member.user?.team?.name ?? "") : "",
  };
}

export function AssignModal({ boardId }: { boardId: string }) {
  const { data: session } = useSession();
  const { activeBoard, assignMember, unassignTeam, removeMember } = useBoardStore();
  const members = (activeBoard?.members ?? []) as BoardMemberView[];
  const leads = members.filter((member) => ["manager", "tester"].includes(member.role));
  const assignableMembers = members.filter((member) => member.role !== "admin" && memberUserId(member) !== activeBoard?.owner);
  const [candidates, setCandidates] = useState<AssignCandidates>({ managers: [], testers: [], finance: [], hr: [], employees: [], teams: [] });
  const [memberId, setMemberId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [openLeadId, setOpenLeadId] = useState(() => memberUserId(leads[0] ?? { role: "manager" }));
  const [openTeamId, setOpenTeamId] = useState("");
  const currentMember = members.find((member) => memberUserId(member) === session?.user?.id);
  const isAdminOwner = Boolean(session?.user?.role === "admin" && activeBoard?.owner === session.user.id);
  const canAssignTeam = isAdminOwner || ["manager", "tester"].includes(currentMember?.role ?? "");

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
      ? candidates.managers[0] ?? candidates.testers[0] ?? candidates.finance[0] ?? candidates.hr[0]
      : candidates.employees[0] ?? assignableMembers[0];
    if (firstCandidate) setMemberId(firstCandidate.id);
    else if (assignableMembers[0]) setMemberId(memberUserId(assignableMembers[0]));
  }, [assignableMembers, candidates, isAdminOwner, memberId]);

  useEffect(() => {
    if (isAdminOwner || leadId) return;
    if (currentMember) setLeadId(memberUserId(currentMember));
    else if (leads[0]) setLeadId(memberUserId(leads[0]));
  }, [currentMember, isAdminOwner, leadId, leads]);

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
    { title: "Finance", items: candidates.finance, type: "user" as const },
    { title: "HR", items: candidates.hr, type: "user" as const },
    { title: "My Teams", items: candidates.teams, type: "team" as const },
    { title: "Employees", items: candidates.employees, type: "user" as const },
  ].filter((section) => Array.isArray(section.items) && section.items.length > 0);

  return (
    <Dialog title={`${activeBoard?.title ?? "Board"} project assignments`} panelClassName="max-w-3xl" bodyClassName="max-h-[85vh] overflow-y-auto">
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
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                              onClick={() => {
                                if (section.type === "team") setOpenTeamId(openTeamId === item.id ? "" : item.id);
                                else void assignCandidate(item.id, isAdminOwner ? "" : session?.user?.id ?? "");
                              }}
                              type="button"
                            >
                              {section.type === "team" ? (
                                <span className="inline-flex items-center gap-1">
                                  {openTeamId === item.id ? "Hide members" : "View members"}
                                  {openTeamId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </span>
                              ) : "Assign"}
                            </button>
                            {section.type === "team" ? (
                              <button
                                className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                                onClick={() => canAssignTeam ? void assignTeam(item.id) : undefined}
                                type="button"
                                disabled={!canAssignTeam}
                              >
                                Assign Team
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {section.type === "team" && section.items.map((item: any) => {
                const isOpenTeam = openTeamId === item.id;
                return isOpenTeam ? (
                  <div key={`${item.id}-members`} className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-700">
                      <span>{item.employeeCount} approved team member{item.employeeCount === 1 ? "" : "s"}</span>
                      <button
                        className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        type="button"
                        onClick={() => setOpenTeamId("")}
                      >
                        Close
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(item.employees ?? []).map((teamMember: any) => {
                        const isTeamMemberAssigned = boardMemberIds.has(teamMember.id);
                        return (
                          <div key={teamMember.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{teamMember.name}</p>
                              <p className="truncate text-xs text-slate-500">{teamMember.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isTeamMemberAssigned ? (
                                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Assigned</span>
                              ) : (
                                <button
                                  className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                                  onClick={() => canAssignTeam ? void assignCandidate(teamMember.id, session?.user?.id ?? "") : undefined}
                                  type="button"
                                  disabled={!canAssignTeam}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    Assign
                                    <ChevronDown size={12} />
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })}
            </section>
          ))}
        </div>
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
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {assignedMembers.length}
                    </span>
                    <span className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                      <ChevronDown size={16} className="text-slate-400" />
                    </span>
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
