import { ActionButton } from "../../shared";

const overlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
const modalClass = "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl";

export function RoleModal({
  member,
  newRoleValue,
  saving,
  onRoleChange,
  onCancel,
  onSave,
}: {
  member: { id?: string; name?: string } | null;
  newRoleValue: string;
  saving: boolean;
  onRoleChange: (role: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!member) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h3 className="text-lg font-semibold text-slate-900">Change role</h3>
        <p className="mt-1 text-sm text-slate-500">
          Change role for <strong>{String(member.name ?? "")}</strong>.
        </p>
        <select
          className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
          value={newRoleValue}
          onChange={(e) => onRoleChange(e.target.value)}
        >
          <option value="employee">Employee</option>
          <option value="project-manager">Project Manager</option>
          <option value="qa-tester">QA Tester</option>
          <option value="human-resource">Human Resource</option>
          <option value="finance">Finance</option>
          <option value="admin">Admin</option>
          <option value="others">Others</option>
        </select>
        <div className="mt-5 flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onCancel} type="button">Cancel</ActionButton>
          <ActionButton variant="primary" disabled={saving || !newRoleValue} onClick={() => onSave()} type="button">
            {saving ? "Saving..." : "Save role"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
