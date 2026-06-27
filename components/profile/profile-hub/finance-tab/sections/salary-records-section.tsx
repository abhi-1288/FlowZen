import { ActionButton, displayNested } from "../../shared";
import type { AnyRecord } from "../../shared";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]";

export function SalaryRecordsSection({
  salaries,
  actorRole,
  onDelete,
  onStatusUpdate,
}: {
  salaries: AnyRecord[];
  actorRole: string;
  onDelete: (id: string, employeeName: string) => void;
  onStatusUpdate: (type: "salary" | "expense" | "budget" | "bill", id: string, status: string, extra?: Record<string, string>) => void;
}) {
  const pendingCount = salaries.filter((s) => String(s.status ?? "") === "pending").length;

  return (
    <section className={sectionClass}>
      <div className="mb-5 border-l-4 border-emerald-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          Salary Records
          {salaries.length > 0 ? (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[11px] font-bold text-emerald-700">{salaries.length}</span>
          ) : null}
          {pendingCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {pendingCount} pending
            </span>
          ) : null}
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">Manage monthly salary payouts</p>
      </div>
      <div className="mt-4 divide-y divide-slate-200">
        {salaries.map((salary) => (
          <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(salary.id)}>
            <div>
              <p className="font-medium">{displayNested(salary.employee, "name", "Employee")} - &#x20B9;{Number(salary.netSalary ?? 0).toLocaleString("en-IN")}</p>
              <p className="text-sm text-slate-500">{String(salary.month)} &bull; {String(salary.status)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {String(salary.status) === "pending" && actorRole === "finance" ? (
                <ActionButton variant="danger" className="px-3" onClick={() => onDelete(String(salary.id), displayNested(salary.employee, "name", "Employee"))}>Delete</ActionButton>
              ) : null}
              {String(salary.status) === "pending" && actorRole === "admin" ? (
                <>
                  <ActionButton variant="secondary" className="px-3" onClick={() => onStatusUpdate("salary", String(salary.id), "approved")}>Approve payout</ActionButton>
                  <ActionButton variant="danger" className="px-3" onClick={() => onStatusUpdate("salary", String(salary.id), "rejected")}>Reject</ActionButton>
                </>
              ) : null}
              {String(salary.status) === "approved" && actorRole === "finance" ? (
                <ActionButton variant="approve" className="px-3" onClick={() => onStatusUpdate("salary", String(salary.id), "paid")}>Mark paid</ActionButton>
              ) : null}
              {String(salary.status) === "paid" ? (
                <a href={`/salary-slip/${String(salary.id)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">View Slip</a>
              ) : null}
            </div>
          </div>
        ))}
        {salaries.length === 0 ? <p className="py-4 text-sm text-slate-500">No salary records for this month.</p> : null}
      </div>
    </section>
  );
}
