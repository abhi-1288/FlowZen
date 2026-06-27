import type { FinanceDashboard } from "../types";

export function DashboardCards({ dashboard }: { dashboard: FinanceDashboard }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card label="Total payroll this month" value={`₹${Number(dashboard.totalPayroll).toLocaleString("en-IN")}`} />
      <Card label="Pending salaries" value={String(dashboard.pendingSalaries)} />
      <Card label="Paid salaries" value={String(dashboard.paidSalaries)} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </section>
  );
}
