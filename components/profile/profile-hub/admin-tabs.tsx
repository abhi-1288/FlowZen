import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Bell, Building2, Check, Clipboard, Trash2, Users, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord, AvatarBadge, displayNested, formatRole, formatRoleWithCustom } from "./shared";
import { FinanceMembersView } from "./finance-members-tab";

export function ApprovalsTab({
  approvals,
  refresh,
  showToast,
}: {
  approvals: AnyRecord[];
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [decidingIds, setDecidingIds] = useState<Record<string, boolean>>({});
  const [clearedIds, setClearedIds] = useState<Record<string, boolean>>({});
  const [salaryAmounts, setSalaryAmounts] = useState<Record<string, string>>({});

  function requestIdOf(request: AnyRecord) {
    const value = request.id ?? request._id;
    return value ? String(value) : "";
  }

  function quitNoticeInfo(request: AnyRecord) {
    if (String(request.kind) === "quit-company-board-transfer") {
      return {
        noticeDays: 0,
        elapsedDays: 0,
        remainingDays: 0,
        canApprove: true,
      };
    }
    if (!String(request.kind ?? "").startsWith("quit-")) return null;
    const noticeDays = Number(
      (request.company as AnyRecord | undefined)?.noticePeriodDays ?? 0,
    );
    if (!Number.isFinite(noticeDays) || noticeDays <= 0) {
      return {
        noticeDays: 0,
        elapsedDays: 0,
        remainingDays: 0,
        canApprove: true,
      };
    }
    const createdAt = request.createdAt
      ? new Date(String(request.createdAt))
      : new Date();
    const elapsedDays = Math.max(
      0,
      Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const remainingDays = Math.max(0, noticeDays - elapsedDays);
    return {
      noticeDays,
      elapsedDays,
      remainingDays,
      canApprove: remainingDays === 0,
    };
  }

  async function decide(
    id: string,
    status: "approved" | "rejected",
    force = false,
    requestKind?: string,
  ) {
    if (!id) return;
    const salaryAmount = ["salary", "company"].includes(String(requestKind ?? ""))
      ? Math.max(0, Number(salaryAmounts[id] ?? 0))
      : undefined;
    setDecidingIds((current) => ({ ...current, [id]: true }));
    try {
      await apiFetch(`/api/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, force, salaryAmount }),
      });
      setClearedIds((current) => ({ ...current, [id]: true }));
      showToast(`Request ${status}${force ? " (forced)" : ""}.`);
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : `Could not ${status === "approved" ? "approve" : "decline"} request.`,
        "error",
      );
    } finally {
      setDecidingIds((current) => ({ ...current, [id]: false }));
    }
  }

  const visibleApprovals = approvals.filter(
    (request) => !clearedIds[requestIdOf(request)],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-semibold">Pending Approvals</h3>
      <div className="mt-5 divide-y divide-slate-200">
        {visibleApprovals.map((request) => {
          const requestId = requestIdOf(request);
          const isDeciding = Boolean(decidingIds[requestId]);
          const metadata = (request.metadata ?? {}) as AnyRecord;
          return (
          <div
            className="flex flex-wrap items-center justify-between gap-4 py-4"
            key={requestId}
          >
            <div>
              <p className="font-medium">
                {displayNested(request.requester, "name", "User")},{" "}
                {displayNested(request.requester, "role", "User")}
              </p>
              <p className="text-sm text-slate-500">
                {displayNested(request.requester, "email", "unknown")}{" "}
                {String(request.kind) === "quit-company-board-transfer"
                  ? "requested board transfer approval"
                  : String(request.kind).startsWith("quit-")
                  ? "requested to quit"
                  : String(request.kind) === "identity-code"
                  ? "requested a unique identity code"
                  : String(request.kind) === "salary"
                  ? "requested salary assignment"
                  : String(request.kind) === "salary-increment"
                  ? `requested salary update for ${metadata.targetUserName || "a member"}`
                  : "requested to join"}{" "}
                {String(request.kind) === "identity-code"
                  ? displayNested(request.company, "name", "company")
                  : String(request.kind) === "salary-increment"
                  ? ""
                  : request.kind === "team" || request.kind === "quit-team"
                  ? displayNested(request.team, "name", "team")
                  : displayNested(request.company, "name", "company")}
              </p>
              {String(request.kind) === "quit-company-board-transfer" ? (
                <p className="mt-1 text-xs text-slate-500">
                  {String(request.message ?? "").trim() || "Board transfer approval pending."}
                </p>
              ) : String(request.kind).startsWith("quit-") ? (
                <p className="mt-1 text-xs text-slate-500">
                  {(() => {
                    const info = quitNoticeInfo(request);
                    if (!info || info.noticeDays <= 0)
                      return "No notice period set.";
                    return `Notice period: ${info.noticeDays} days. Pending: ${info.elapsedDays} days. Remaining: ${info.remainingDays} days.`;
                  })()}
                </p>
              ) : null}
              {request.kind === "quit-company" && request.replacementHr ? (
                <p className="mt-1 text-xs text-slate-500">
                  Replacement HR:{" "}
                  {displayNested(request.replacementHr, "name", "HR")}
                </p>
              ) : null}
              {request.replacementUser ? (
                <p className="mt-1 text-xs text-slate-500">
                  Replacement:{" "}
                  {displayNested(request.replacementUser, "name", "Member")}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                disabled={isDeciding}
                onClick={() => decide(requestId, "rejected", false, String(request.kind ?? ""))}
              >
                {isDeciding ? "Working..." : "Decline"}
              </button>
              {["company", "salary"].includes(String(request.kind ?? "")) ? (
                <div className="flex items-center gap-2">
                  <input
                    className="w-28 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    placeholder="Base salary"
                    type="number"
                    min={0}
                    value={salaryAmounts[requestId] ?? ""}
                    onChange={(e) => setSalaryAmounts((a) => ({ ...a, [requestId]: e.target.value }))}
                  />
                  <button
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isDeciding || (String(request.kind ?? "") === "salary" && !(Number(salaryAmounts[requestId] ?? 0) > 0))}
                    onClick={() => decide(requestId, "approved", false, String(request.kind ?? ""))}
                  >
                    {isDeciding ? "Working..." : "Approve"}
                  </button>
                </div>
              ) : String(request.kind ?? "") === "salary-increment" ? (
                <button
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isDeciding}
                  onClick={() => decide(requestId, "approved", false, String(request.kind ?? ""))}
                >
                  {isDeciding ? "Working..." : "Approve Update"}
                </button>
              ) : (
                <button
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={(() => {
                    const info = quitNoticeInfo(request);
                    return isDeciding || (!!info && !info.canApprove);
                  })()}
                  onClick={() => decide(requestId, "approved", false, String(request.kind ?? ""))}
                >
                  {isDeciding ? "Working..." : "Approve"}
                </button>
              )}
              {String(request.kind).startsWith("quit-") ? (
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                  disabled={isDeciding}
                  onClick={() => decide(requestId, "approved", true, String(request.kind ?? ""))}
                  type="button"
                >
                  Force accept
                </button>
              ) : null}
            </div>
          </div>
        );
        })}
        {visibleApprovals.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No pending approvals.</p>
        ) : null}
      </div>
    </section>
  );
}

const MEETING_DURATION_OPTIONS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1.5 hours" },
  { minutes: 120, label: "2 hours" },
] as const;

const HR_MEMBER_ROLE_KEYS = [
  "human-resource",
  "project-manager",
  "qa-tester",
  "finance",
  "employee",
  "others",
] as const;

export function MembersTab({
  insights,
  actorRole,
  showToast,
  refresh,
}: {
  insights: AnyRecord | null;
  actorRole: string;
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: (silent?: boolean) => Promise<void>;
}) {
  const { data: session } = useSession();
  const selfId = session?.user?.id ?? "";
  const hr = (insights?.hr as AnyRecord | undefined) ?? null;
  const members = Array.isArray(hr?.members) ? (hr.members as AnyRecord[]) : [];
  const roleCounts = (hr?.roleCounts as AnyRecord | undefined) ?? {};
  const [modalRole, setModalRole] = useState<
    (typeof HR_MEMBER_ROLE_KEYS)[number] | null
  >(null);
  const [meetingDuration, setMeetingDuration] = useState<number>(30);
  const [invitingFor, setInvitingFor] = useState<string | null>(null);
  const [firingFor, setFiringFor] = useState<string | null>(null);
  const [fireConfirmMember, setFireConfirmMember] = useState<AnyRecord | null>(
    null,
  );
  const [fireConfirmText, setFireConfirmText] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({});
  const [savingSalaryFor, setSavingSalaryFor] = useState<string | null>(null);
  const [selectedOtherRole, setSelectedOtherRole] = useState("all");

  const otherRoleOptions = useMemo(() => {
    const labels = new Set<string>();
    members
      .filter((member) => String(member.role ?? "") === "others")
      .forEach((member) => {
        const value = String(member.customRole ?? "").trim();
        if (value) labels.add(value);
      });
    return Array.from(labels).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [members]);

  const otherRoleSelectOptions = useMemo(() => {
    const labels = new Set<string>(otherRoleOptions);
    [
      "Intern",
      "Trainee",
      "Junior Employee",
      "Employee",
      "Manager",
      "Tester",
      "Junior HR",
    ].forEach((label) => labels.add(label));
    return Array.from(labels).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [otherRoleOptions]);

  useEffect(() => {
    if (modalRole !== "others") {
      setSelectedOtherRole("all");
      return;
    }

    if (
      selectedOtherRole !== "all" &&
      !otherRoleOptions.includes(selectedOtherRole)
    ) {
      setSelectedOtherRole(otherRoleOptions[0] ?? "all");
    }
  }, [modalRole, otherRoleOptions, selectedOtherRole]);

  useEffect(() => {
    if (!modalRole) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setModalRole(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalRole]);

  const canEditOthersRole = actorRole === "human-resource";

  const modalMembers = modalRole
    ? members.filter((m) => {
      if (String(m.role ?? "") !== modalRole) return false;
      if (modalRole === "others" && selectedOtherRole !== "all") {
        return String(m.customRole ?? "").trim() === selectedOtherRole;
      }
      return true;
    })
    : [];

  async function sendMeetingInvite(memberId: string) {
    try {
      setInvitingFor(memberId);
      await apiFetch("/api/hr/meeting-invite", {
        method: "POST",
        body: JSON.stringify({ memberId, durationMinutes: meetingDuration }),
      });
      showToast("Meeting invite sent.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not send invite.",
        "error",
      );
    } finally {
      setInvitingFor(null);
    }
  }

  function requestFire(member: AnyRecord) {
    setFireConfirmText("");
    setFireConfirmMember(member);
  }

  async function confirmFire() {
    const member = fireConfirmMember;
    const memberId = String(member?.id ?? "");
    if (!memberId) return;
    if (
      String(fireConfirmText ?? "")
        .trim()
        .toUpperCase() !== "FIRE"
    ) {
      showToast("Type FIRE to confirm.", "error");
      return;
    }
    try {
      setFiringFor(memberId);
      await apiFetch("/api/hr/fire", {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      showToast("Member removed.");
      setFireConfirmMember(null);
      setModalRole(null);
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not remove member.",
        "error",
      );
    } finally {
      setFiringFor(null);
    }
  }

  function displayMemberRole(member: AnyRecord) {
    return formatRoleWithCustom(
      String(member.role ?? "employee"),
      member.customRole,
    );
  }

  function roleDraftFor(member: AnyRecord) {
    const memberId = String(member.id ?? "");
    if (roleDrafts[memberId] !== undefined) return roleDrafts[memberId];
    return String(member.customRole ?? "");
  }

  async function saveCustomRole(member: AnyRecord) {
    if (!canEditOthersRole) {
      showToast("Only HR can update role labels.", "error");
      return;
    }

    const memberId = String(member.id ?? "");
    if (!memberId) return;
    try {
      setSavingRoleFor(memberId);
      await apiFetch("/api/hr/member-role", {
        method: "PATCH",
        body: JSON.stringify({
          memberId,
          customRole: roleDraftFor(member),
        }),
      });
      showToast("Role label updated.");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to update role label.",
        "error",
      );
    } finally {
      setSavingRoleFor(null);
    }
  }

  function salaryDraftFor(member: AnyRecord) {
    const memberId = String(member.id ?? "");
    if (salaryDrafts[memberId] !== undefined) return salaryDrafts[memberId];
    const currentSalary = Math.max(0, Number(member.baseSalary ?? 0));
    return currentSalary > 0 ? String(currentSalary) : "";
  }

  async function saveMemberSalary(member: AnyRecord) {
    const memberId = String(member.id ?? "");
    const baseSalary = Number(salaryDraftFor(member));
    if (!memberId) return;
    if (!(baseSalary > 0)) {
      showToast("Enter a valid base salary.", "error");
      return;
    }

    try {
      setSavingSalaryFor(memberId);
      await apiFetch(`/api/hr/member-salary/${memberId}`, {
        method: "POST",
        body: JSON.stringify({ baseSalary }),
      });
      showToast("Base salary saved.");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to save base salary.",
        "error",
      );
    } finally {
      setSavingSalaryFor(null);
    }
  }

  if (actorRole === "finance") {
    return <FinanceMembersView members={members} showToast={showToast} />;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">Members</h3>
          <p className="mt-1 text-sm text-slate-500">
            Click a role to view people and send a meeting invite. Invites
            notify the member in Notifications.
          </p>
          {actorRole === "admin" ? (
            <p className="mt-1 text-xs text-slate-400">
              Admin view uses the same member tools as HR.
            </p>
          ) : null}
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Total members
          </p>
          <p className="text-2xl font-semibold">
            {Number(hr?.totalMembers ?? members.length)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {HR_MEMBER_ROLE_KEYS.map((roleName) => {
          const count = Number(roleCounts[roleName] ?? 0);
          return (
            <button
              className="rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              key={roleName}
              type="button"
              onClick={() => {
                setModalRole(roleName);
                setMeetingDuration(30);
              }}
            >
              <p className="text-xs font-medium text-slate-500">
                {formatRole(roleName)}
              </p>
              <p className="text-lg font-semibold">{count}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">View & invite</p>
            </button>
          );
        })}
      </div>

      {members.length === 0 ? (
        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          No approved company members yet.
        </p>
      ) : null}

      {modalRole ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalRole(null);
          }}
        >
          <div
            className="max-h-[min(90vh,720px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="members-modal-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h4 className="text-xl font-semibold" id="members-modal-title">
                  {formatRole(modalRole)}
                </h4>
                <p className="text-sm text-slate-500">
                  {modalMembers.length} member
                  {modalMembers.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="min-w-[260px]">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Meeting Time In
                  </p>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={meetingDuration}
                    onChange={(e) => setMeetingDuration(Number(e.target.value))}
                  >
                    {MEETING_DURATION_OPTIONS.map((opt) => (
                      <option key={opt.minutes} value={opt.minutes}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  aria-label="Close"
                  className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                  type="button"
                  onClick={() => setModalRole(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {modalRole === "others" ? (
              <div className="border-b border-slate-100 px-6 py-4">
                <label
                  className="text-xs font-semibold uppercase text-slate-500"
                  htmlFor="others-role-filter"
                >
                  Filter others by label
                </label>
                <select
                  id="others-role-filter"
                  className="mt-2 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedOtherRole}
                  onChange={(e) => setSelectedOtherRole(e.target.value)}
                >
                  <option value="all">All others</option>
                  {otherRoleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="max-h-[min(55vh,420px)] overflow-y-auto px-6 py-4">
              {modalMembers.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No members in this role.
                </p>
              ) : (
                <ul className="space-y-4">
                  {modalMembers.map((member) => {
                    const memberId = String(member.id);
                    const teams = Array.isArray(member.teams)
                      ? member.teams.map(String)
                      : [];
                    const isSelf = selfId && memberId === selfId;
                    const joinedBy =
                      member.joinedBy && typeof member.joinedBy === "object"
                        ? (member.joinedBy as AnyRecord)
                        : null;
                    return (
                      <li
                        className="rounded-xl border border-slate-200 bg-white p-4"
                        key={memberId}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {String(member.name ?? "Member")}
                            </p>
                            <p className="truncate text-sm text-slate-500">
                              {String(member.email ?? "")}
                            </p>
                            {joinedBy?.name ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Joined by{" "}
                                <span className="font-medium text-slate-700">
                                  {String(joinedBy.name)}
                                </span>
                              </p>
                            ) : null}
                          </div>

                          <div className="grid items-center gap-2">
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                              role: {displayMemberRole(member)}
                            </span>
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                              salary: {Number(member.baseSalary ?? 0) > 0 ? `Rs. ${Number(member.baseSalary).toLocaleString("en-IN")}` : "not set"}
                            </span>
                            <span
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                              title={
                                teams.length
                                  ? teams.join(", ")
                                  : "No team joined"
                              }
                            >
                              team: {teams.length ? teams.join(", ") : "-"}
                            </span>
                          </div>

                          {String(member.role ?? "") === "others" &&
                            canEditOthersRole ? (
                            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                Role label
                              </p>

                              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                                <input
                                  type="text"
                                  list={`roles-${memberId}`}
                                  placeholder="Select or enter custom role"
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
                                  value={roleDraftFor(member)}
                                  onChange={(event) =>
                                    setRoleDrafts((current) => ({
                                      ...current,
                                      [memberId]: event.target.value,
                                    }))
                                  }
                                />

                                <datalist id={`roles-${memberId}`}>
                                  {otherRoleSelectOptions.map((option) => (
                                    <option key={option} value={option} />
                                  ))}

                                  {roleDraftFor(member) &&
                                    !otherRoleSelectOptions.includes(
                                      roleDraftFor(member),
                                    ) ? (
                                    <option value={roleDraftFor(member)} />
                                  ) : null}
                                </datalist>

                                <button
                                  className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={
                                    savingRoleFor === memberId ||
                                    !String(roleDraftFor(member)).trim()
                                  }
                                  type="button"
                                  onClick={() => void saveCustomRole(member)}
                                >
                                  {savingRoleFor === memberId
                                    ? "Saving..."
                                    : "Save role"}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-3">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Base salary
                            </p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                              <input
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
                                min={0}
                                placeholder="Monthly base salary"
                                type="number"
                                value={salaryDraftFor(member)}
                                onChange={(event) =>
                                  setSalaryDrafts((current) => ({
                                    ...current,
                                    [memberId]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={savingSalaryFor === memberId || !(Number(salaryDraftFor(member)) > 0)}
                                type="button"
                                onClick={() => void saveMemberSalary(member)}
                              >
                                {savingSalaryFor === memberId ? "Saving..." : "Save salary"}
                              </button>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                            <button
                              className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!!isSelf || invitingFor === memberId}
                              type="button"
                              onClick={() => void sendMeetingInvite(memberId)}
                            >
                              {invitingFor === memberId
                                ? "Sending…"
                                : "Invite to meet"}
                            </button>
                            <button
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!!isSelf || firingFor === memberId}
                              type="button"
                              onClick={() => requestFire(member)}
                            >
                              {firingFor === memberId ? "Removing…" : "Fire"}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {fireConfirmMember ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFireConfirmMember(null);
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fire-modal-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h4
                  className="text-lg font-semibold text-rose-700"
                  id="fire-modal-title"
                >
                  Fire member
                </h4>
                <p className="mt-1 text-sm text-slate-600">
                  This will remove the member from the company, teams, and
                  boards.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setFireConfirmMember(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-800">
                  You are about to fire{" "}
                  <span className="font-extrabold">
                    {String(fireConfirmMember.name ?? "Member")}
                  </span>
                </p>
                <p className="mt-1 text-sm text-rose-700">
                  Type <span className="font-bold">FIRE</span> to confirm.
                </p>
              </div>

              <input
                className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Type FIRE to confirm"
                value={fireConfirmText}
                onChange={(e) => setFireConfirmText(e.target.value)}
              />

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setFireConfirmMember(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    firingFor === String(fireConfirmMember.id ?? "") ||
                    String(fireConfirmText ?? "")
                      .trim()
                      .toUpperCase() !== "FIRE"
                  }
                  type="button"
                  onClick={() => void confirmFire()}
                >
                  {firingFor === String(fireConfirmMember.id ?? "")
                    ? "Removing…"
                    : "Confirm fire"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function MessagesTab({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [members, setMembers] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"normal" | "bulk">("normal");
  const [chatMember, setChatMember] = useState<AnyRecord | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});
  const [sendingBulk, setSendingBulk] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    let mounted = true;
    apiFetch<{ members: AnyRecord[] }>("/api/messages")
      .then((result) => {
        if (mounted) setMembers(result.members ?? []);
      })
      .catch(() => {
        if (mounted) setMembers([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setChatMember(null);
    }
    if (!chatMember) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatMember]);

  const membersById = useMemo(() => {
    const map = new Map<string, AnyRecord>();
    members.forEach((m) => {
      const id = String(m.id ?? m._id ?? "");
      if (id) map.set(id, m);
    });
    return map;
  }, [members]);

  const bulkSelectedIds = useMemo(() => {
    return Object.keys(bulkSelected).filter(
      (id) => bulkSelected[id] && membersById.has(id),
    );
  }, [bulkSelected, membersById]);

  function toggleBulkSelected(memberId: string) {
    setBulkSelected((current) => ({
      ...current,
      [memberId]: !current[memberId],
    }));
  }

  async function sendChat() {
    const recipientId = String(chatMember?.id ?? chatMember?._id ?? "");
    const message = String(chatMessage ?? "").trim();
    if (!recipientId) return;
    if (!message) {
      showToast("Write a message first.", "error");
      return;
    }
    try {
      setSendingChat(true);
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId, message }),
      });
      setChatMessage("");
      setChatMember(null);
      showToast("Message sent.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send message.",
        "error",
      );
    } finally {
      setSendingChat(false);
    }
  }

  async function sendBulk() {
    const message = String(bulkMessage ?? "").trim();
    if (!message) {
      showToast("Write a message first.", "error");
      return;
    }
    if (bulkSelectedIds.length === 0) {
      showToast("Select at least one user.", "error");
      return;
    }
    try {
      setSendingBulk(true);
      await Promise.all(
        bulkSelectedIds.map((recipientId) =>
          apiFetch("/api/messages", {
            method: "POST",
            body: JSON.stringify({ recipientId, message }),
          }),
        ),
      );
      setBulkMessage("");
      setBulkSelected({});
      showToast(`Message sent to ${bulkSelectedIds.length} user(s).`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send bulk message.",
        "error",
      );
    } finally {
      setSendingBulk(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Messages</h3>
          <p className="mt-1 text-sm text-slate-500">
            Send a message to anyone in your company.
          </p>
        </div>
        <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
          {members.length} members
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "normal"
              ? "bg-slate-950 text-white"
              : "text-slate-700 hover:bg-slate-50"
              }`}
            type="button"
            onClick={() => setMode("normal")}
          >
            Normal messages
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "bulk"
              ? "bg-slate-950 text-white"
              : "text-slate-700 hover:bg-slate-50"
              }`}
            type="button"
            onClick={() => setMode("bulk")}
          >
            Bulk messages
          </button>
        </div>

        {mode === "bulk" ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="rounded-lg bg-slate-50 px-3 py-2">
              Selected:{" "}
              <span className="font-semibold text-slate-900">
                {bulkSelectedIds.length}
              </span>
            </span>
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={bulkSelectedIds.length === 0}
              type="button"
              onClick={() => setBulkSelected({})}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      {mode === "bulk" ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Bulk message</p>
          <p className="mt-1 text-sm text-slate-500">
            Write one message, then click users below to send.
          </p>
          <textarea
            className="mt-3 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Type your bulk message…"
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Tip: click user cards to select/unselect.
            </p>
            <button
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                sendingBulk ||
                bulkSelectedIds.length === 0 ||
                String(bulkMessage ?? "").trim().length === 0
              }
              type="button"
              onClick={() => void sendBulk()}
            >
              {sendingBulk ? "Sending…" : "Send to selected"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {members.map((member) => {
          const memberId = String(member.id ?? member._id ?? "");
          const name = String(member.name ?? "Member");
          const role = formatRole(String(member.role ?? "employee"));
          const email = String(member.email ?? "");
          const teamObj =
            member.team && typeof member.team === "object" ? member.team : null;
          const teamLabel =
            teamObj && (teamObj as any).name
              ? String((teamObj as any).name)
              : Array.isArray(member.teams) && member.teams.length
                ? member.teams.map(String).join(", ")
                : "No team joined";
          const isSelected = !!bulkSelected[memberId];

          return (
            <button
              className={`w-full rounded-lg border p-4 text-left transition ${mode === "bulk"
                ? isSelected
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              key={memberId}
              type="button"
              onClick={() => {
                if (mode === "bulk") {
                  toggleBulkSelected(memberId);
                } else {
                  setChatMember(member);
                  setChatMessage("");
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`font-semibold ${mode === "bulk" && isSelected ? "text-white" : "text-slate-900"}`}
                  >
                    {name}
                  </p>
                  <p
                    className={`text-sm ${mode === "bulk" && isSelected ? "text-white/70" : "text-slate-500"}`}
                  >
                    {email}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${mode === "bulk" && isSelected
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-slate-700"
                      }`}
                  >
                    {role}
                  </span>

                  <span
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${mode === "bulk" && isSelected
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                      }`}
                    title={teamLabel}
                  >
                    Team: {teamLabel}
                  </span>

                  {mode === "normal" ? (
                    <span className="inline-flex items-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
                      Chat
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold ${isSelected
                        ? "bg-white text-slate-950"
                        : "bg-slate-950 text-white"
                        }`}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {!loading && members.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No other approved company members yet.
          </p>
        ) : null}
        {loading ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            Loading company members...
          </p>
        ) : null}
      </div>

      {chatMember ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChatMember(null);
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-modal-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="text-lg font-semibold" id="chat-modal-title">
                  Chat
                </h4>
                <p className="text-sm text-slate-500">
                  To{" "}
                  <span className="font-medium text-slate-900">
                    {String(chatMember.name ?? "Member")}
                  </span>{" "}
                  • {formatRole(String(chatMember.role ?? "employee"))}
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setChatMember(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4">
              <textarea
                className="min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Type your message…"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setChatMember(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    sendingChat || String(chatMessage ?? "").trim().length === 0
                  }
                  type="button"
                  onClick={() => void sendChat()}
                >
                  {sendingChat ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function NotificationsTab({
  notifications,
  markAllRead,
  deleteAll,
  markRead,
  deleteOne,
}: {
  notifications: AnyRecord[];
  markAllRead: () => Promise<void>;
  deleteAll: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Notifications</h3>
          <p className="text-sm text-slate-500">
            Join requests, project updates, and deadline notices.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
            onClick={markAllRead}
          >
            <Check size={16} /> Mark all read
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600"
            onClick={deleteAll}
          >
            <Trash2 size={16} /> Delete all
          </button>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {notifications.map((item) => (
          <div
            className={`rounded-lg border p-4 ${item.readAt ? "border-slate-200 bg-slate-50 text-slate-500" : "border-emerald-200 bg-white shadow-sm"}`}
            key={String(item.id)}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  <Bell size={18} />
                </div>
                <div>
                  <p className="font-medium">
                    {String(item.title ?? "Notification")}
                  </p>
                  <p className="text-sm">
                    {String(item.body || item.message || "")}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.createdAt
                      ? new Date(String(item.createdAt)).toLocaleString()
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col">
                {!item.readAt ? (
                  <button
                    aria-label="Mark notification as read"
                    className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() => markRead(String(item.id))}
                    title="Mark as read"
                    type="button"
                  >
                    <Check size={17} />
                  </button>
                ) : null}
                {!item.readAt ? (
                  <button
                    aria-label="Delete notification"
                    className="grid h-10 w-10 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => deleteOne(String(item.id))}
                    title="Delete"
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {notifications.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No notifications yet.</p>
        ) : null}
      </div>
    </section>
  );
}

export function CodePanel({
  title,
  code,
  label,
  secondaryCodes = [],
  empty,
  showToast,
  children,
}: {
  title: string;
  code?: string;
  label: string;
  secondaryCodes?: { code: string; label: string }[];
  empty: string;
  showToast?: (text: string, type?: "success" | "error") => void;
  children?: ReactNode;
}) {
  const makeJoinUrl = (value: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${value}`
      : value;
  const codes = [code ? { code, label } : null, ...secondaryCodes].filter(
    Boolean,
  ) as { code: string; label: string }[];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Building2 size={18} />
        <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </h3>
      </div>
      {codes.length > 0 ? (
        <>
          <div
            className={
              codes.length > 1 ? "grid gap-3 md:grid-cols-2" : "space-y-3"
            }
          >
            {codes.map((item) => (
              <div key={item.code}>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {item.label}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">
                      {item.code}
                    </p>
                    <button
                      aria-label={`Copy ${item.label}`}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        navigator.clipboard.writeText(item.code);
                        showToast?.(`${item.label} copied.`);
                      }}
                      title="Copy code"
                      type="button"
                    >
                      <Clipboard size={16} />
                    </button>
                  </div>
                </div>
                <button
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200"
                  onClick={() => {
                    navigator.clipboard.writeText(makeJoinUrl(item.code));
                    showToast?.(`${item.label} join URL copied.`);
                  }}
                  type="button"
                >
                  <Users size={16} />
                  Copy {item.label} Join URL
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Share this code or join link with your staff.
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">{empty}</p>
      )}
      {children}
    </section>
  );
}

export function JoinPanel({
  title,
  placeholder,
  value,
  onChange,
  onSubmit,
  status,
  onCancelRequest,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  status?: string;
  onCancelRequest?: () => void;
}) {
  const isPending = String(status ?? "") === "pending";
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">
        Enter the code and wait for approval.
      </p>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? "Requested" : "Request approval"}
        </button>
      </form>
      {isPending && onCancelRequest ? (
        <button
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={onCancelRequest}
        >
          Cancel Request
        </button>
      ) : null}
      {status && status !== "none" ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Current status: {status}
        </p>
      ) : null}
    </section>
  );
}
