import type { ReportsData } from "../types";
import { Card, SectionHeader } from "../../shared";

export function ReportsSection({ reports }: { reports: ReportsData | null }) {
  if (!reports) return null;

  return (
    <Card>
      <SectionHeader title="Reports & Analytics" description="Yearly financial summary" accent="indigo" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Revenue</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">&#x20B9;{reports.revenue.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Expenses</p>
          <p className="mt-1 text-xl font-semibold text-rose-600">&#x20B9;{reports.expenses.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Profit</p>
          <p className={`mt-1 text-xl font-semibold ${reports.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>&#x20B9;{reports.profit.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Pending Invoices</p>
          <p className="mt-1 text-xl font-semibold text-amber-600">{reports.pendingInvoices} (&#x20B9;{reports.pendingInvoicesAmount.toLocaleString("en-IN")})</p>
        </div>
      </div>
    </Card>
  );
}
