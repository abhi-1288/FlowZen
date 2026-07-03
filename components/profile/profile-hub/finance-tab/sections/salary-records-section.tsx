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
  month,
  onDelete,
  onStatusUpdate,
  onReject,
  onBulkStatusUpdate,
  onViewDetail,
}: {
  salaries: AnyRecord[];
  actorRole: string;
  month: string;
  onDelete: (id: string, employeeName: string) => void;
  onStatusUpdate: (type: "salary" | "expense" | "budget" | "bill", id: string, status: string, extra?: Record<string, string>) => void;
  onReject?: (id: string, type: "salary") => void;
  onBulkStatusUpdate?: (ids: string[], status: "approved" | "rejected") => void;
  onViewDetail?: (id: string, employeeName: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<SalaryTab>("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const pendingFiltered = filtered.filter((s) => String(s.status ?? "") === "pending");
  const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every((s) => selectedIds.has(String(s.id)));
  const canBulk = actorRole === "admin" && selectedIds.size > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingFiltered.map((s) => String(s.id))));
    }
  }

  return (
    <section className={sectionClass}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="border-l-4 border-emerald-500 pl-4">
          <h3 className="text-base font-semibold text-slate-900">Salary Records</h3>
          <p className="mt-0.5 text-sm text-slate-500">Manage monthly salary payouts</p>
        </div>
        <a
          href={`/api/finance/export?month=${month}`}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Export CSV
        </a>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <TabBtn
            key={tab.key}
            active={activeTab === tab.key}
            label={tab.label}
            count={counts[tab.key]}
            onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
          />
        ))}
      </div>

      {canBulk ? (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-slate-950"
              checked={allPendingSelected}
              onChange={toggleSelectAll}
            />
            {selectedIds.size} selected
          </label>
          <ActionButton variant="secondary" className="px-3 text-xs" onClick={() => onBulkStatusUpdate?.(Array.from(selectedIds), "approved")}>
            Approve ({selectedIds.size})
          </ActionButton>
          <ActionButton variant="danger" className="px-3 text-xs" onClick={() => onBulkStatusUpdate?.(Array.from(selectedIds), "rejected")}>
            Reject ({selectedIds.size})
          </ActionButton>
          <button className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="divide-y divide-slate-200">
        {filtered.map((salary) => {
          const isPending = String(salary.status ?? "") === "pending";
          const showBulkCheckbox = isPending && actorRole === "admin";

          return (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(salary.id)}>
              <div className="flex items-center gap-3">
                {showBulkCheckbox ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-slate-950"
                    checked={selectedIds.has(String(salary.id))}
                    onChange={() => toggleSelect(String(salary.id))}
                  />
                ) : null}
                <div>
                  <p className="font-medium">{displayNested(salary.employee, "name", "Employee")} - &#x20B9;{Number(salary.netSalary ?? 0).toLocaleString("en-IN")}</p>
                  <p className="text-sm text-slate-500">{String(salary.month)} &bull; {String(salary.status)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isPending && actorRole === "finance" ? (
                  <ActionButton variant="danger" className="px-3" onClick={() => onDelete(String(salary.id), displayNested(salary.employee, "name", "Employee"))}>Delete</ActionButton>
                ) : null}
                {isPending && actorRole === "admin" ? (
                  <>
                    <ActionButton variant="secondary" className="px-3" onClick={() => onStatusUpdate("salary", String(salary.id), "approved")}>Approve payout</ActionButton>
                    <ActionButton variant="danger" className="px-3" onClick={() => onReject?.(String(salary.id), "salary")}>Reject</ActionButton>
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
          );
        })}
        {filtered.length === 0 ? <p className="py-4 text-sm text-slate-500">No salary records for this month.</p> : null}
      </div>
    </section>
  );
}
