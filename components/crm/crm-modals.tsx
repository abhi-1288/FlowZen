"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Search, Trash2, Users, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";

type CrmCollection = {
  label: string;
  records: any[];
  set: (next: any[] | ((prev: any[]) => any[])) => void;
  ownerField?: string;
};

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  team?: string;
  regionLabel?: string;
};

type AssignCandidate = {
  id: string;
  name: string;
  email: string;
  role: string;
  regionLabel?: string;
};

type AssignTeam = {
  id: string;
  name: string;
  managerId: string;
  managerName: string;
  employeeCount: number;
  employeeIds: string[];
  employees: AssignCandidate[];
};

type AssignDirectory = {
  ownRegion: string;
  region: string;
  regions: string[];
  currentUser: { id: string; role: string; teamId: string; isAdminOwner: boolean };
  candidates: {
    managers: AssignCandidate[];
    testers: AssignCandidate[];
    finance: AssignCandidate[];
    hr: AssignCandidate[];
    employees: AssignCandidate[];
  };
  managedTeamIds: string[];
  memberTeamIds: string[];
  teams: AssignTeam[];
};

const ROLES = [
  "employee", "project-manager", "qa-tester", "human-resource",
  "finance", "admin", "security", "it-admin", "it-administration",
  "others", "warehouse",
];

