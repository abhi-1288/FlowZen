import { Card, SectionHeader } from "../../shared";
import type { PolicyData, SalaryCycleData } from "../types";

function ordinal(n: number): string {
  if (n === 0) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

export function PoliciesSection({
  policyData,
  foodOptedIn,
  travelOptedIn,
  actorRole,
  salaryCycle,
  onToggleOptInOut,
  onToggleAdvanceSalary,
}: {
  policyData: PolicyData | null;
  foodOptedIn: boolean;
  travelOptedIn: boolean;
  actorRole?: string;
  salaryCycle?: SalaryCycleData | null;
  onToggleOptInOut: (type: "food" | "travel", optedIn: boolean) => void;
  onToggleAdvanceSalary?: (enabled: boolean) => void;
}) {
  const canConfigure = actorRole === "finance" || actorRole === "admin";
  const showDeductions = policyData && (policyData.foodAmount > 0 || policyData.travelAccommodationAmount > 0);
  if (!policyData && !salaryCycle) return null;

  const startDay = salaryCycle?.salaryCycleStartDay;
  const endDay = salaryCycle?.salaryCycleEndDay;
  const cycleDay = salaryCycle?.salaryCycleDay ?? 29;
  const displayStartDay = startDay ?? (cycleDay > 1 ? cycleDay : null);
  const displayEndDay = endDay ?? (cycleDay > 1 ? cycleDay - 1 : null);

  return (
    <Card>
      <SectionHeader title="Company Policies" description="Payroll cycle, deductions, and advance salary settings." accent="amber" />
      <div className="mt-3 space-y-2">
        {salaryCycle ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Salary Cycle Period</p>
              <p className="text-xs text-slate-500">
                {displayStartDay && displayEndDay
                  ? `${displayStartDay}${ordinal(displayStartDay)} of previous month to ${displayEndDay}${ordinal(displayEndDay)} of current month`
                  : "1st to end of each month"}
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-700">
              {displayStartDay && displayEndDay
                ? `${displayStartDay}${ordinal(displayStartDay)}\u2013${displayEndDay}${ordinal(displayEndDay)}`
                : "1st\u2013End"}
            </span>
          </div>
        ) : null}
        {showDeductions ? (
          <>
            {policyData.foodAmount > 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">Food Allowance (&#x20B9;{policyData.foodAmount})</p>
                  <p className="text-xs text-slate-500">Fixed deduction from salary</p>
                </div>
                <div className="flex gap-2">
                  <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${foodOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => onToggleOptInOut("food", true)}>Active</button>
                  <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!foodOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => onToggleOptInOut("food", false)}>Opt Out</button>
                </div>
              </div>
            ) : null}
            {policyData.travelAccommodationAmount > 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">Travel Accommodation (&#x20B9;{policyData.travelAccommodationAmount})</p>
                  <p className="text-xs text-slate-500">Fixed deduction from salary</p>
                </div>
                <div className="flex gap-2">
                  <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${travelOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => onToggleOptInOut("travel", true)}>Active</button>
                  <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!travelOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => onToggleOptInOut("travel", false)}>Opt Out</button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        {policyData ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Advance Salary Requests</p>
              <p className="text-xs text-slate-500">Allow employees to request salary advances</p>
            </div>
            {canConfigure ? (
              <div className="flex gap-2">
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${policyData.advanceSalaryEnabled ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                  onClick={() => onToggleAdvanceSalary?.(true)}
                >
                  Enabled
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!policyData.advanceSalaryEnabled ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                  onClick={() => onToggleAdvanceSalary?.(false)}
                >
                  Disabled
                </button>
              </div>
            ) : (
              <span className={`rounded-lg px-3 py-1.5 text-xs font-medium ${policyData.advanceSalaryEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {policyData.advanceSalaryEnabled ? "Enabled" : "Disabled"}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
