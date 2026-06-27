import { type FormEvent } from "react";
import { ActionButton, SectionHeader, formatRoleWithCustom } from "../../shared";
import type { AnyRecord } from "../../shared";
import type { SalaryBreakdown } from "../types";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]";

export function SalaryWizardSection({
  actorRole,
  salaryStep,
  salaryPeriod,
  salaryEmployeeId,
  salaryAllowances,
  salaryDeductions,
  salaryBreakdown,
  memberPfNumber,
  memberPfAmount,
  memberEsicNumber,
  memberEsicAmount,
  salaryGenerating,
  members,
  onStepChange,
  onPeriodChange,
  onEmployeeChange,
  onAllowancesChange,
  onDeductionsChange,
  onPfNumberChange,
  onPfAmountChange,
  onEsicNumberChange,
  onEsicAmountChange,
  onCalculate,
  onSubmit,
}: {
  actorRole: string;
  salaryStep: 1 | 2 | 3;
  salaryPeriod: { start: string; end: string };
  salaryEmployeeId: string;
  salaryAllowances: string;
  salaryDeductions: string;
  salaryBreakdown: SalaryBreakdown | null;
  memberPfNumber: string;
  memberPfAmount: string;
  memberEsicNumber: string;
  memberEsicAmount: string;
  salaryGenerating: boolean;
  members: AnyRecord[];
  onStepChange: (step: 1 | 2 | 3) => void;
  onPeriodChange: (period: { start: string; end: string }) => void;
  onEmployeeChange: (id: string) => void;
  onAllowancesChange: (value: string) => void;
  onDeductionsChange: (value: string) => void;
  onPfNumberChange: (value: string) => void;
  onPfAmountChange: (value: string) => void;
  onEsicNumberChange: (value: string) => void;
  onEsicAmountChange: (value: string) => void;
  onCalculate: (event: FormEvent) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  if (actorRole !== "finance") return null;

  return (
    <section className={sectionClass}>
      <SectionHeader title="Generate Monthly Salary" description="Create salary records for employees" accent="emerald" />
      <div className="mt-4">
        {salaryStep === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); onStepChange(2); }} className="grid gap-3">
            <p className="text-sm font-medium text-slate-700">Step 1: Select Date Range</p>
            <div className="grid grid-cols-2 gap-3">
              <input className="rounded-lg border border-slate-200 px-3 py-2" type="date" required value={salaryPeriod.start} onChange={(e) => onPeriodChange({ ...salaryPeriod, start: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" type="date" required value={salaryPeriod.end} onChange={(e) => onPeriodChange({ ...salaryPeriod, end: e.target.value })} />
            </div>
            <ActionButton variant="primary" className="justify-self-end">Next</ActionButton>
          </form>
        )}
        {salaryStep === 2 && (
          <form onSubmit={onCalculate} className="grid gap-3">
            <p className="text-sm font-medium text-slate-700">Step 2: Select Employee</p>
            <select className="rounded-lg border border-slate-200 px-3 py-2" required value={salaryEmployeeId} onChange={(e) => onEmployeeChange(e.target.value)}>
              <option value="">Select employee</option>
              {members.map((member) => (
                <option key={String(member.id)} value={String(member.id)}>
                  {String(member.name)} - {formatRoleWithCustom(String(member.role), member.customRole)}
                </option>
              ))}
            </select>
            <div className="flex justify-between">
              <ActionButton variant="secondary" type="button" onClick={() => onStepChange(1)}>Back</ActionButton>
              <ActionButton variant="primary">Calculate</ActionButton>
            </div>
          </form>
        )}
        {salaryStep === 3 && salaryBreakdown && (
          <SalaryBreakdownForm
            salaryBreakdown={salaryBreakdown}
            salaryPeriod={salaryPeriod}
            salaryEmployeeId={salaryEmployeeId}
            members={members}
            salaryAllowances={salaryAllowances}
            salaryDeductions={salaryDeductions}
            memberPfNumber={memberPfNumber}
            memberPfAmount={memberPfAmount}
            memberEsicNumber={memberEsicNumber}
            memberEsicAmount={memberEsicAmount}
            salaryGenerating={salaryGenerating}
            onBack={() => onStepChange(2)}
            onAllowancesChange={onAllowancesChange}
            onDeductionsChange={onDeductionsChange}
            onPfNumberChange={onPfNumberChange}
            onPfAmountChange={onPfAmountChange}
            onEsicNumberChange={onEsicNumberChange}
            onEsicAmountChange={onEsicAmountChange}
            onSubmit={onSubmit}
          />
        )}
      </div>
    </section>
  );
}

