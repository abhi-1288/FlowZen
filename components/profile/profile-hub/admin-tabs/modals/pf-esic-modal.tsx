import { ActionButton } from "../../shared";

const overlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
const modalClass = "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl";

export type PfEsicFormData = {
  pfNumber: string;
  pfDeductionAmount: string;
  esicNumber: string;
  esicDeductionAmount: string;
  pfExempted: boolean;
  esicExempted: boolean;
};

export function PfEsicModal({
  member,
  data,
  saving,
  onDataChange,
  onCancel,
  onSave,
}: {
  member: { id?: string; name?: string } | null;
  data: PfEsicFormData;
  saving: boolean;
  onDataChange: (data: PfEsicFormData) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!member) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h3 className="text-lg font-semibold text-slate-900">PF & ESIC Details</h3>
        <p className="mt-1 text-sm text-slate-500">
          Update PF and ESIC information for <strong>{String(member.name ?? "")}</strong>.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">PF Account Number</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" type="text" placeholder="Enter PF number" value={data.pfNumber} onChange={(e) => onDataChange({ ...data, pfNumber: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">PF Monthly Deduction (&#x20B9;)</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" type="number" min="0" placeholder="Leave empty to use company %" value={data.pfDeductionAmount} onChange={(e) => onDataChange({ ...data, pfDeductionAmount: e.target.value })} />
          </div>
          <hr className="border-slate-100" />
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">ESIC Account Number</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" type="text" placeholder="Enter ESIC number" value={data.esicNumber} onChange={(e) => onDataChange({ ...data, esicNumber: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">ESIC Monthly Deduction (&#x20B9;)</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" type="number" min="0" placeholder="Leave empty to use company %" value={data.esicDeductionAmount} onChange={(e) => onDataChange({ ...data, esicDeductionAmount: e.target.value })} />
          </div>
          <hr className="border-slate-100" />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={data.pfExempted} onChange={(e) => onDataChange({ ...data, pfExempted: e.target.checked })} className="rounded border-slate-300 text-slate-900" />
            <span className="text-sm text-slate-700">Exempt from PF deduction</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={data.esicExempted} onChange={(e) => onDataChange({ ...data, esicExempted: e.target.checked })} className="rounded border-slate-300 text-slate-900" />
            <span className="text-sm text-slate-700">Exempt from ESIC deduction</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onCancel} type="button">Cancel</ActionButton>
          <ActionButton variant="primary" disabled={saving} onClick={() => onSave()} type="button">{saving ? "Saving..." : "Save details"}</ActionButton>
        </div>
      </div>
    </div>
  );
}
