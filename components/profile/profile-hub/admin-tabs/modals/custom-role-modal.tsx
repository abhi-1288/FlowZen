import { Tag } from "lucide-react";
import { ActionButton } from "../../shared";
import { MemberActionModal } from "./member-action-modal";

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
    <MemberActionModal title="Change custom role" icon={<Tag size={15} />}>
      <p className="text-xs text-slate-500">
        Set a custom role label for <strong>{String(member.name ?? "")}</strong>.
      </p>
      <input
        className="mt-4 w-full rounded-md border border-[var(--c-border-light)] px-3 py-1.5 text-xs"
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
        <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={onCancel} type="button">Cancel</ActionButton>
        <ActionButton variant="primary" className="px-3 py-1.5 text-xs" disabled={saving || !String(customRoleInput ?? "").trim()} onClick={() => onSave()} type="button">
          {saving ? "Saving..." : "Save role"}
        </ActionButton>
      </div>
    </MemberActionModal>
  );
}