const roleLabel = (role = "") => role.replaceAll("-", " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
const recordIdOf = (record: any) => String(record?.id || record?._id || "");

function Dialog({ title, subtitle, children, onClose, panelClassName = "max-w-3xl" }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  panelClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <section className={`w-full rounded-lg bg-white shadow-card dark:bg-zinc-900 ${panelClassName}`}>
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-zinc-50">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p> : null}
          </div>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[80vh] overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}

/** Region picker shared by the assign and invite dialogs. */
function RegionScope({ regions, ownRegion, region, onChange }: {
  regions: string[];
  ownRegion: string;
  region: string;
  onChange: (region: string) => void;
}) {
  const options = Array.from(new Set([...regions, ...(ownRegion ? [ownRegion] : [])])).filter(Boolean);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/60">
      <span className="text-slate-600 dark:text-zinc-300">
        Showing approved members for <strong>{region || ownRegion || "your region"}</strong>
      </span>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
        Region
        <select
          value={region}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value={ownRegion || ""}>My region{ownRegion ? `: ${ownRegion}` : ""}</option>
          <option value="">All regions</option>
          {options.filter((item) => item !== ownRegion).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function useRegionScope() {
  const [regions, setRegions] = useState<string[]>([]);
  const [ownRegion, setOwnRegion] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<AssignDirectory>("/api/crm/assign", undefined, { toast: false })
      .then((data) => {
        if (!active) return;
        setRegions(data?.regions || []);
        setOwnRegion(data?.ownRegion || "");
        setRegion(data?.region || data?.ownRegion || "");
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return { regions, ownRegion, region, setRegion };
}

function useDirectorySearch(role: string, query: string, region: string) {
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ role, q: trimmed });
      if (region) params.set("region", region);
      apiFetch<{ users: DirectoryUser[]; region?: string }>(`/api/users?${params.toString()}`, undefined, { toast: false })
        .then((data) => setResults(data.users || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [role, query, region]);

  return { results, searching };
}

function MemberPicker({ role, region, selected, onSelect }: {
  role: string;
  region: string;
  selected: DirectoryUser | null;
  onSelect: (member: DirectoryUser | null) => void;
}) {
  const [query, setQuery] = useState("");
  const { results, searching } = useDirectorySearch(role, selected ? "" : query, region);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); onSelect(null); }}
          placeholder="Search by name, email or identity"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
        />
        {searching ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching...</span> : null}
      </div>
      {!selected && results.length ? (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.map((member) => {
            const id = member.id || String((member as any)._id || "");
            return (
              <button
                type="button"
                key={id}
                onClick={() => { onSelect({ ...member, id }); setQuery(member.name || member.email); }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-zinc-800"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {(member.name || member.email || "U").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">{member.name || member.email}</span>
                  <span className="block truncate text-xs capitalize text-slate-500">
                    {roleLabel(member.role)}{member.regionLabel ? ` | ${member.regionLabel}` : ""} | {member.email}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {selected ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <CheckCircle2 size={13} /> Selected: {selected.name || selected.email}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Only approved members from the selected region appear in search.</p>
      )}
    </div>
  );
}

/** Board-style assignment dialog with region-scoped candidates and teams. */
export function CrmAssignModal({ collections, onClose, onAssigned }: {
  collections: Record<string, CrmCollection>;
  onClose: () => void;
  onAssigned: (label: string, name: string) => void;
}) {
  const { data: session } = useSession();
  const { regions, ownRegion, region, setRegion } = useRegionScope();
  const [entity, setEntity] = useState("leads");
  const [recordId, setRecordId] = useState("");
  const [directory, setDirectory] = useState<AssignDirectory | null>(null);
  const [openTeamId, setOpenTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const collection = collections[entity];
  const records = collection?.records || [];
  const selectedRecord = records.find((record) => recordIdOf(record) === recordId);
  const currentUserId = String(session?.user?.id || directory?.currentUser?.id || "");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    apiFetch<AssignDirectory>(`/api/crm/assign?${params.toString()}`, undefined, { toast: false })
      .then((data) => { if (active) setDirectory(data); })
      .catch(() => { if (active) setDirectory(null); });
    return () => { active = false; };
  }, [region]);

  useEffect(() => { setRecordId(records[0] ? recordIdOf(records[0]) : ""); }, [entity, records.length]);

  async function applyAssignment(payload: { memberId?: string; teamId?: string; take?: boolean }, label: string) {
    if (!collection || !recordId || saving) return;
    setSaving(true);
    setError("");
    const result = await apiFetch<{ record: any }>("/api/crm/assign", {
      method: "PATCH",
      body: JSON.stringify({ entity, recordId, ...payload }),
    }, { toast: false }).catch(() => null);
    setSaving(false);
    if (!result?.record) {
      setError("Unable to save the assignment. Check the team's work and try again.");
      return;
    }
    collection.set((prev) => prev.map((record) => recordIdOf(record) === recordId ? { ...record, ...result.record } : record));
    onAssigned(collection.label, label);
    onClose();
  }

  const canManageAll = Boolean(directory?.currentUser?.isAdminOwner);
  const teams = directory?.teams || [];

  const sections = [
    { title: "Project managers", items: directory?.candidates?.managers || [] },
    { title: "Q-A testers", items: directory?.candidates?.testers || [] },
    { title: "Finance", items: directory?.candidates?.finance || [] },
    { title: "HR", items: directory?.candidates?.hr || [] },
    { title: "Employees", items: directory?.candidates?.employees || [] },
  ].filter((section) => section.items.length > 0);

  return (
    <Dialog
      title="Assign CRM record"
      subtitle="Assign a record to a person or a whole team in your region"
      onClose={onClose}
      panelClassName="max-w-3xl"
    >
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-zinc-200">Record type</span>
            <select
              value={entity}
              onChange={(event) => { setEntity(event.target.value); setRecordId(""); }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {Object.entries(collections).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-zinc-200">Record</span>
            <select
              value={recordId}
              onChange={(event) => setRecordId(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {records.length ? records.map((record) => (
                <option key={recordIdOf(record)} value={recordIdOf(record)}>
                  {record.title || record.subject || record.number || [record.firstName, record.lastName].filter(Boolean).join(" ") || record.name || "Record"}
                </option>
              )) : <option value="">No {collection?.label || "records"} yet</option>}
            </select>
          </label>
        </div>

        <RegionScope regions={regions} ownRegion={ownRegion} region={region} onChange={(value) => { setRegion(value); setOpenTeamId(""); }} />

        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="space-y-3">
          {teams.length ? (
            <section className="rounded-lg border border-slate-200 p-3 dark:border-zinc-700">
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Teams in {region || ownRegion || "your region"}</p>
              <div className="mt-2 space-y-2">
                {teams.map((team) => {
                  const isTeamManager = Boolean(team.managerId && team.managerId === currentUserId);
                  const canManageTeam = canManageAll || isTeamManager;
                  const isMember = (directory?.memberTeamIds || []).includes(team.id);
                  const alreadyAssigned = String(selectedRecord?.teamId || "") === team.id;
                  const hasWork = team.employeeCount > 0;
                  const isOpen = openTeamId === team.id;
                  return (
                    <div key={team.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-zinc-100">{team.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {team.employeeCount} approved work member{team.employeeCount === 1 ? "" : "s"}
                            {team.managerName ? ` · Owner: ${team.managerName}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenTeamId(isOpen ? "" : team.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-zinc-700"
                          >
                            {isOpen ? "Hide members" : "View members"}
                            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                          {canManageTeam ? (
                            <button
                              type="button"
                              disabled={!hasWork || !recordId || saving}
                              onClick={() => void applyAssignment({ teamId: team.id }, `${team.name} team`)}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                              title={!hasWork ? "This team has no approved work members yet." : undefined}
                            >
                              Assign Team
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">{team.managerName ? `Owned by ${team.managerName}` : "Managed by another owner"}</span>
                          )}
                          {isMember && alreadyAssigned && hasWork ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void applyAssignment({ memberId: currentUserId, take: true }, "yourself")}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Take task
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {isOpen ? (
                        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-zinc-700">
                          {team.employees.length ? team.employees.map((employee) => (
                            <div key={employee.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm dark:bg-zinc-900">
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 dark:text-zinc-100">{employee.name}</p>
                                <p className="truncate text-xs text-slate-500">{employee.email}</p>
                              </div>
                              <button
                                type="button"
                                disabled={!canManageTeam || !recordId || saving}
                                onClick={() => void applyAssignment({ memberId: employee.id }, employee.name)}
                                className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-zinc-700"
                              >
                                Assign
                              </button>
                            </div>
                          )) : (
                            <p className="text-xs text-slate-500">No approved members in this team yet.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {sections.map((section) => (
            <section className="rounded-lg border border-slate-200 p-3 dark:border-zinc-700" key={section.title}>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{section.title}</p>
              <div className="mt-2 space-y-2">
                {section.items.map((candidate) => (
                  <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-zinc-100">{candidate.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {candidate.email}{candidate.regionLabel ? ` · ${candidate.regionLabel}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!recordId || saving}
                      onClick={() => void applyAssignment({ memberId: candidate.id }, candidate.name)}
                      className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700"
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {!teams.length && !sections.length ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              No approved members or teams found for this region.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200" onClick={onClose} type="button">Close</button>
        </div>
      </div>
    </Dialog>
  );
}

/** Invite collaborators, scoped to the selected region. */
export function CrmInviteModal({ members, teams, departments, onMembersChange, onClose, onInvited }: {
  members: any[];
  teams: string[];
  departments: string[];
  onMembersChange: (members: any[]) => void;
  onClose: () => void;
  onInvited: (name: string) => void;
}) {
  const { regions, ownRegion, region, setRegion } = useRegionScope();
  const [role, setRole] = useState("employee");
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [team, setTeam] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    const payload = {
      name: selected.name || selected.email,
      email: selected.email,
      userId: selected.id,
      role: inviteRole,
      team: team || selected.team || "",
      regionLabel: selected.regionLabel || region || ownRegion || "",
    };
    const result = await apiFetch<{ member: any }>("/api/crm/members", {
      method: "POST",
      body: JSON.stringify(payload),
    }, { toast: false }).catch(() => null);
    setSaving(false);
    if (!result?.member) {
      setError("Unable to send the invitation. Try again.");
      return;
    }
    onMembersChange([result.member, ...members]);
    onInvited(payload.name);
    onClose();
  }

  async function removeMember(id: string) {
    await apiFetch(`/api/crm/members/${id}`, { method: "DELETE" }, { toast: false }).catch(() => null);
    onMembersChange(members.filter((member) => recordIdOf(member) !== id));
  }

  return (
    <Dialog title="Invite collaborator" subtitle="Invite an approved member from your region into this CRM workspace" onClose={onClose}>
      <form className="space-y-5 p-5" onSubmit={submit}>
        <RegionScope regions={regions} ownRegion={ownRegion} region={region} onChange={(value) => { setRegion(value); setSelected(null); }} />

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-200">Role</label>
          <select
            value={role}
            onChange={(event) => { setRole(event.target.value); setSelected(null); }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {ROLES.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
          </select>
        </div>
        <MemberPicker role={role} region={region} selected={selected} onSelect={setSelected} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-200">Access level</span>
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950">
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-200">Team or department</span>
            <select value={team} onChange={(event) => setTeam(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950">
              <option value="">No team</option>
              {[...teams, ...departments].map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>

        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <button className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700" type="submit" disabled={!selected || saving}>
          {saving ? <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
          Send invite
        </button>
      </form>

      <div className="border-t border-slate-200 p-5 dark:border-zinc-800">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200"><Users size={16} /> CRM collaborators ({members.length})</p>
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {members.length ? members.map((member) => {
            const id = recordIdOf(member);
            return (
              <div key={id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2.5 text-sm dark:border-zinc-700">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-zinc-100">{member.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {member.email}{member.team ? ` | ${member.team}` : ""}{member.regionLabel ? ` | ${member.regionLabel}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">{member.role}</span>
                  <button type="button" className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50" onClick={() => void removeMember(id)} title="Remove collaborator">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          }) : <p className="text-xs text-slate-400">No collaborators invited yet.</p>}
        </div>
      </div>
    </Dialog>
  );
}

export function useCrmModalCollections(collections: Record<string, CrmCollection>) {
  return useMemo(() => collections, [collections]);
}
