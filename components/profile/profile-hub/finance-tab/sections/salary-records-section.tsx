import { useState } from "react";
import { ActionButton, displayNested } from "../../shared";
import type { AnyRecord } from "../../shared";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]";

type SalaryTab = "all" | "pending" | "approved" | "paid" | "rejected";

const TABS: { key: SalaryTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
];

function TabBtn({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {label}
      {count > 0 ? (
        <span className={`ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
        }`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function SalaryRecordsSection({
  salaries,
  actorRole,
  onDelete,
  onStatusUpdate,
  onViewDetail,
}: {
  salaries: AnyRecord[];
  actorRole: string;
  onDelete: (id: string, employeeName: string) => void;
  onStatusUpdate: (type: "salary" | "expense" | "budget" | "bill", id: string, status: string, extra?: Record<string, string>) => void;
  onViewDetail?: (id: string, employeeName: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<SalaryTab>("pending");

  const counts = {
    all: salaries.length,
    pending: salaries.filter((s) => String(s.status ?? "") === "pending").length,
    approved: salaries.filter((s) => String(s.status ?? "") === "approved").length,
    paid: salaries.filter((s) => String(s.status ?? "") === "paid").length,
    rejected: salaries.filter((s) => String(s.status ?? "") === "rejected").length,
  };

  const filtered = activeTab === "all"
    ? salaries
    : salaries.filter((s) => String(s.status ?? "") === activeTab);

  return (
    <section className={sectionClass}>
      <div className="mb-4 border-l-4 border-emerald-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Salary Records</h3>
        <p className="mt-0.5 text-sm text-slate-500">Manage monthly salary payouts</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <TabBtn
            key={tab.key}
            active={activeTab === tab.key}
            label={tab.label}
            count={counts[tab.key]}
            onClick={() => setActiveTab(tab.key)}
          />
        ))}
      </div>

      <div className="divide-y divide-slate-200">
        {filtered.map((salary) => (
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
              {actorRole === "admin" && onViewDetail ? (
                <ActionButton variant="secondary" className="px-3" onClick={() => onViewDetail(String(salary.id), displayNested(salary.employee, "name", "Employee"))}>Details</ActionButton>
              ) : null}
            </div>
          </div>
        ))}
        {filtered.length === 0 ? <p className="py-4 text-sm text-slate-500">No salary records for this month.</p> : null}
      </div>
    </section>
  );
}
