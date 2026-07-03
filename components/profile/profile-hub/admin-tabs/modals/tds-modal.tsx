import { ActionButton } from "../../shared";

const overlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
const modalClass = "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl";

export type TdsFormData = {
  tdsDeductionAmount: string;
  tdsExempted: boolean;
};

export function TdsModal({
  member,
  data,
  saving,
  companyTdsPct,
  onDataChange,
  onCancel,
  onSave,
}: {
  member: { id?: string; name?: string } | null;
  data: TdsFormData;
  saving: boolean;
  companyTdsPct?: number;
  onDataChange: (data: TdsFormData) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!member) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h3 className="text-lg font-semibold text-slate-900">TDS Details</h3>
        <p className="mt-1 text-sm text-slate-500">
          Update TDS information for <strong>{String(member.name ?? "")}</strong>.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Monthly TDS Deduction (&#x20B9;)</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              type="number" min="0" placeholder={companyTdsPct && companyTdsPct > 0 ? `Leave 0 to use company ${companyTdsPct}%` : "Set fixed monthly TDS amount"}
              value={data.tdsDeductionAmount}
              onChange={(e) => onDataChange({ ...data, tdsDeductionAmount: e.target.value })} />
            <p className="mt-1 text-xs text-slate-400">
              {companyTdsPct && companyTdsPct > 0
                ? `Set a fixed monthly TDS amount. Leave 0 to use company rate of ${companyTdsPct}% of gross salary.`
                : "Set a fixed monthly TDS amount. Company TDS rate not configured."}
            </p>
          </div>
          <hr className="border-slate-100" />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={data.tdsExempted} onChange={(e) => onDataChange({ ...data, tdsExempted: e.target.checked })} className="rounded border-slate-300 text-slate-900" />
            <span className="text-sm text-slate-700">Exempt from TDS deduction</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onCancel} type="button">Cancel</ActionButton>
          <ActionButton variant="primary" disabled={saving}
            onClick={() => onSave()} type="button">
            {saving ? "Saving..." : "Save details"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
