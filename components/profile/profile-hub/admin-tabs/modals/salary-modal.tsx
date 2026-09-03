import { ActionButton } from "../../shared";
import { currencySymbol } from "../helpers";

const overlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4";
const modalClass = "w-full max-w-md rounded-xl bg-[var(--c-bg-elevated)] p-5 shadow-xl";

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
  salaryPeriodType: "monthly" | "yearly" | "hourly" | "daily";
  salaryCurrency: string;
  saving: boolean;
  onInputChange: (value: string) => void;
  onPeriodChange: (period: "monthly" | "yearly" | "hourly" | "daily") => void;
  onCurrencyChange: (currency: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!member) return null;

  const sym = currencySymbol(salaryCurrency);
  const periods: { id: "monthly" | "yearly" | "hourly" | "daily"; label: string; suffix: string }[] = [
    { id: "hourly", label: "Per Hour", suffix: "/hr" },
    { id: "daily", label: "Per Day", suffix: "/day" },
    { id: "monthly", label: "Per Month", suffix: "/mo" },
    { id: "yearly", label: "Per Year", suffix: "/yr" },
  ];

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h3 className="text-sm font-semibold text-slate-900">Set base salary</h3>
        <p className="mt-1 text-xs text-slate-500">
          Set salary for <strong>{String(member.name ?? "")}</strong>.
        </p>
        <div className="mt-4 flex gap-2">
          <select
            className="rounded-md neu-inset px-2 py-1.5 text-xs"
            value={salaryCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
          >
            <option value="INR">₹ INR</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
            <option value="GBP">£ GBP</option>
            <option value="JPY">¥ JPY</option>
          </select>
          <div className="flex flex-1 flex-wrap rounded-md border border-[var(--c-border-light)] p-1">
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`flex-1 min-w-[74px] rounded-md px-2 py-1.5 text-sm font-medium transition ${salaryPeriodType === p.id ? "neu-tab-pressed" : "text-slate-600 hover:text-slate-900"}`}
                onClick={() => onPeriodChange(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-lg font-semibold text-slate-700">{sym}</span>
          <input
            className="flex-1 rounded-md border border-[var(--c-border-light)] px-3 py-1.5 text-xs"
            min={0}
            placeholder={
              salaryPeriodType === "hourly"
                ? "Rate per hour"
                : salaryPeriodType === "daily"
                  ? "Rate per day"
                  : salaryPeriodType === "monthly"
                    ? "Monthly base salary"
                    : "Yearly base salary"
            }
            type="number"
            value={salaryInput}
            onChange={(e) => onInputChange(e.target.value)}
          />
        </div>
        {Number(salaryInput) > 0 && (
          <p className="mt-1.5 text-xs text-slate-500">
            {salaryPeriodType === "yearly"
              ? `≈${sym}${Math.round(Number(salaryInput) / 12).toLocaleString("en-IN")}/month`
              : salaryPeriodType === "monthly"
                ? `≈${sym}${(Number(salaryInput) * 12).toLocaleString("en-IN")}/year`
                : `${sym}${Number(salaryInput).toLocaleString("en-IN")}${salaryPeriodType === "hourly" ? "/hr" : "/day"}`}
          </p>
        )}
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
