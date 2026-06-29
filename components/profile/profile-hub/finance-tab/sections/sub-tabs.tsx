import type { FinanceSubTab } from "../types";
import type { AnyRecord } from "../../shared";

function TabBtn({
  active,
  label,
  count,
  onClick,
  badgeClass,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  badgeClass: string;
}) {
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {label}
      {count > 0 ? (
        <span
          className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
            active ? "bg-white/20 text-white" : badgeClass
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function FinanceSubTabs({
  activeTab,
  data,
  invoices,
  onTabChange,
}: {
  activeTab: FinanceSubTab;
  data: { expenses: AnyRecord[]; salaries: AnyRecord[]; budgets: AnyRecord[] };
  invoices: AnyRecord[];
  onTabChange: (tab: FinanceSubTab) => void;
}) {
  const myRequestsCount = data.expenses.filter((e) => {
    const status = String(e.status ?? "");
    return status === "pending" || status === "forwarded" || status === "approved";
  }).length;

  const pendingSalariesCount = data.salaries.filter((s) => {
    const status = String(s.status ?? "");
    return status === "pending" || status === "approved";
  }).length;
  const pendingBudgetsCount = data.budgets.filter((b) => String(b.status ?? "") === "pending").length;
  const acceptedExpensesCount = data.expenses.filter((e) => String(e.status ?? "") === "accepted").length;
  const opsCount = pendingSalariesCount + pendingBudgetsCount + acceptedExpensesCount;

  const pendingInvoicesCount = invoices.filter((inv) => String(inv.status ?? "") === "pending").length;

  return (
    <div className="flex gap-2">
      <TabBtn
        active={activeTab === "my"}
        label="My Requests"
        count={myRequestsCount}
        onClick={() => onTabChange("my")}
        badgeClass="bg-amber-100 text-amber-700"
      />
      <TabBtn
        active={activeTab === "ops"}
        label="Operations"
        count={opsCount}
        onClick={() => onTabChange("ops")}
        badgeClass="bg-rose-100 text-rose-700"
      />
      <TabBtn
        active={activeTab === "reports"}
        label="Reports"
        count={pendingInvoicesCount}
        onClick={() => onTabChange("reports")}
        badgeClass="bg-sky-100 text-sky-700"
      />
    </div>
  );
}
