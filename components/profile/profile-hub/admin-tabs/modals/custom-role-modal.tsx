import { ActionButton } from "../../shared";

const overlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4";
const modalClass = "w-full max-w-md rounded-xl bg-white p-5 shadow-xl";

export function CustomRoleModal({
  member,
  customRoleInput,
  otherRoleSelectOptions,
  saving,
  onInputChange,
  onCancel,
  onSave,
}: {
  member: { id?: string; name?: string } | null;
  customRoleInput: string;
  otherRoleSelectOptions: string[];
  saving: boolean;
  onInputChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!member) return null;

  const memberId = String(member.id ?? "");

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h3 className="text-sm font-semibold text-slate-900">Change custom role</h3>
        <p className="mt-1 text-xs text-slate-500">
          Set a custom role label for <strong>{String(member.name ?? "")}</strong>.
        </p>
        <input
          className="mt-4 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs"
          list={`custom-role-${memberId}`}
          placeholder="Select or enter custom role"
          type="text"
          value={customRoleInput}
          onChange={(e) => onInputChange(e.target.value)}
        />
        <datalist id={`custom-role-${memberId}`}>
          {otherRoleSelectOptions.map((option) => (
            <option key={option} value={option} />
          ))}
          {customRoleInput && !otherRoleSelectOptions.includes(customRoleInput) ? (
            <option value={customRoleInput} />
          ) : null}
        </datalist>
        <div className="mt-5 flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onCancel} type="button">Cancel</ActionButton>
          <ActionButton variant="primary" disabled={saving || !String(customRoleInput ?? "").trim()} onClick={() => onSave()} type="button">
            {saving ? "Saving..." : "Save role"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
