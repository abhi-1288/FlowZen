import { ActionButton } from "../../shared";
import { currencySymbol } from "../helpers";

const overlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
const modalClass = "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl";

export function SalaryModal({
  member,
  salaryInput,
  salaryPeriodType,
  salaryCurrency,
  saving,
  onInputChange,
  onPeriodChange,
  onCurrencyChange,
  onCancel,
  onSave,
}: {
  member: { id?: string; name?: string } | null;
  salaryInput: string;
  salaryPeriodType: "monthly" | "yearly";
  salaryCurrency: string;
  saving: boolean;
  onInputChange: (value: string) => void;
  onPeriodChange: (period: "monthly" | "yearly") => void;
  onCurrencyChange: (currency: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!member) return null;

  const sym = currencySymbol(salaryCurrency);

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h3 className="text-lg font-semibold text-slate-900">Set base salary</h3>
        <p className="mt-1 text-sm text-slate-500">
          Set base salary for <strong>{String(member.name ?? "")}</strong>.
        </p>
        <div className="mt-4 flex gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
            value={salaryCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
          >
            <option value="INR">₹ INR</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
            <option value="GBP">£ GBP</option>
            <option value="JPY">¥ JPY</option>
          </select>
          <div className="flex flex-1 rounded-lg border border-slate-200 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${salaryPeriodType === "monthly" ? "bg-slate-950 text-white" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => onPeriodChange("monthly")}
            >
              Per Month
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${salaryPeriodType === "yearly" ? "bg-slate-950 text-white" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => onPeriodChange("yearly")}
            >
              Per Year
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-lg font-semibold text-slate-700">{sym}</span>
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            min={0}
            placeholder={salaryPeriodType === "monthly" ? "Monthly base salary" : "Yearly base salary"}
            type="number"
            value={salaryInput}
            onChange={(e) => onInputChange(e.target.value)}
          />
        </div>
        {Number(salaryInput) > 0 ? (
          <p className="mt-1.5 text-xs text-slate-500">
            {salaryPeriodType === "yearly"
              ? `≈${sym}${Math.round(Number(salaryInput) / 12).toLocaleString("en-IN")}/month`
              : `≈${sym}${(Number(salaryInput) * 12).toLocaleString("en-IN")}/year`}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onCancel} type="button">Cancel</ActionButton>
          <ActionButton variant="primary" disabled={saving || !(Number(salaryInput) > 0)} onClick={() => onSave()} type="button">
            {saving ? "Saving..." : "Save salary"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
