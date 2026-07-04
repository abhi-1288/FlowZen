import { useMemo } from "react";
import { X } from "lucide-react";
import { ActionButton, AnyRecord, formatRole, formatRoleWithCustom } from "../../shared";
import type { HrMemberRoleKey, MeetingDuration } from "../types";
import { MEETING_DURATION_OPTIONS } from "../types";
import { currencySymbol } from "../helpers";

export function MemberListModal({
  modalRole,
  members,
  meetingDuration,
  invitingFor,
  firingFor,
  canEditOthersRole,
  selfId,
  selectedOtherRole,
  otherRoleOptions,
  modalSearchInput,
  modalSearchQuery,
  onClose,
  onMeetingDurationChange,
  onSendMeetingInvite,
  onRequestFire,
  onOpenSalaryModal,
  onOpenPfEsicModal,
  onOpenTdsModal,
  onOpenDocModal,
  onOpenRoleModal,
  onOpenCustomRoleModal,
  onSearchInputChange,
  onSearch,
  onSelectedOtherRoleChange,
}: {
  modalRole: HrMemberRoleKey | null;
  members: AnyRecord[];
  meetingDuration: MeetingDuration;
  invitingFor: string | null;
  firingFor: string | null;
  canEditOthersRole: boolean;
  selfId: string;
  selectedOtherRole: string;
  otherRoleOptions: string[];
  modalSearchInput: string;
  modalSearchQuery: string;
  onClose: () => void;
  onMeetingDurationChange: (duration: MeetingDuration) => void;
  onSendMeetingInvite: (memberId: string) => void;
  onRequestFire: (member: AnyRecord) => void;
  onOpenSalaryModal: (member: AnyRecord) => void;
  onOpenPfEsicModal: (member: AnyRecord) => void;
  onOpenTdsModal: (member: AnyRecord) => void;
  onOpenDocModal: (member: AnyRecord) => void;
  onOpenRoleModal: (member: AnyRecord) => void;
  onOpenCustomRoleModal: (member: AnyRecord) => void;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onSelectedOtherRoleChange: (role: string) => void;
}) {
  const modalMembers = useMemo(() => {
    if (!modalRole) return [];
    return members.filter((m) => {
      if (String(m.role ?? "") !== modalRole) return false;
      if (modalRole === "others" && selectedOtherRole !== "all") {
        return String(m.customRole ?? "").trim() === selectedOtherRole;
      }
      return true;
    });
  }, [modalRole, members, selectedOtherRole]);

  if (!modalRole) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-modal-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h4 className="text-xl font-semibold" id="members-modal-title">{formatRole(modalRole)}</h4>
            <p className="text-sm text-slate-500">
              {modalMembers.length} member{modalMembers.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[260px]">
              <p className="text-xs font-semibold uppercase text-slate-500">Meeting Time In</p>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={meetingDuration}
                onChange={(e) => onMeetingDurationChange(Number(e.target.value) as MeetingDuration)}
              >
                {MEETING_DURATION_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              aria-label="Close"
              className="inline-flex items-center justify-center gap-2 rounded-lg p-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {modalRole === "others" ? (
          <div className="border-b border-slate-100 px-6 py-4">
            <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="others-role-filter">
              Filter others by label
            </label>
            <select
              id="others-role-filter"
              className="mt-2 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedOtherRole}
              onChange={(e) => onSelectedOtherRoleChange(e.target.value)}
            >
              <option value="all">All others</option>
              {otherRoleOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="px-6 pt-4">
          <div className="flex gap-2">
            <input
              value={modalSearchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
              placeholder="Search members..."
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950 focus:ring-0"
            />
            <ActionButton variant="primary" onClick={onSearch}>Search</ActionButton>
          </div>
        </div>

        <div className="max-h-[min(55vh,420px)] overflow-y-auto px-6 py-4">
          {(() => {
            const query = modalSearchQuery.toLowerCase().trim();
            const filtered = query
              ? modalMembers.filter((m) => {
                  const name = String(m.name ?? "").toLowerCase();
                  const email = String(m.email ?? "").toLowerCase();
                  const code = String(m.companyIdentityCode ?? "").toLowerCase();
                  const codeNum = code.split("-").pop() ?? "";
                  return name.includes(query) || email.includes(query) || code.includes(query) || codeNum.includes(query);
                })
              : modalMembers;
            if (filtered.length === 0) {
              return <p className="py-8 text-center text-sm text-slate-500">No members match your search.</p>;
            }
            return (
              <ul className="space-y-4">
                {filtered.map((member) => {
                  const memberId = String(member.id);
                  const teams = Array.isArray(member.teams) ? member.teams.map(String) : [];
                  const isSelf = selfId && memberId === selfId;
                  const joinedBy = member.joinedBy && typeof member.joinedBy === "object" ? (member.joinedBy as AnyRecord) : null;
                  return (
                    <li className="rounded-xl border border-slate-200 bg-white p-4" key={memberId}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold">{String(member.name ?? "Member")}</p>
                          <p className="truncate text-sm text-slate-500">{String(member.email ?? "")}</p>
                          {joinedBy?.name ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Joined by <span className="font-medium text-slate-700">{String(joinedBy.name)}</span>
                            </p>
                          ) : null}
                        </div>

                        <div className="grid items-center gap-2">
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            role: {formatRoleWithCustom(String(member.role ?? "employee"), member.customRole)}
                          </span>
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            salary: {(() => {
                              const cur = String(member.salaryCurrency ?? "INR");
                              return Number(member.baseSalary ?? 0) > 0 ? `${currencySymbol(cur)} ${Number(member.baseSalary).toLocaleString("en-IN")}` : "not set";
                            })()}
                          </span>
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700" title={teams.length ? teams.join(", ") : "No team joined"}>
                            team: {teams.length ? teams.join(", ") : "-"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:col-span-3">
                          <ActionButton variant="primary" className="px-3" type="button" onClick={() => onOpenSalaryModal(member)}>Base Salary</ActionButton>
                          <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenPfEsicModal(member)}>PF & ESIC</ActionButton>
                          <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenTdsModal(member)}>TDS</ActionButton>
                          <ActionButton variant="secondary" className="px-3" type="button" onClick={() => void onOpenDocModal(member)}>Documents</ActionButton>
                          {canEditOthersRole && !isSelf && String(member.role ?? "") === "others" ? (
                            <>
                              <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenCustomRoleModal(member)}>Change Custom Role</ActionButton>
                              <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenRoleModal(member)}>Change to Company Role</ActionButton>
                            </>
                          ) : canEditOthersRole && !isSelf ? (
                            <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenRoleModal(member)}>Change Role</ActionButton>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                          <ActionButton variant="primary" className="px-3" disabled={!!isSelf || invitingFor === memberId} type="button" onClick={() => onSendMeetingInvite(memberId)}>
                            {invitingFor === memberId ? "Sending…" : "Invite to meet"}
                          </ActionButton>
                          <ActionButton variant="danger" className="px-3" disabled={!!isSelf || firingFor === memberId} type="button" onClick={() => onRequestFire(member)}>
                            {firingFor === memberId ? "Removing…" : "Fire"}
                          </ActionButton>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
