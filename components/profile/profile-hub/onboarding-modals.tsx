import { Building2, Camera, Clipboard, Trash2, Users, X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Quit company (HR)</h4>
            <p className="mt-1 text-sm text-slate-500">Select replacement HR before submitting quit request.</p>
          </div>
          <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase text-slate-500">Replacement HR</label>
          <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={selectedHrId} onChange={(e) => onSelectHr(e.target.value)}>
            <option value="">Select HR</option>
            {candidates.map((member) => (
              <option key={String(member.id)} value={String(member.id)}>{String(member.name ?? "HR")} ({String(member.email ?? "")})</option>
            ))}
          </select>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" type="button" onClick={onClose}>Cancel</button>
          <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!selectedHrId || loading} type="button" onClick={() => void onConfirm()}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Quit company ({formatRole(role, isSeniorSecurity)})</h4>
            <p className="mt-1 text-sm text-slate-500">Assign another approved {formatRole(role, isSeniorSecurity)} before quitting.</p>
          </div>
          <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase text-slate-500">Replacement</label>
          <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={selectedUserId} onChange={(e) => onSelectUser(e.target.value)}>
            <option value="">Select replacement</option>
            {candidates.map((member) => (
              <option key={String(member.id)} value={String(member.id)}>{String(member.name ?? "Member")} ({String(member.email ?? "")})</option>
            ))}
          </select>
          {candidates.length === 0 ? <p className="mt-2 text-xs text-amber-700">No approved replacement available with this role.</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" type="button" onClick={onClose}>Cancel</button>
          <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!selectedUserId || loading} type="button" onClick={() => void onConfirm()}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Cancel quit request</h4>
            <p className="mt-1 text-sm text-slate-500">Tell the approver why you are cancelling this request.</p>
          </div>
          <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <textarea className="mt-4 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Reason for cancelling quit request" value={reason} onChange={(event) => onReasonChange(event.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" type="button" onClick={onClose}>Keep request</button>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!reason.trim() || loading} type="button" onClick={() => void onConfirm()}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold">Cancel join request</h4>
            <p className="mt-1 text-sm text-slate-500">Type CANCEL to confirm you want to remove this pending join request.</p>
          </div>
          <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <input className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase" placeholder="Type CANCEL" value={confirmText} onChange={(event) => onTextChange(event.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" type="button" onClick={onClose}>Keep request</button>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={confirmText.trim().toUpperCase() !== "CANCEL" || loading} type="button" onClick={() => void onConfirm()}>
            {loading ? "Cancelling..." : "Cancel Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeamEmployeesModal({
  team,
  selfId,
  onClose,
  onKick,
  onDeleteTeam,
  showToast,
}: {
  team: AnyRecord | null;
  selfId: string;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{String(team.name)} employees</h3>
          <div className="flex items-center gap-2">
            {String(team.managerId ?? "") === selfId ? (
              <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50" onClick={() => onDeleteTeam(String(team.id), String(team.name ?? "Team"))} type="button">Delete Team</button>
            ) : null}
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={onClose}>Close</button>
          </div>
        </div>
        {(joinCode || otherJoinCode) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {joinCode && (
              <div>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Team code</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">{joinCode}</p>
                    <button type="button" title="Copy code"
                      className="shrink-0 grid h-7 w-7 place-items-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Others code</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">{otherJoinCode}</p>
                    <button type="button" title="Copy code"
                      className="shrink-0 grid h-7 w-7 place-items-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
              <div key={String(emp.id)} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{String(emp.name ?? "Employee")}</p>
                  <p className="text-xs text-slate-500">{String(emp.email ?? "")}</p>
                </div>
                <button type="button" className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50" onClick={() => onKick(String(team.id), String(emp.id), String(emp.name ?? "Employee"), String(team.name ?? "Team"))}>Kick</button>
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
}: {
  data: { teamId: string; employeeId: string; employeeName: string; teamName: string } | null;
  confirmText: string;
  onTextChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-slate-900">Kick employee {data.employeeName}?</h3>
        <p className="mt-2 text-sm text-slate-600">This action cannot be undone.<br />Type <span className="font-semibold text-rose-600">KICK</span> to confirm.</p>
        <input className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Type KICK" value={confirmText} onChange={(event) => onTextChange(event.target.value)} />
        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={onClose} type="button">Cancel</button>
          <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={confirmText !== "KICK"} onClick={onConfirm} type="button">Confirm kick</button>
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
}: {
  data: { teamId: string; teamName: string } | null;
  confirmText: string;
  onTextChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-slate-900">Delete team {data.teamName}?</h3>
        <p className="mt-2 text-sm text-slate-600">All employees will be removed from this team immediately.<br />Type <span className="font-semibold text-rose-600">DELETE</span> to confirm.</p>
        <input className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Type DELETE" value={confirmText} onChange={(event) => onTextChange(event.target.value)} />
        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={onClose} type="button">Cancel</button>
          <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={confirmText !== "DELETE"} onClick={onConfirm} type="button">Delete team</button>
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
  address,
  onAddressChange,
  onAddressSave,
  addressSaving,
}: {
  company: AnyRecord | null;
  uploading: boolean;
  onUpload: () => void;
  onDelete: () => void;
  onCropDone: (blob: Blob) => Promise<void>;
  onCropCancel: () => void;
  cropFile: File | null;
  address: string;
  onAddressChange: (v: string) => void;
  onAddressSave: () => Promise<void>;
  addressSaving: boolean;
}) {
  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={18} />
          <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">Company Settings</h3>
        </div>
        <div className="flex items-center gap-4">
          <img src={company?.icon ? String(company.icon) : "/Logos/logo.jpg"} alt="Company icon" className="h-16 w-16 rounded-xl border border-slate-200 object-cover" />
          {company?.icon ? (
            <button aria-label="Delete company icon" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-medium text-rose-500 hover:bg-rose-50 hover:text-rose-700" onClick={onDelete} type="button">
              <Trash2 size={16} /> Delete Icon
            </button>
          ) : (
            <>
              {uploading ? <span className="text-sm text-slate-500">Uploading...</span> : (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Camera size={16} /> Upload icon
                  <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onCropDone(file as unknown as Blob); e.target.value = ""; }} type="file" />
                </label>
              )}
            </>
          )}
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Company Address</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 min-h-[80px] resize-y"
            placeholder="Enter company address"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
          />
          <button
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={addressSaving}
            onClick={() => void onAddressSave()}
            type="button"
          >
            {addressSaving ? "Saving..." : "Save Address"}
          </button>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h4 className="text-lg font-semibold">{title}</h4>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={onClose}>Cancel</button>
          <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={loading} onClick={() => void onConfirm()}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
