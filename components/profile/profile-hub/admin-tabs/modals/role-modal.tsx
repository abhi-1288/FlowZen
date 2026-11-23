import { UserCog } from "lucide-react";
import { ActionButton } from "../../shared";
import { MemberActionModal } from "./member-action-modal";

export function RoleModal({
  member,
  newRoleValue,
  isSeniorSecurityChecked,
  saving,
  onRoleChange,
  onIsSeniorSecurityChange,
  onCancel,
  onSave,
}: {
  member: { id?: string; name?: string } | null;
  newRoleValue: string;
  isSeniorSecurityChecked?: boolean;
  saving: boolean;
  onRoleChange: (role: string) => void;
  onIsSeniorSecurityChange?: (checked: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!member) return null;

  return (
    <MemberActionModal title="Change role" icon={<UserCog size={15} />}>
      <p className="text-xs text-slate-500">
        Change role for <strong>{String(member.name ?? "")}</strong>.
      </p>
      <select
        className="mt-4 w-full rounded-md neu-inset px-3 py-1.5 text-xs"
        value={newRoleValue}
        onChange={(e) => onRoleChange(e.target.value)}
      >
        <option value="employee">Employee</option>
        <option value="project-manager">Project Manager</option>
        <option value="qa-tester">QA Tester</option>
        <option value="human-resource">Human Resource</option>
        <option value="finance">Finance</option>
        <option value="security">Security</option>
        <option value="admin">Admin</option>
        <option value="it-admin">IT Admin</option>
        <option value="it-administration">IT Administration</option>
        <option value="warehouse">Warehouse</option>
        <option value="others">Others</option>
      </select>
      {newRoleValue === "security" && onIsSeniorSecurityChange ? (
        <label className="mt-3 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            checked={!!isSeniorSecurityChecked}
            onChange={(e) => onIsSeniorSecurityChange(e.target.checked)}
          />
          <span className="text-sm text-slate-700">Senior Security</span>
        </label>
      ) : null}
      <div className="mt-5 flex justify-end gap-3">
        <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={onCancel} type="button">Cancel</ActionButton>
        <ActionButton variant="primary" className="px-3 py-1.5 text-xs" disabled={saving || !newRoleValue} onClick={() => onSave()} type="button">
          {saving ? "Saving..." : "Save role"}
        </ActionButton>
      </div>
    </MemberActionModal>
  );
}