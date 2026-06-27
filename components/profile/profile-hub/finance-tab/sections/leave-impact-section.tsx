import type { LeaveImpact } from "../types";
import { Card, SectionHeader } from "../../shared";

export function LeaveImpactSection({
  leaveImpacts,
  month,
}: {
  leaveImpacts: LeaveImpact[];
  month: string;
}) {
  if (leaveImpacts.length === 0) return null;

  return (
    <Card>
      <SectionHeader title="Leave Impact on Payroll" description={`Approved leave deductions for ${month}`} accent="amber" />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-medium uppercase text-slate-500">
              <th className="pb-3 pr-4">Employee</th>
              <th className="pb-3 pr-4">Leaves</th>
              <th className="pb-3 text-right">Salary Deduction</th>
            </tr>
          </thead>
          <tbody>
            {leaveImpacts.map((li, idx) => (
              <tr className="border-b border-slate-100" key={idx}>
                <td className="py-2 pr-4 font-medium">{li.employeeName}</td>
                <td className="py-2 pr-4">{li.leaves}</td>
                <td className="py-2 text-right text-rose-600">- &#x20B9;{li.deduction.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold">
              <td className="pt-3 pr-4">Total</td>
              <td className="pt-3 pr-4">{leaveImpacts.reduce((s, li) => s + li.leaves, 0)}</td>
              <td className="pt-3 text-right">- &#x20B9;{leaveImpacts.reduce((s, li) => s + li.deduction, 0).toLocaleString("en-IN")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
