import { useMemo } from "react";
import { ActionButton, displayNested, formatRole, formatRoleWithCustom } from "../../shared";
import type { AnyRecord } from "../../shared";
import type { SalaryModalTab } from "../types";
import { getSalaryRole } from "../helpers";

const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-black/40";
const modalClass = "flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl";

export function SalaryOverviewModal({
  show,
  salaryModalTab,
  expandedRoles,
  salaries,
  members,
  memberRoleMap,
  onTabChange,
  onToggleRole,
  onClose,
}: {
  show: boolean;
  salaryModalTab: SalaryModalTab;
  expandedRoles: Set<string>;
  salaries: AnyRecord[];
  members: AnyRecord[];
  memberRoleMap: Map<string, string>;
  onTabChange: (tab: SalaryModalTab) => void;
  onToggleRole: (role: string) => void;
  onClose: () => void;
}) {
  if (!show) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h4 className="text-lg font-semibold text-slate-900">Salary Overview</h4>
          <ActionButton variant="ghost" onClick={onClose}>Close</ActionButton>
        </div>
        <div className="flex gap-2 border-b border-slate-200 px-6 py-3">
          <button
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${salaryModalTab === "unpaid" ? "bg-rose-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            onClick={() => onTabChange("unpaid")}
          >
            Unpaid
          </button>
          <button
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${salaryModalTab === "paid" ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            onClick={() => onTabChange("paid")}
          >
            Paid
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <SalaryOverviewContent
            salaryModalTab={salaryModalTab}
            expandedRoles={expandedRoles}
            salaries={salaries}
            members={members}
            memberRoleMap={memberRoleMap}
            onToggleRole={onToggleRole}
          />
        </div>
      </div>
    </div>
  );
}

function SalaryOverviewContent({
  salaryModalTab,
  expandedRoles,
  salaries,
  members,
  memberRoleMap,
  onToggleRole,
}: {
  salaryModalTab: SalaryModalTab;
  expandedRoles: Set<string>;
  salaries: AnyRecord[];
  members: AnyRecord[];
  memberRoleMap: Map<string, string>;
  onToggleRole: (role: string) => void;
}) {
  const grouped = useMemo(() => {
    const statusFilter = salaryModalTab === "unpaid" ? ["pending", "approved"] : ["paid"];
    const filteredSalaries = salaries.filter((s) => statusFilter.includes(String(s.status ?? "")));

    const salariedEmpIds = new Set<string>();
    for (const s of salaries) {
      const eid = String((s.employee as AnyRecord)?._id ?? (s.employee as AnyRecord)?.id ?? "");
      if (eid) salariedEmpIds.add(eid);
    }

    const result: Record<string, AnyRecord[]> = {};
    for (const salary of filteredSalaries) {
      const role = getSalaryRole(salary, memberRoleMap);
      if (!result[role]) result[role] = [];
      result[role].push(salary);
    }

    if (salaryModalTab === "unpaid") {
      for (const member of members) {
        const memberId = String(member.id);
        if (!salariedEmpIds.has(memberId)) {
          const role = String(member.role ?? "employee");
          if (!result[role]) result[role] = [];
          result[role].push({ __isMember: true, member } as AnyRecord);
        }
      }
    }

    return result;
  }, [salaryModalTab, salaries, members, memberRoleMap]);

  const roleKeys = Object.keys(grouped).sort();

  if (roleKeys.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No {salaryModalTab} salary records found.
      </p>
    );
  }

  return roleKeys.map((role) => {
    const isOpen = expandedRoles.has(role);
    const items = grouped[role];
    const salaryItems = items.filter((s) => !(s as AnyRecord).__isMember);
    const memberItems = items.filter((s) => (s as AnyRecord).__isMember);
    const totalAmount = salaryItems.reduce((sum, s) => sum + Number(s.netSalary ?? 0), 0);

    return (
      <div className="mb-3 rounded-lg border border-slate-200 overflow-hidden" key={role}>
        <button
          className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
          onClick={() => onToggleRole(role)}
        >
          <div className="flex items-center gap-2">
            <span className={`text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
            <span className="text-sm font-semibold capitalize text-slate-900">{formatRole(role)}</span>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-700">{items.length}</span>
          </div>
          {totalAmount > 0 ? (
            <span className="text-sm font-medium text-slate-600">₹{totalAmount.toLocaleString("en-IN")}</span>
          ) : null}
        </button>
        {isOpen ? (
          <div className="divide-y divide-slate-100">
            {salaryItems.map((salary) => {
              const empName = displayNested(salary.employee, "name", "Employee");
              const empRole = formatRoleWithCustom(getSalaryRole(salary, memberRoleMap), (salary.employee as AnyRecord)?.customRole);
              return (
                <div className="flex items-center justify-between px-4 py-2.5 text-sm" key={String(salary.id)}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{empName}</p>
                    <p className="text-xs text-slate-400 capitalize">{empRole}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-slate-800">₹{Number(salary.netSalary ?? 0).toLocaleString("en-IN")}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${String(salary.status) === "paid" ? "bg-emerald-100 text-emerald-700" : String(salary.status) === "approved" ? "bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]" : "bg-amber-100 text-amber-700"}`}>
                      {String(salary.status)}
                    </span>
                  </div>
                </div>
              );
            })}
            {memberItems.map((entry) => {
              const member = (entry as AnyRecord).member as AnyRecord;
              return (
                <div className="flex items-center justify-between px-4 py-2.5 text-sm" key={String(member.id)}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{String(member.name ?? "Unknown")}</p>
                    <p className="text-xs text-slate-400 capitalize">{formatRoleWithCustom(String(member.role ?? "employee"), member.customRole)}</p>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">Not generated</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  });
}
