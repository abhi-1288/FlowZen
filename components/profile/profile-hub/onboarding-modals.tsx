import { useState } from "react";
import { Building2, Camera, Clipboard, Trash2, Users, X, Phone, Mail, Plus, Trash } from "lucide-react";
import { ImageCropModal } from "./image-crop-modal";
import { AnyRecord, formatRole } from "./shared";

export function HrQuitModal({
  open,
  candidates,
  selectedHrId,
  onSelectHr,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  candidates: AnyRecord[];
  selectedHrId: string;
  onSelectHr: (id: string) => void;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl neu-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Quit company (HR)</h4>
            <p className="mt-1 text-sm text-slate-500">Select replacement HR before submitting quit request.</p>
          </div>
          <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 dark:bg-zinc-800/60" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase text-slate-500">Replacement HR</label>
          <select className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm" value={selectedHrId} onChange={(e) => onSelectHr(e.target.value)}>
            <option value="">Select HR</option>
            {candidates.map((member) => (
              <option key={String(member.id)} value={String(member.id)}>{String(member.name ?? "HR")} ({String(member.email ?? "")})</option>
            ))}
          </select>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm" type="button" onClick={onClose}>Cancel</button>
          <button className="neu-btn neu-btn-danger rounded-lg px-4 py-2 text-sm font-medium" disabled={!selectedHrId || loading} type="button" onClick={() => void onConfirm()}>
            {loading ? "Submitting..." : "Submit quit request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoleQuitModal({
  open,
  role,
  isSeniorSecurity,
  candidates,
  selectedUserId,
  onSelectUser,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  role: string;
  isSeniorSecurity?: boolean;
  candidates: AnyRecord[];
  selectedUserId: string;
  onSelectUser: (id: string) => void;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl neu-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Quit company ({formatRole(role, isSeniorSecurity)})</h4>
            <p className="mt-1 text-sm text-slate-500">Assign another approved {formatRole(role, isSeniorSecurity)} before quitting.</p>
          </div>
          <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 dark:bg-zinc-800/60" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase text-slate-500">Replacement</label>
          <select className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm" value={selectedUserId} onChange={(e) => onSelectUser(e.target.value)}>
            <option value="">Select replacement</option>
            {candidates.map((member) => (
              <option key={String(member.id)} value={String(member.id)}>{String(member.name ?? "Member")} ({String(member.email ?? "")})</option>
            ))}
          </select>
          {candidates.length === 0 ? <p className="mt-2 text-xs text-amber-700">No approved replacement available with this role.</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm" type="button" onClick={onClose}>Cancel</button>
          <button className="neu-btn neu-btn-danger rounded-lg px-4 py-2 text-sm font-medium" disabled={!selectedUserId || loading} type="button" onClick={() => void onConfirm()}>
            {loading ? "Submitting..." : "Submit quit request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CancelQuitModal({
  open,
  reason,
  onReasonChange,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl neu-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Cancel quit request</h4>
            <p className="mt-1 text-sm text-slate-500">Tell the approver why you are cancelling this request.</p>
          </div>
          <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 dark:bg-zinc-800/60" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <textarea className="mt-4 min-h-28 w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm" placeholder="Reason for cancelling quit request" value={reason} onChange={(event) => onReasonChange(event.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm" type="button" onClick={onClose}>Keep request</button>
          <button className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-sm font-medium" disabled={!reason.trim() || loading} type="button" onClick={() => void onConfirm()}>
            {loading ? "Cancelling..." : "Cancel Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CancelJoinModal({
  open,
  confirmText,
  onTextChange,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  confirmText: string;
  onTextChange: (v: string) => void;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl neu-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Cancel join request</h4>
            <p className="mt-1 text-sm text-slate-500">Type CANCEL to confirm you want to remove this pending join request.</p>
          </div>
          <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 dark:bg-zinc-800/60" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <input className="mt-4 w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm uppercase" placeholder="Type CANCEL" value={confirmText} onChange={(event) => onTextChange(event.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm" type="button" onClick={onClose}>Keep request</button>
          <button className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-sm font-medium" disabled={confirmText.trim().toUpperCase() !== "CANCEL" || loading} type="button" onClick={() => void onConfirm()}>
            {loading ? "Cancelling..." : "Cancel Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeamEmployeesModal({
  team,
  canDelete,
  busy,
  onClose,
  onKick,
  onDeleteTeam,
  showToast,
}: {
  team: AnyRecord | null;
  canDelete: boolean;
  busy?: boolean;
  onClose: () => void;
  onKick: (teamId: string, employeeId: string, employeeName: string, teamName: string) => void;
  onDeleteTeam: (teamId: string, teamName: string) => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  if (!team) return null;
  const joinCode = String(team.joinCode ?? "");
  const otherJoinCode = String(team.otherJoinCode ?? "");
  const makeJoinUrl = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : code;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{String(team.name)} employees</h3>
          <div className="flex items-center gap-2">
            {canDelete ? (
              <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(busy)} onClick={() => onDeleteTeam(String(team.id), String(team.name ?? "Team"))} type="button">Delete Team</button>
            ) : null}
            <button className="rounded-lg border border-[var(--c-border-light)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(busy)} onClick={onClose}>Close</button>
          </div>
        </div>
        {(joinCode || otherJoinCode) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {joinCode && (
              <div>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:bg-zinc-800/60 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Team code</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">{joinCode}</p>
                    <button type="button" title="Copy code"
                      className="shrink-0 grid h-7 w-7 place-items-center rounded neu-card text-slate-600 hover:bg-slate-50 dark:bg-zinc-800/60"
                      onClick={() => { navigator.clipboard.writeText(joinCode); showToast("Team code copied."); }}>
                      <Clipboard size={14} />
                    </button>
                  </div>
                </div>
                <button type="button"
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-sky-200"
                  onClick={() => { navigator.clipboard.writeText(makeJoinUrl(joinCode)); showToast("Team join URL copied."); }}>
                  <Users size={14} /> Copy Join URL
                </button>
              </div>
            )}
            {otherJoinCode && (
              <div>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:bg-zinc-800/60 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Others code</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">{otherJoinCode}</p>
                    <button type="button" title="Copy code"
                      className="shrink-0 grid h-7 w-7 place-items-center rounded neu-card text-slate-600 hover:bg-slate-50 dark:bg-zinc-800/60"
                      onClick={() => { navigator.clipboard.writeText(otherJoinCode); showToast("Others code copied."); }}>
                      <Clipboard size={14} />
                    </button>
                  </div>
                </div>
                <button type="button"
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-sky-200"
                  onClick={() => { navigator.clipboard.writeText(makeJoinUrl(otherJoinCode)); showToast("Others join URL copied."); }}>
                  <Users size={14} /> Copy Join URL
                </button>
              </div>
            )}
          </div>
        )}
        <div className="mt-4 border border-gray-200 rounded-lg p-2 overflow-y-auto max-h-80 space-y-2">
          {Array.isArray(team.employees) && team.employees.length > 0 ? (
            (team.employees as AnyRecord[]).map((emp) => (
              <div key={String(emp.id)} className="flex items-center justify-between rounded-lg border border-[var(--c-border-light)] px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{String(emp.name ?? "Employee")}</p>
                  <p className="text-xs text-slate-500">{String(emp.email ?? "")}</p>
                </div>
                <button type="button" className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(busy)} onClick={() => onKick(String(team.id), String(emp.id), String(emp.name ?? "Employee"), String(team.name ?? "Team"))}>Kick</button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No employees in this team.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function KickModal({
  data,
  confirmText,
  onTextChange,
  onClose,
  onConfirm,
  loading,
}: {
  data: { teamId: string; employeeId: string; employeeName: string; teamName: string } | null;
  confirmText: string;
  onTextChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center neu-overlay p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-slate-900">Kick employee {data.employeeName}?</h3>
        <p className="mt-2 text-sm text-slate-600">This action cannot be undone.<br />Type <span className="font-semibold text-rose-600">KICK</span> to confirm.</p>
        <input className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Type KICK" value={confirmText} onChange={(event) => onTextChange(event.target.value)} />
        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(loading)} onClick={onClose} type="button">Cancel</button>
          <button className="neu-btn neu-btn-danger rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed" disabled={Boolean(loading) || confirmText !== "KICK"} onClick={onConfirm} type="button">{loading ? "Removing..." : "Confirm kick"}</button>
        </div>
      </div>
    </div>
  );
}

export function DeleteTeamModal({
  data,
  confirmText,
  onTextChange,
  onClose,
  onConfirm,
  loading,
}: {
  data: { teamId: string; teamName: string } | null;
  confirmText: string;
  onTextChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center neu-overlay p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-slate-900">Delete team {data.teamName}?</h3>
        <p className="mt-2 text-sm text-slate-600">All employees will be removed from this team immediately.<br />Type <span className="font-semibold text-rose-600">DELETE</span> to confirm.</p>
        <input className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Type DELETE" value={confirmText} onChange={(event) => onTextChange(event.target.value)} />
        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(loading)} onClick={onClose} type="button">Cancel</button>
          <button className="neu-btn neu-btn-danger rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed" disabled={Boolean(loading) || confirmText !== "DELETE"} onClick={onConfirm} type="button">{loading ? "Deleting..." : "Delete team"}</button>
        </div>
      </div>
    </div>
  );
}

export function CompanyIconSection({
  company,
  uploading,
  onUpload,
  onDelete,
  onCropDone,
  onCropCancel,
  cropFile,
  addrLabel,
  addrLine1,
  addrCity,
  addrState,
  addrZip,
  addrCountry,
  onAddrLabelChange,
  onAddrLine1Change,
  onAddrCityChange,
  onAddrStateChange,
  onAddrZipChange,
  onAddrCountryChange,
  onAddressSave,
  addressSaving,
  hrOptions,
  selectedMainHrId,
  onMainHrIdChange,
  contacts,
  onContactsChange,
}: {
  company: AnyRecord | null;
  uploading: boolean;
  onUpload: () => void;
  onDelete: () => void;
  onCropDone: (blob: Blob) => Promise<void>;
  onCropCancel: () => void;
  cropFile: File | null;
  addrLabel: string;
  addrLine1: string;
  addrCity: string;
  addrState: string;
  addrZip: string;
  addrCountry: string;
  onAddrLabelChange: (v: string) => void;
  onAddrLine1Change: (v: string) => void;
  onAddrCityChange: (v: string) => void;
  onAddrStateChange: (v: string) => void;
  onAddrZipChange: (v: string) => void;
  onAddrCountryChange: (v: string) => void;
  onAddressSave: () => Promise<void>;
  addressSaving: boolean;
  hrOptions: { id: string; name: string; email?: string }[];
  selectedMainHrId: string;
  onMainHrIdChange: (v: string) => void;
  contacts: { name: string; phone: string; email: string; isPrimary: boolean }[];
  onContactsChange: (contacts: { name: string; phone: string; email: string; isPrimary: boolean }[]) => void;
}) {
  return (
    <>
      <section className="rounded-xl neu-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={18} />
          <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">Company Settings</h3>
        </div>
        <div className="flex items-center gap-4">
          <img src={company?.icon ? String(company.icon) : "/Logos/logo.jpg"} alt="Company icon" className="h-16 w-16 rounded-xl border border-[var(--c-border-light)] object-cover" />
          {company?.icon ? (
            <button aria-label="Delete company icon" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-medium text-rose-500 hover:bg-rose-50 hover:text-rose-700" onClick={onDelete} type="button">
              <Trash2 size={16} /> Delete Icon
            </button>
          ) : (
            <>
              {uploading ? <span className="text-sm text-slate-500">Uploading...</span> : (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:bg-zinc-800/60">
                  <Camera size={16} /> Upload icon
                  <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onCropDone(file as unknown as Blob); e.target.value = ""; }} type="file" />
                </label>
              )}
            </>
          )}
        </div>
        <div className="mt-5 border-t border-[var(--c-border-light)] pt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Company Address</label>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Region / Office Name *</label>
              <input
                type="text"
                className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Haldwani Office, North India Branch"
                value={addrLabel}
                onChange={(e) => onAddrLabelChange(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Address Line 1 *</label>
              <input
                type="text"
                className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Street, building"
                value={addrLine1}
                onChange={(e) => onAddrLine1Change(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">City</label>
                <input
                  type="text"
                  className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="City"
                  value={addrCity}
                  onChange={(e) => onAddrCityChange(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">State</label>
                <input
                  type="text"
                  className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="State"
                  value={addrState}
                  onChange={(e) => onAddrStateChange(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">ZIP / Postal Code</label>
                <input
                  type="text"
                  className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="ZIP"
                  value={addrZip}
                  onChange={(e) => onAddrZipChange(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Country</label>
                <input
                  type="text"
                  className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="Country"
                  value={addrCountry}
                  onChange={(e) => onAddrCountryChange(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Users size={13} /> HR Head for this region
              </label>
              {hrOptions.length > 0 ? (
                <select
                  className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                  value={selectedMainHrId}
                  onChange={(e) => onMainHrIdChange(e.target.value)}
                >
                  <option value="">Assign later (warning until assigned)</option>
                  {hrOptions.map((hr) => (
                    <option key={hr.id} value={hr.id}>{hr.name}{hr.email ? ` (${hr.email})` : ""}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  readOnly
                  className="neu-inset w-full rounded-lg px-3 py-2 text-sm text-slate-400"
                  value="No HR has joined yet — you can assign an HR Head later from Office Address Management."
                />
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Users size={13} /> Office Contacts (1-5)
                </label>
                <button
                  type="button"
                  disabled={contacts.length >= 5}
                  onClick={() => onContactsChange([...contacts, { name: "", phone: "", email: "", isPrimary: contacts.length === 0 }])}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border-light)] px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={12} /> Add Contact
                </button>
              </div>
              <div className="space-y-2">
                {contacts.map((contact, index) => (
                  <div key={index} className="rounded-lg border border-[var(--c-border-light)] p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="mb-1 block text-xs font-medium text-slate-500">Contact Name *</label>
                        <input
                          type="text"
                          className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                          placeholder="Contact person name"
                          value={contact.name}
                          onChange={(e) => {
                            const next = [...contacts];
                            next[index] = { ...next[index], name: e.target.value };
                            onContactsChange(next);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={14} /></span>
                          <input
                            type="tel"
                            className="neu-inset w-full rounded-lg px-3 py-2 text-sm pl-8"
                            placeholder="+91 98765 43210"
                            value={contact.phone}
                            onChange={(e) => {
                              const next = [...contacts];
                              next[index] = { ...next[index], phone: e.target.value };
                              onContactsChange(next);
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Mail size={14} /></span>
                          <input
                            type="email"
                            className="neu-inset w-full rounded-lg px-3 py-2 text-sm pl-8"
                            placeholder="contact@company.com"
                            value={contact.email}
                            onChange={(e) => {
                              const next = [...contacts];
                              next[index] = { ...next[index], email: e.target.value };
                              onContactsChange(next);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={contact.isPrimary}
                          onChange={(e) => {
                            const next = contacts.map((c, i) => ({
                              ...c,
                              isPrimary: i === index ? e.target.checked : false,
                            }));
                            onContactsChange(next);
                          }}
                          className="accent-indigo-600"
                        />
                        <span>Primary contact</span>
                      </label>
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onContactsChange(contacts.filter((_, i) => i !== index))}
                          className="text-xs text-rose-600 hover:text-rose-700"
                        >
                          <Trash size={12} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400">Minimum 1, maximum 5 contacts. Primary contact will be shown on ID cards.</p>
            </div>
            <button
              className="neu-btn neu-btn-primary mt-1 inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium"
              disabled={addressSaving}
              onClick={() => void onAddressSave()}
              type="button"
            >
              {addressSaving ? "Saving..." : "Save Address"}
            </button>
          </div>
        </div>
      </section>
      {cropFile ? <ImageCropModal file={cropFile} aspect={1} onCancel={onCropCancel} onDone={(blob) => void onCropDone(blob)} /> : null}
    </>
  );
}

export function DeleteConfirmModal({
  open,
  title,
  description,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <h4 className="text-lg font-semibold">{title}</h4>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm" onClick={onClose}>Cancel</button>
          <button className="neu-btn neu-btn-danger rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed" disabled={loading} onClick={() => void onConfirm()}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type DepartmentApproverOption = { id: string; name: string; label: string };

/** Create-department form, opened from the "Create Department" button. */
export function DepartmentModal({
  open,
  loading,
  name,
  reason,
  approverId,
  approvers,
  mode,
  routingReason,
  routingLoading,
  onNameChange,
  onReasonChange,
  onApproverChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  name: string;
  reason: string;
  approverId: string;
  approvers: DepartmentApproverOption[];
  mode: "approve" | "direct";
  routingReason: string;
  routingLoading: boolean;
  onNameChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onApproverChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl neu-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Create Department</h4>
            <p className="mt-1 text-sm text-slate-500">Choose who approves it; once approved you become the department head.</p>
          </div>
          <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="Close" type="button"><X size={18} /></button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">Department Name</label>
            <input className="neu-inset mt-1 w-full rounded-md px-3 py-2 text-sm" type="text" placeholder="e.g. Engineering, Marketing, Operations" value={name} onChange={(e) => onNameChange(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">Reason</label>
            <textarea className="neu-inset mt-1 h-24 w-full rounded-md px-3 py-2 text-sm" placeholder="Why is this department needed?" value={reason} onChange={(e) => onReasonChange(e.target.value)} />
          </div>
          <div>
            {routingLoading ? (
              <p className="text-sm text-slate-500">Loading approvers...</p>
            ) : mode === "direct" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                <p className="font-medium">No approval needed</p>
                <p className="mt-0.5 text-xs">{routingReason || "You are the admin head of this region. The department will be created directly."}</p>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">Send approval to</label>
                <select className="neu-inset mt-1 w-full rounded-md px-3 py-2 text-sm" value={approverId} onChange={(e) => onApproverChange(e.target.value)} disabled={approvers.length === 0}>
                  <option value="">— Select approver —</option>
                  {approvers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                {routingReason ? <p className="mt-1 text-xs text-slate-500">{routingReason}</p> : null}
                {approvers.length === 0 ? <p className="mt-1 text-xs text-amber-600">No approver available. Ask an admin to assign a region head first.</p> : null}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="neu-btn neu-btn-secondary rounded-lg px-3 py-1.5 text-sm" onClick={onClose} type="button">Cancel</button>
          <button className="neu-btn neu-btn-primary rounded-lg px-3 py-1.5 text-sm" disabled={loading || routingLoading} onClick={onSubmit} type="button">
            {loading ? "Working..." : mode === "direct" ? "Create Department" : "Request Department"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type DepartmentInfo = {
  name: string;
  head: string;
  headId: string;
  createdAt: string | null;
  memberCount: number;
  members?: { id: string; name: string; email?: string; role: string }[];
  canRequestDelete?: boolean;
  canAssignTeam?: boolean;
  teamId?: string;
  teamName?: string;
  canCancel?: boolean;
  deleteRequestId?: string;
  deleteState: {
    status: string;
    requestedBy: string;
    reason: string;
    acceptedAt: string | null;
    deleteAt: string | null;
    cancelDeadline: string | null;
    deletedAt: string | null;
  } | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Details shown when a department name is clicked. */
export function DepartmentDetailsModal({
  data,
  canRequestDelete,
  canAssignTeam,
  canCancel,
  cancelLoading,
  onClose,
  onDelete,
  onCancel,
  onAssignTeam,
  onViewMembers,
}: {
  data: DepartmentInfo | null;
  canRequestDelete: boolean;
  canAssignTeam: boolean;
  canCancel: boolean;
  cancelLoading: boolean;
  onClose: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onAssignTeam: () => void;
  onViewMembers: () => void;
}) {
  if (!data) return null;
  const state = data.deleteState;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-xl neu-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">{data.name}</h4>
            <p className="mt-1 text-sm text-slate-500">Department details</p>
          </div>
          <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="Close" type="button"><X size={18} /></button>
        </div>

        <div className="mt-4 space-y-2 rounded-lg border border-[var(--c-border-light)] p-4 text-sm">
          <p><span className="text-slate-500">Created:</span> {formatDate(data.createdAt)}</p>
          <p><span className="text-slate-500">Department head:</span> {data.head || "—"}</p>
          <p>
            <span className="text-slate-500">Total members:</span>{" "}
            <button className="font-medium text-emerald-700 underline underline-offset-2" onClick={onViewMembers} type="button">
              {data.memberCount} (view list)
            </button>
          </p>
          <p><span className="text-slate-500">Team:</span> {data.teamName || "Not assigned yet"}</p>
        </div>

        {canAssignTeam ? (
          <button className="mt-3 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700" onClick={onAssignTeam} type="button">
            {data.teamName ? "Change assigned team" : "Assign a team"}
          </button>
        ) : null}

        {state ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">Deletion {state.status === "approved" ? "scheduled" : state.status === "hr-approved" ? "awaiting admin head" : "awaiting HR head"}</p>
            {state.requestedBy ? <p className="mt-1 text-xs">Requested by {state.requestedBy}.</p> : null}
            {state.reason ? <p className="mt-0.5 text-xs">Reason: {state.reason}</p> : null}
            {state.deleteAt ? <p className="mt-0.5 text-xs">Will be deleted on {formatDate(state.deleteAt)}.</p> : null}
            {state.cancelDeadline ? <p className="mt-0.5 text-xs">Can be cancelled until {formatDate(state.cancelDeadline)}.</p> : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="neu-btn neu-btn-secondary rounded-lg px-3 py-1.5 text-sm" onClick={onClose} type="button">Close</button>
          {canCancel ? (
            <button className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700" disabled={cancelLoading} onClick={onCancel} type="button">
              {cancelLoading ? "Working..." : "Cancel scheduled deletion"}
            </button>
          ) : null}
          {canRequestDelete && !state ? (
            <button className="neu-btn neu-btn-danger rounded-lg px-3 py-1.5 text-sm" onClick={onDelete} type="button"><Trash2 size={14} className="inline" /> Delete Department</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The head picks an existing team or creates a new one for their department. */
export function DepartmentTeamModal({
  department,
  teams,
  loading,
  onClose,
  onAssign,
}: {
  department: string;
  teams: { id: string; name: string }[];
  loading: boolean;
  onClose: () => void;
  onAssign: (choice: { teamId?: string; teamName?: string }) => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">(teams.length ? "existing" : "new");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [teamName, setTeamName] = useState("");
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl neu-card p-5">
        <h4 className="text-lg font-semibold">Assign a team to "{department}"</h4>
        <p className="mt-1 text-sm text-slate-500">You are the department head. Use one of your teams or create a new one for this department.</p>
        <div className="mt-4 flex gap-2 text-sm">
          <button className={`rounded-lg px-3 py-1.5 ${mode === "existing" ? "neu-btn neu-btn-primary" : "neu-btn neu-btn-secondary"}`} onClick={() => setMode("existing")} disabled={teams.length === 0} type="button">Use existing team</button>
          <button className={`rounded-lg px-3 py-1.5 ${mode === "new" ? "neu-btn neu-btn-primary" : "neu-btn neu-btn-secondary"}`} onClick={() => setMode("new")} type="button">Create new team</button>
        </div>
        <div className="mt-4">
          {mode === "existing" ? (
            <>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">Your teams</label>
              <select className="neu-inset mt-1 w-full rounded-md px-3 py-2 text-sm" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">New team name</label>
              <input className="neu-inset mt-1 w-full rounded-md px-3 py-2 text-sm" placeholder="e.g. Engineering Team" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="neu-btn neu-btn-secondary rounded-lg px-3 py-1.5 text-sm" onClick={onClose} type="button">Cancel</button>
          <button
            className="neu-btn neu-btn-primary rounded-lg px-3 py-1.5 text-sm"
            disabled={loading || (mode === "existing" ? !teamId : !teamName.trim())}
            onClick={() => mode === "existing" ? onAssign({ teamId }) : onAssign({ teamName: teamName.trim() })}
            type="button"
          >
            {loading ? "Working..." : "Assign team"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Lists the members filed under a department. */
export function DepartmentMembersModal({
  department,
  members,
  onClose,
}: {
  department: string;
  members: { id: string; name: string; email?: string; role: string }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Members of "{department}"</h3>
          <button className="rounded-lg border border-[var(--c-border-light)] px-3 py-1.5 text-sm" onClick={onClose} type="button">Close</button>
        </div>
        <div className="mt-4 border border-gray-200 rounded-lg p-2 overflow-y-auto max-h-80 space-y-2">
          {members.length > 0 ? (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg border border-[var(--c-border-light)] px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{member.name || "Member"}</p>
                  {member.email ? <p className="text-xs text-slate-500">{member.email}</p> : null}
                </div>
                <span className="text-xs text-slate-500 capitalize">{member.role?.replace(/-/g, " ")}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No members in this department yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Typed confirmation for a department deletion request. */
export function DepartmentDeleteModal({
  department,
  confirmText,
  onTextChange,
  loading,
  onClose,
  onConfirm,
}: {
  department: string;
  confirmText: string;
  onTextChange: (value: string) => void;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center neu-overlay p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl neu-card p-5">
        <h4 className="text-lg font-semibold">Delete department "{department}"?</h4>
        <p className="mt-2 text-sm text-slate-600">
          This starts a deletion request that goes to the region's HR head, who forwards it to the admin head. If approved, the
          department and its team will be removed after 7 days, and the requester can cancel within
          4 days. The admin head, HR head, department head and all members will be notified.
        </p>
        <p className="mt-3 text-sm text-slate-600">Type <span className="font-semibold text-rose-600">DELETE</span> to confirm.</p>
        <input className="neu-inset mt-2 w-full rounded-md px-3 py-2 text-sm" placeholder="Type DELETE" value={confirmText} onChange={(e) => onTextChange(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="neu-btn neu-btn-secondary rounded-lg px-3 py-1.5 text-sm" onClick={onClose} type="button">Cancel</button>
          <button className="neu-btn neu-btn-danger rounded-lg px-3 py-1.5 text-sm" disabled={loading || confirmText !== "DELETE"} onClick={onConfirm} type="button">
            {loading ? "Working..." : "Request Deletion"}
          </button>
        </div>
      </div>
    </div>
  );
}
