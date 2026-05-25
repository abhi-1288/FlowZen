import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord, displayNested, formatRoleWithCustom } from "./shared";

type FinanceData = {
  month: string;
  canManage: boolean;
  dashboard: { totalPayroll: number; pendingSalaries: number; paidSalaries: number };
  salaries: AnyRecord[];
  expenses: AnyRecord[];
  budgets: AnyRecord[];
  boards: AnyRecord[];
  members: AnyRecord[];
};

export function FinanceTab({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<FinanceData | null>(null);
  const [salaryForm, setSalaryForm] = useState({ employeeId: "", baseSalary: "", allowances: "", deductions: "" });
  const [budgetForm, setBudgetForm] = useState({ boardId: "", totalBudget: "", teamSpendingLimit: "", resourceBudget: "" });
  const [expenseForm, setExpenseForm] = useState({ category: "software", title: "", amount: "", reason: "" });

  async function load() {
    const result = await apiFetch<FinanceData>(`/api/finance?month=${month}`);
    setData(result);
  }

  useEffect(() => {
    void load().catch(() => showToast("Unable to load finance data.", "error"));
  }, [month]);

  async function submitSalary(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance", {
      method: "POST",
      body: JSON.stringify({ action: "generate-salary", month, ...salaryForm }),
    });
    setSalaryForm({ employeeId: "", baseSalary: "", allowances: "", deductions: "" });
    showToast("Salary record generated.");
    await load();
  }

  async function submitBudget(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance", {
      method: "POST",
      body: JSON.stringify({ action: "set-budget", ...budgetForm }),
    });
    setBudgetForm({ boardId: "", totalBudget: "", teamSpendingLimit: "", resourceBudget: "" });
    showToast("Project budget saved.");
    await load();
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance", {
      method: "POST",
      body: JSON.stringify({ action: "request-expense", ...expenseForm }),
    });
    setExpenseForm({ category: "software", title: "", amount: "", reason: "" });
    showToast("Expense request submitted.");
    await load();
  }

  async function updateStatus(type: "salary" | "expense", id: string, status: string) {
    await apiFetch("/api/finance", {
      method: "PATCH",
      body: JSON.stringify({ type, id, status }),
    });
    showToast(`${type === "salary" ? "Salary" : "Expense"} ${status}.`);
    await load();
  }

  if (!data) {
    return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">Loading finance...</section>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Finance</h3>
          <p className="text-sm text-slate-500">Payroll, payout status, budgets, and expense requests.</p>
        </div>
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FinanceCard label="Total payroll this month" value={`₹${Number(data.dashboard.totalPayroll).toLocaleString("en-IN")}`} />
        <FinanceCard label="Pending salaries" value={String(data.dashboard.pendingSalaries)} />
        <FinanceCard label="Paid salaries" value={String(data.dashboard.paidSalaries)} />
      </div>

      {data.canManage ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="font-semibold">Generate Monthly Salary</h4>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitSalary}>
              <select className="rounded-lg border border-slate-200 px-3 py-2" required value={salaryForm.employeeId} onChange={(e) => setSalaryForm({ ...salaryForm, employeeId: e.target.value })}>
                <option value="">Select employee</option>
                {data.members.map((member) => (
                  <option key={String(member.id)} value={String(member.id)}>
                    {String(member.name)} - {formatRoleWithCustom(String(member.role), member.customRole)}
                  </option>
                ))}
              </select>
              <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Base salary" type="number" value={salaryForm.baseSalary} onChange={(e) => setSalaryForm({ ...salaryForm, baseSalary: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Allowances" type="number" value={salaryForm.allowances} onChange={(e) => setSalaryForm({ ...salaryForm, allowances: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Deductions" type="number" value={salaryForm.deductions} onChange={(e) => setSalaryForm({ ...salaryForm, deductions: e.target.value })} />
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white md:col-span-2">Generate salary</button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="font-semibold">Project Budget Allocation</h4>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitBudget}>
              <select className="rounded-lg border border-slate-200 px-3 py-2 md:col-span-2" required value={budgetForm.boardId} onChange={(e) => setBudgetForm({ ...budgetForm, boardId: e.target.value })}>
                <option value="">Select project</option>
                {data.boards.map((board) => (
                  <option key={String(board.id)} value={String(board.id)}>{String(board.title)}</option>
                ))}
              </select>
              <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Total project budget" type="number" value={budgetForm.totalBudget} onChange={(e) => setBudgetForm({ ...budgetForm, totalBudget: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Team spending limit" type="number" value={budgetForm.teamSpendingLimit} onChange={(e) => setBudgetForm({ ...budgetForm, teamSpendingLimit: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2 md:col-span-2" placeholder="Resource budget" type="number" value={budgetForm.resourceBudget} onChange={(e) => setBudgetForm({ ...budgetForm, resourceBudget: e.target.value })} />
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white md:col-span-2">Save budget</button>
            </form>
          </section>
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold">Expense Request</h4>
        <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={submitExpense}>
          <select className="rounded-lg border border-slate-200 px-3 py-2" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
            <option value="software">Software purchase</option>
            <option value="device">Laptop/device</option>
            <option value="travel">Travel expense</option>
            <option value="office-resources">Office resources</option>
          </select>
          <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Title" value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} />
          <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Amount" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">Request</button>
          <textarea className="rounded-lg border border-slate-200 px-3 py-2 md:col-span-4" placeholder="Reason" value={expenseForm.reason} onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })} />
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold">Salary Records</h4>
        <div className="mt-4 divide-y divide-slate-200">
          {data.salaries.map((salary) => (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(salary.id)}>
              <div>
                <p className="font-medium">{displayNested(salary.employee, "name", "Employee")} - ₹{Number(salary.netSalary ?? 0).toLocaleString("en-IN")}</p>
                <p className="text-sm text-slate-500">{String(salary.month)} • {String(salary.status)}</p>
              </div>
              {data.canManage ? (
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={() => updateStatus("salary", String(salary.id), "approved")}>Approve payout</button>
                  <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus("salary", String(salary.id), "paid")}>Mark paid</button>
                </div>
              ) : null}
            </div>
          ))}
          {data.salaries.length === 0 ? <p className="py-4 text-sm text-slate-500">No salary records for this month.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold">Expense Requests</h4>
        <div className="mt-4 divide-y divide-slate-200">
          {data.expenses.map((expense) => (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(expense.id)}>
              <div>
                <p className="font-medium">{String(expense.title)} - ₹{Number(expense.amount ?? 0).toLocaleString("en-IN")}</p>
                <p className="text-sm text-slate-500">{displayNested(expense.requester, "name", "Requester")} • {String(expense.category)} • {String(expense.status)}</p>
              </div>
              {data.canManage && String(expense.status) === "pending" ? (
                <div className="flex gap-2">
                  <button className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600" onClick={() => updateStatus("expense", String(expense.id), "rejected")}>Reject</button>
                  <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus("expense", String(expense.id), "approved")}>Approve</button>
                </div>
              ) : null}
            </div>
          ))}
          {data.expenses.length === 0 ? <p className="py-4 text-sm text-slate-500">No expense requests yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

function FinanceCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </section>
  );
}