function SalaryBreakdownForm({
  salaryBreakdown,
  salaryPeriod,
  salaryEmployeeId,
  members,
  salaryAllowances,
  salaryDeductions,
  memberPfNumber,
  memberPfAmount,
  memberEsicNumber,
  memberEsicAmount,
  salaryGenerating,
  onBack,
  onAllowancesChange,
  onDeductionsChange,
  onPfNumberChange,
  onPfAmountChange,
  onEsicNumberChange,
  onEsicAmountChange,
  onSubmit,
}: {
  salaryBreakdown: SalaryBreakdown;
  salaryPeriod: { start: string; end: string };
  salaryEmployeeId: string;
  members: AnyRecord[];
  salaryAllowances: string;
  salaryDeductions: string;
  memberPfNumber: string;
  memberPfAmount: string;
  memberEsicNumber: string;
  memberEsicAmount: string;
  salaryGenerating: boolean;
  onBack: () => void;
  onAllowancesChange: (value: string) => void;
  onDeductionsChange: (value: string) => void;
  onPfNumberChange: (value: string) => void;
  onPfAmountChange: (value: string) => void;
  onEsicNumberChange: (value: string) => void;
  onEsicAmountChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const member = members.find((x: AnyRecord) => String(x.id) === salaryEmployeeId);
  const fixedAllowances = Number(salaryAllowances || 0);
  const fixedDeductions = Number(salaryDeductions || 0);
  const pfAmount = memberPfAmount ? Number(memberPfAmount) : (salaryBreakdown.pfDeduction ?? 0);
  const esicAmount = memberEsicAmount ? Number(memberEsicAmount) : (salaryBreakdown.esicDeduction ?? 0);
  const netSalary = Math.max(0, salaryBreakdown.grossSalary + fixedAllowances - (fixedDeductions + (salaryBreakdown.foodDeduction ?? 0) + (salaryBreakdown.travelDeduction ?? 0) + pfAmount + esicAmount));

  return (
    <form onSubmit={onSubmit} className="grid gap-3 text-sm">
      <p className="font-medium text-slate-700">Step 3: Review & Adjust</p>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
        <div className="flex justify-between"><span>Period:</span> <span>{salaryBreakdown.periodStart} to {salaryBreakdown.periodEnd}</span></div>
        {salaryBreakdown.periodStart !== salaryPeriod.start && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">&#9888; Period adjusted — employee joined on {salaryBreakdown.periodStart}</p>
        )}
        <div className="flex justify-between"><span>Employee:</span><span className="font-medium text-slate-900">{member ? `${String(member.name)} (${formatRoleWithCustom(String(member.role), member.customRole)})` : "-"}</span></div>
        <div className="flex justify-between"><span>Total Days:</span> <span>{salaryBreakdown.totalDays}</span></div>
        <div className="flex justify-between text-rose-600"><span>Absent Days:</span> <span>{salaryBreakdown.absentDays}</span></div>
        <div className="flex justify-between text-emerald-600"><span>Paid Leave Days:</span> <span>{salaryBreakdown.paidLeaveDays}</span></div>
        <div className="flex justify-between text-rose-600"><span>Unpaid Leave Days:</span> <span>{salaryBreakdown.unpaidLeaveDays}</span></div>
        <div className="flex justify-between"><span>Payable Days:</span> <span>{salaryBreakdown.payableDays}</span></div>
        <div className="flex justify-between"><span>Daily Salary:</span> <span>&#x20B9;{salaryBreakdown.dailySalary.toLocaleString("en-IN")}</span></div>
        <div className="flex justify-between"><span>Gross Salary:</span> <span>&#x20B9;{salaryBreakdown.grossSalary.toLocaleString("en-IN")}</span></div>
        <div className="flex justify-between text-rose-600"><span>Attendance/Leave Deduction:</span> <span>- &#x20B9;{salaryBreakdown.leaveDeduction.toLocaleString("en-IN")}</span></div>
        {salaryBreakdown.foodDeduction > 0 ? (
          <div className="flex justify-between text-rose-600"><span>Food Deduction:</span> <span>- &#x20B9;{salaryBreakdown.foodDeduction.toLocaleString("en-IN")}</span></div>
        ) : null}
        {salaryBreakdown.travelDeduction > 0 ? (
          <div className="flex justify-between text-rose-600"><span>Travel Accommodation Deduction:</span> <span>- &#x20B9;{salaryBreakdown.travelDeduction.toLocaleString("en-IN")}</span></div>
        ) : null}
        <div className="flex justify-between text-emerald-600"><span>Total In Hand:</span> <span>&#x20B9;{Math.max(0, salaryBreakdown.grossSalary + fixedAllowances - (fixedDeductions + (salaryBreakdown.foodDeduction ?? 0) + (salaryBreakdown.travelDeduction ?? 0))).toLocaleString("en-IN")}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Manual Allowances (&#x20B9;)</label>
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="0" value={salaryAllowances} onChange={(e) => onAllowancesChange(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Manual Deductions (&#x20B9;)</label>
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="0" value={salaryDeductions} onChange={(e) => onDeductionsChange(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">PF Account No.</label>
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="text" placeholder="Enter PF number" value={memberPfNumber} onChange={(e) => onPfNumberChange(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            PF Amount (&#x20B9;)
            {(salaryBreakdown.pfDeduction ?? 0) > 0 ? <span className="ml-1 text-rose-600">(-&#x20B9;{salaryBreakdown.pfDeduction.toLocaleString("en-IN")})</span> : null}
          </label>
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" min="0" placeholder="Leave empty for auto %" value={memberPfAmount} onChange={(e) => onPfAmountChange(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">ESIC Account No.</label>
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="text" placeholder="Enter ESIC number" value={memberEsicNumber} onChange={(e) => onEsicNumberChange(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            ESIC Amount (&#x20B9;)
            {(salaryBreakdown.esicDeduction ?? 0) > 0 ? <span className="ml-1 text-rose-600">(-&#x20B9;{salaryBreakdown.esicDeduction.toLocaleString("en-IN")})</span> : null}
          </label>
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" min="0" placeholder="Leave empty for auto %" value={memberEsicAmount} onChange={(e) => onEsicAmountChange(e.target.value)} />
        </div>
      </div>
      <div className="rounded-lg bg-emerald-50 p-3 flex justify-between font-bold text-emerald-700 text-lg mt-2">
        <span>Net Salary:</span>
        <span>&#x20B9;{netSalary.toLocaleString("en-IN")}</span>
      </div>
      <div className="flex justify-between mt-2">
        <ActionButton variant="secondary" type="button" onClick={onBack}>Back</ActionButton>
        <ActionButton variant="approve" disabled={salaryGenerating}>{salaryGenerating ? "Generating..." : "Generate Salary"}</ActionButton>
      </div>
    </form>
  );
}
