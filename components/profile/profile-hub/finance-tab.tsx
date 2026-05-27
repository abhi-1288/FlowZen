import { FormEvent, useEffect, useRef, useState } from "react";
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
  financeMembers: AnyRecord[];
};

export function FinanceTab({
  actorRole,
  profileId,
  showToast,
}: {
  actorRole: string;
  profileId: string;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<FinanceData | null>(null);
  const [salaryStep, setSalaryStep] = useState<1 | 2 | 3>(1);
  const [salaryPeriod, setSalaryPeriod] = useState({ start: "", end: "" });
  const [salaryEmployeeId, setSalaryEmployeeId] = useState("");
  const [salaryAllowances, setSalaryAllowances] = useState("");
  const [salaryDeductions, setSalaryDeductions] = useState("");
  const [salaryBreakdown, setSalaryBreakdown] = useState<{
    totalDays: number;
    absentDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    payableDays: number;
    dailySalary: number;
    leaveDeduction: number;
    allowances: number;
    manualDeductions: number;
    totalDeductions: number;
    grossSalary: number;
    finalSalary: number;
    periodStart: string;
    periodEnd: string;
  } | null>(null);
  const [salaryGenerating, setSalaryGenerating] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ boardId: "", totalBudget: "", teamSpendingLimit: "", resourceBudget: "", deadline: "", assignedTo: "" });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [showExpiredBudgets, setShowExpiredBudgets] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: "software", title: "", amount: "", reason: "", assignedTo: "" });
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: "expense" | "budget" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Invoice
  const [invoices, setInvoices] = useState<AnyRecord[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ boardId: "", clientName: "", clientEmail: "", amount: "", description: "" });

  // Reports
  const [reports, setReports] = useState<{ revenue: number; expenses: number; profit: number; pendingInvoices: number; pendingInvoicesAmount: number } | null>(null);

  // Leave impact
  const [leaveImpacts, setLeaveImpacts] = useState<{ employeeName: string; leaves: number; deduction: number }[]>([]);


  // Resource requests
  const [resourceRequests, setResourceRequests] = useState<AnyRecord[]>([]);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourceForm, setResourceForm] = useState({ items: [{ name: "", quantity: 1, reason: "" }], notes: "" });

  async function load() {
    const result = await apiFetch<FinanceData>(`/api/finance?month=${month}`);
    setData(result);
  }

  useEffect(() => {
    void load().catch(() => showToast("Unable to load finance data.", "error"));
  }, [month]);

  // Load invoices
  useEffect(() => {
    if (!data) return;
    apiFetch<{ invoices: AnyRecord[] }>("/api/finance/invoice")
      .then((res) => setInvoices(res.invoices))
      .catch(() => { });
  }, [data]);

  // Load reports
  useEffect(() => {
    if (!data) return;
    apiFetch<{ revenue: number; expenses: number; profit: number; pendingInvoices: number; pendingInvoicesAmount: number }>("/api/finance/reports")
      .then(setReports)
      .catch(() => { });
  }, [data]);

  // Load leave impacts
  useEffect(() => {
    if (!data) return;
    apiFetch<{ impacts: { employeeName: string; leaves: number; deduction: number }[] }>(`/api/finance/leave-impact?month=${month}`)
      .then((res) => setLeaveImpacts(res.impacts))
      .catch(() => { });
  }, [data, month]);

  // Load resource requests
  useEffect(() => {
    if (!data) return;
    const url = actorRole === "finance" || actorRole === "admin"
      ? "/api/finance/resource-request"
      : "/api/finance/resource-request";
    apiFetch<{ requests: AnyRecord[] }>(url)
      .then((res) => setResourceRequests(res.requests))
      .catch(() => { });
  }, [data, actorRole]);

  async function calculateSalary(event: FormEvent) {
    event.preventDefault();
    try {
      const res = await apiFetch<any>("/api/finance", {
        method: "POST",
        body: JSON.stringify({
          action: "calculate-salary",
          employeeId: salaryEmployeeId,
          periodStart: salaryPeriod.start,
          periodEnd: salaryPeriod.end,
        }),
      });
      setSalaryBreakdown(res.breakdown);
      setSalaryAllowances("");
      setSalaryDeductions("");
      setSalaryStep(3);
    } catch (err: any) {
      showToast(err.message || "Failed to calculate salary.", "error");
    }
  }

  async function submitSalary(event: FormEvent) {
    event.preventDefault();
    if (salaryGenerating) return;
    setSalaryGenerating(true);
    try {
      await apiFetch("/api/finance", {
        method: "POST",
        body: JSON.stringify({
          action: "generate-salary",
          employeeId: salaryEmployeeId,
          periodStart: salaryPeriod.start,
          periodEnd: salaryPeriod.end,
          allowances: salaryAllowances,
          deductions: salaryDeductions,
        }),
      });
      showToast("Salary record generated and sent for approval.", "success");
      setSalaryStep(1);
      setSalaryPeriod({ start: "", end: "" });
      setSalaryEmployeeId("");
      setSalaryBreakdown(null);
      await load();
    } catch (err: any) {
      showToast(err.message || "Failed to generate salary.", "error");
    } finally {
      setSalaryGenerating(false);
    }
  }

  async function openBudgetModal(budget?: AnyRecord) {
    if (budget) {
      setEditingBudgetId(String(budget.id ?? ""));
      setBudgetForm({
        boardId: String((budget.board as AnyRecord)?._id ?? (budget.board as AnyRecord)?.id ?? ""),
        totalBudget: String(budget.totalBudget ?? ""),
        teamSpendingLimit: String(budget.teamSpendingLimit ?? ""),
        resourceBudget: String(budget.resourceBudget ?? ""),
        deadline: budget.deadline ? new Date(String(budget.deadline)).toISOString().slice(0, 10) : "",
        assignedTo: String((budget.assignedTo as AnyRecord)?._id ?? (budget.assignedTo as AnyRecord)?.id ?? ""),
      });
    } else {
      setEditingBudgetId(null);
      setBudgetForm({ boardId: "", totalBudget: "", teamSpendingLimit: "", resourceBudget: "", deadline: "", assignedTo: "" });
    }
    setShowBudgetModal(true);
  }

  async function submitBudget(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance", {
      method: "POST",
      body: JSON.stringify({ action: "set-budget", ...budgetForm }),
    });
    setShowBudgetModal(false);
    setEditingBudgetId(null);
    setBudgetForm({ boardId: "", totalBudget: "", teamSpendingLimit: "", resourceBudget: "", deadline: "", assignedTo: "" });
    showToast("Budget saved and sent for approval.", "success");
    await load();
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance", {
      method: "POST",
      body: JSON.stringify({ action: "request-expense", ...expenseForm }),
    });
    setExpenseForm({ category: "software", title: "", amount: "", reason: "", assignedTo: "" });
    showToast("Expense request submitted.", "success");
    await load();
  }

  async function updateStatus(type: "salary" | "expense" | "budget" | "bill", id: string, status: string) {
    await apiFetch("/api/finance", {
      method: "PATCH",
      body: JSON.stringify({ type, id, status }),
    });
    showToast(`${type === "salary" ? "Salary" : type === "budget" ? "Budget" : type === "bill" ? "Bill" : "Expense"} ${status}.`, "success");
    await load();
  }

  async function rejectItem() {
    if (!rejectTarget || !rejectReason.trim()) return;
    if (rejectTarget.type === "budget") {
      await apiFetch("/api/finance", {
        method: "PATCH",
        body: JSON.stringify({ type: "budget", id: rejectTarget.id, status: "rejected", rejectionReason: rejectReason.trim() }),
      });
    } else {
      await apiFetch("/api/finance", {
        method: "PATCH",
        body: JSON.stringify({ type: "expense", id: rejectTarget.id, status: "rejected", rejectionReason: rejectReason.trim() }),
      });
    }
    setRejectTarget(null);
    setRejectReason("");
    showToast("Rejected.", "success");
    await load();
  }

  // --- Invoice handlers ---
  async function createInvoice(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance/invoice", {
      method: "POST",
      body: JSON.stringify(invoiceForm),
    });
    setShowInvoiceForm(false);
    setInvoiceForm({ boardId: "", clientName: "", clientEmail: "", amount: "", description: "" });
    showToast("Invoice created.", "success");
    const res = await apiFetch<{ invoices: AnyRecord[] }>("/api/finance/invoice");
    setInvoices(res.invoices);
  }

  async function markInvoice(id: string, status: string) {
    await apiFetch("/api/finance/invoice", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    });
    showToast(`Invoice ${status === "paid" ? "marked paid" : "marked pending"}.`, "success");
    const res = await apiFetch<{ invoices: AnyRecord[] }>("/api/finance/invoice");
    setInvoices(res.invoices);
  }

  // --- Resource request handlers ---
  async function createResourceRequest(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance/resource-request", {
      method: "POST",
      body: JSON.stringify(resourceForm),
    });
    setShowResourceForm(false);
    setResourceForm({ items: [{ name: "", quantity: 1, reason: "" }], notes: "" });
    showToast("Resource request submitted.", "success");
    const res = await apiFetch<{ requests: AnyRecord[] }>("/api/finance/resource-request");
    setResourceRequests(res.requests);
  }

  async function processResourceRequest(id: string, status: string) {
    const reason = status === "rejected" ? prompt("Rejection reason:") : "";
    if (status === "rejected" && !reason) { showToast("A rejection reason is required.", "error"); return; }
    await apiFetch("/api/finance/resource-request", {
      method: "PATCH",
      body: JSON.stringify({ id, status, rejectionReason: reason ?? "" }),
    });
    showToast(`Resource request ${status}.`, "success");
    const res = await apiFetch<{ requests: AnyRecord[] }>("/api/finance/resource-request");
    setResourceRequests(res.requests);
  }

  function addResourceItem() {
    setResourceForm({ ...resourceForm, items: [...resourceForm.items, { name: "", quantity: 1, reason: "" }] });
  }

  function updateResourceItem(index: number, field: string, value: string | number) {
    const items = [...resourceForm.items];
    (items[index] as any)[field] = value;
    setResourceForm({ ...resourceForm, items });
  }

  function removeResourceItem(index: number) {
    if (resourceForm.items.length <= 1) return;
    setResourceForm({ ...resourceForm, items: resourceForm.items.filter((_, i) => i !== index) });
  }

  // Salary edit (removed in favor of regenerate)
  const salaryFormRef = useRef<HTMLDivElement>(null);



  if (!data) {
    return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">Loading finance...</section>;
  }

  const isFinanceOrAdmin = actorRole === "finance" || actorRole === "admin";

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

      {/* Reports & Analytics */}
      {reports ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold">Reports & Analytics</h4>
          <p className="mt-1 text-xs text-slate-400">Yearly financial summary</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Revenue</p>
              <p className="mt-1 text-xl font-semibold text-emerald-600">₹{reports.revenue.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Expenses</p>
              <p className="mt-1 text-xl font-semibold text-rose-600">₹{reports.expenses.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Profit</p>
              <p className={`mt-1 text-xl font-semibold ${reports.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>₹{reports.profit.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Pending Invoices</p>
              <p className="mt-1 text-xl font-semibold text-amber-600">{reports.pendingInvoices} (₹{reports.pendingInvoicesAmount.toLocaleString("en-IN")})</p>
            </div>
          </div>
        </section>
      ) : null}



      {data.canManage ? (
        <><div className="grid gap-5 xl:grid-cols-2">
          {actorRole === "finance" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" ref={salaryFormRef}>
              <h4 className="font-semibold">Generate Monthly Salary</h4>
              <div className="mt-4">
                {salaryStep === 1 && (
                  <form onSubmit={(e) => { e.preventDefault(); setSalaryStep(2); }} className="grid gap-3">
                    <p className="text-sm font-medium text-slate-700">Step 1: Select Date Range</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input className="rounded-lg border border-slate-200 px-3 py-2" type="date" required value={salaryPeriod.start} onChange={(e) => setSalaryPeriod({ ...salaryPeriod, start: e.target.value })} />
                      <input className="rounded-lg border border-slate-200 px-3 py-2" type="date" required value={salaryPeriod.end} onChange={(e) => setSalaryPeriod({ ...salaryPeriod, end: e.target.value })} />
                    </div>
                    <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white justify-self-end">Next</button>
                  </form>
                )}
                {salaryStep === 2 && (
                  <form onSubmit={calculateSalary} className="grid gap-3">
                    <p className="text-sm font-medium text-slate-700">Step 2: Select Employee</p>
                    <select className="rounded-lg border border-slate-200 px-3 py-2" required value={salaryEmployeeId} onChange={(e) => setSalaryEmployeeId(e.target.value)}>
                      <option value="">Select employee</option>
                      {data.members.map((member) => (
                        <option key={String(member.id)} value={String(member.id)}>
                          {String(member.name)} - {formatRoleWithCustom(String(member.role), member.customRole)}
                        </option>
                      ))}
                    </select>
                    <div className="flex justify-between">
                      <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => setSalaryStep(1)}>Back</button>
                      <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">Calculate</button>
                    </div>
                  </form>
                )}
                {salaryStep === 3 && salaryBreakdown && (
                  <form onSubmit={submitSalary} className="grid gap-3 text-sm">
                    <p className="font-medium text-slate-700">Step 3: Review & Adjust</p>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
                      <div className="flex justify-between"><span>Period:</span> <span>{salaryBreakdown.periodStart} to {salaryBreakdown.periodEnd}</span></div>
                      {salaryBreakdown.periodStart !== salaryPeriod.start && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">⚠ Period adjusted — employee joined on {salaryBreakdown.periodStart}</p>
                      )}
                      <div className="flex justify-between"><span>Total Days:</span> <span>{salaryBreakdown.totalDays}</span></div>
                      <div className="flex justify-between text-rose-600"><span>Absent Days:</span> <span>{salaryBreakdown.absentDays}</span></div>
                      <div className="flex justify-between text-emerald-600"><span>Paid Leave Days:</span> <span>{salaryBreakdown.paidLeaveDays}</span></div>
                      <div className="flex justify-between text-rose-600"><span>Unpaid Leave Days:</span> <span>{salaryBreakdown.unpaidLeaveDays}</span></div>
                      <div className="flex justify-between"><span>Payable Days:</span> <span>{salaryBreakdown.payableDays}</span></div>
                      <div className="flex justify-between"><span>Daily Salary:</span> <span>₹{salaryBreakdown.dailySalary.toLocaleString("en-IN")}</span></div>
                      <div className="flex justify-between"><span>Gross Salary:</span> <span>₹{salaryBreakdown.grossSalary.toLocaleString("en-IN")}</span></div>
                      <div className="flex justify-between text-rose-600"><span>Attendance/Leave Deduction:</span> <span>- ₹{salaryBreakdown.leaveDeduction.toLocaleString("en-IN")}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Manual Allowances (₹)</label>
                        <input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="0" value={salaryAllowances} onChange={(e) => setSalaryAllowances(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Manual Deductions (₹)</label>
                        <input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="0" value={salaryDeductions} onChange={(e) => setSalaryDeductions(e.target.value)} />
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 flex justify-between font-bold text-emerald-700 text-lg mt-2">
                      <span>Net Salary:</span>
                      <span>₹{Math.max(0, salaryBreakdown.grossSalary + Number(salaryAllowances || 0) - (salaryBreakdown.leaveDeduction + Number(salaryDeductions || 0))).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => setSalaryStep(2)}>Back</button>
                      <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={salaryGenerating}>
                        {salaryGenerating ? "Generating..." : "Generate Salary"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          ) : null}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="font-semibold">Expense Allocator</h4>
            <p className="mt-1 text-xs text-slate-400">Disburse money or hardware for accepted expense requests.</p>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {data.expenses.filter((e) => String(e.status) === "accepted").length === 0 ? (
                <p className="py-2 text-sm text-slate-500">No accepted expenses ready for disbursement.</p>
              ) : null}
              {data.expenses.filter((e) => String(e.status) === "accepted").map((expense) => (
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2" key={String(expense.id)}>
                  <div>
                    <p className="text-sm font-medium">{String(expense.title)}</p>
                    <p className="text-xs text-slate-500">
                      {displayNested(expense.requester, "name", "Member")} • {String(expense.category)} • ₹{Number(expense.amount ?? 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white" onClick={() => updateStatus("expense", String(expense.id), "disbursed")}>Disburse</button>
                </div>
              ))}
            </div>
            {data.expenses.filter((e) => String(e.status) === "disbursed").length > 0 ? (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="mb-2 text-xs font-medium text-slate-500">Disbursed</p>
                {data.expenses.filter((e) => String(e.status) === "disbursed").map((expense) => (
                  <div className="flex items-center justify-between py-1.5 text-sm" key={String(expense.id)}>
                    <span>₹{Number(expense.amount ?? 0).toLocaleString("en-IN")} — {String(expense.title)} <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">disbursed</span></span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
          {/* Invoices */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Invoices
                {invoices.length > 0 ? (
                  <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{invoices.length}</span>
                ) : null}
              </h4>
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white" onClick={() => setShowInvoiceForm(true)}>Create Invoice</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Generate client invoices and track payments.</p>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {invoices.length === 0 ? <p className="py-2 text-sm text-slate-500">No invoices yet.</p> : null}
              {invoices.map((inv) => (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2" key={String(inv.id)}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{String(inv.clientName)} — ₹{Number(inv.amount ?? 0).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-slate-500 truncate">{String(inv.invoiceNumber)} • {String(inv.status)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isFinanceOrAdmin ? (
                      String(inv.status) === "pending"
                        ? <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => markInvoice(String(inv.id), "paid")}>Mark paid</button>
                        : <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={() => markInvoice(String(inv.id), "pending")}>Mark pending</button>
                    ) : null}
                    <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={() => window.open(`/invoice/${String(inv.id)}`, "_blank")}>PDF</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          {/* Project Budget Allocation */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Project Budget Allocation</h4>
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white" onClick={() => openBudgetModal()}>Allocate Budget</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Set project budgets and submit for approval.</p>
          </section>
          {/* Resource Purchase Approval */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Resource Purchase
                {resourceRequests.filter((r) => String(r.status) === "pending").length > 0 ? (
                  <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {resourceRequests.filter((r) => String(r.status) === "pending").length} pending
                  </span>
                ) : null}
              </h4>
              {!isFinanceOrAdmin ? (
                <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white" onClick={() => setShowResourceForm(true)}>Request Resource</button>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-400">{isFinanceOrAdmin ? "Approve or reject resource purchase requests." : "Request resources for your team."}</p>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {resourceRequests.length === 0 ? <p className="py-2 text-sm text-slate-500">No resource requests.</p> : null}
              {resourceRequests.map((req) => {
                const items = Array.isArray(req.items) ? req.items : [];
                const itemSummary = items.map((i: any) => `${i.quantity ?? 1} x ${i.name}`).join(", ");
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2" key={String(req.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{itemSummary || "Resources"}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {displayNested(req.requester, "name", "User")} • {String(req.status)}
                        {req.rejectionReason ? <> • Reason: {String(req.rejectionReason)}</> : null}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {String(req.status) === "pending" && isFinanceOrAdmin ? (
                        <>
                          <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => processResourceRequest(String(req.id), "approved")}>Approve</button>
                          <button className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600" onClick={() => processResourceRequest(String(req.id), "rejected")}>Reject</button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Allocated Budgets
                {data.budgets.filter((b) => String(b.status) === "pending").length > 0 ? (
                  <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {data.budgets.filter((b) => String(b.status) === "pending").length} pending
                  </span>
                ) : null}
              </h4>
              {actorRole === "finance" ? (
                <button className="text-sm text-blue-600 underline" onClick={() => setShowExpiredBudgets(true)}>View expired budgets</button>
              ) : null}
            </div>
            <div className="mt-4 divide-y divide-slate-200">
              {data.budgets.map((budget) => {
                const deadline = budget.deadline ? new Date(String(budget.deadline)) : null;
                const isExpired = deadline && (Date.now() - deadline.getTime()) > 25 * 24 * 60 * 60 * 1000;
                if (isExpired) return null;
                const budgetStatus = String(budget.status ?? "pending");
                const budgetAssignedTo = (budget.assignedTo as AnyRecord)?._id ?? (budget.assignedTo as AnyRecord)?.id ?? "";
                const isPendingForMe =
                  (actorRole === "finance" && String(budgetAssignedTo) === profileId && budgetStatus === "pending") ||
                  (actorRole === "admin" && !budget.assignedTo && budgetStatus === "pending");
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(budget.id)}>
                    <div>
                      <p className="font-medium">{displayNested(budget.board, "title", "Board")}</p>
                      <p className="text-sm text-slate-500">
                        Total: ₹{Number(budget.totalBudget ?? 0).toLocaleString("en-IN")}
                        {Number(budget.teamSpendingLimit ?? 0) > 0 ? <> • Team limit: ₹{Number(budget.teamSpendingLimit).toLocaleString("en-IN")}</> : null}
                        {Number(budget.resourceBudget ?? 0) > 0 ? <> • Resource: ₹{Number(budget.resourceBudget).toLocaleString("en-IN")}</> : null}
                        {budget.deadline ? <> • Deadline: {new Date(String(budget.deadline)).toLocaleDateString()}</> : null}
                        {budget.decidedBy ? <> • By: {displayNested(budget.decidedBy, "name", "User")}</> : null}
                      </p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${budgetStatus === "approved" ? "bg-emerald-100 text-emerald-700" :
                        budgetStatus === "rejected" ? "bg-rose-100 text-rose-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>{budgetStatus}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={() => openBudgetModal(budget)}>Edit</button>
                      {isPendingForMe ? (
                        <>
                          <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus("budget", String(budget.id), "approved")}>Approve</button>
                          <button className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600" onClick={() => setRejectTarget({ id: String(budget.id), type: "budget" })}>Reject</button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {data.budgets.filter((b) => {
                const d = b.deadline ? new Date(String(b.deadline)) : null;
                return !(d && (Date.now() - d.getTime()) > 25 * 24 * 60 * 60 * 1000);
              }).length === 0 ? <p className="py-4 text-sm text-slate-500">No budgets allocated yet.</p> : null}
            </div>
          </section>
          {showExpiredBudgets ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold">Expired Budgets</h4>
                  <button className="text-sm text-slate-500" onClick={() => setShowExpiredBudgets(false)}>Close</button>
                </div>
                <div className="mt-4 divide-y divide-slate-200">
                  {data.budgets.filter((b) => {
                    const d = b.deadline ? new Date(String(b.deadline)) : null;
                    return d && (Date.now() - d.getTime()) > 25 * 24 * 60 * 60 * 1000;
                  }).length === 0 ? <p className="py-4 text-sm text-slate-500">No expired budgets.</p> : null}
                  {data.budgets.map((budget) => {
                    const deadline = budget.deadline ? new Date(String(budget.deadline)) : null;
                    const isExpired = deadline && (Date.now() - deadline.getTime()) > 25 * 24 * 60 * 60 * 1000;
                    if (!isExpired) return null;
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(budget.id)}>
                        <div>
                          <p className="font-medium">{displayNested(budget.board, "title", "Board")}</p>
                          <p className="text-sm text-slate-500">
                            Total: ₹{Number(budget.totalBudget ?? 0).toLocaleString("en-IN")}
                            {budget.deadline ? <> • Deadline: {new Date(String(budget.deadline)).toLocaleDateString()}</> : null}
                            {budget.decidedBy ? <> • Set by: {displayNested(budget.decidedBy, "name", "User")}</> : null}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          {showBudgetModal ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
                <h4 className="text-lg font-semibold">{editingBudgetId ? "Edit Budget" : "Allocate Budget"}</h4>
                <form className="mt-4 grid gap-3" onSubmit={submitBudget}>
                  <select className="rounded-lg border border-slate-200 px-3 py-2" required value={budgetForm.boardId} onChange={(e) => setBudgetForm({ ...budgetForm, boardId: e.target.value })}>
                    <option value="">Select project</option>
                    {data.boards.map((board: AnyRecord) => (
                      <option key={String(board.id)} value={String(board.id)}>
                        {String(board.title)} ({String(board.label ?? "Created by Unknown")})
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Total project budget" type="number" value={budgetForm.totalBudget} onChange={(e) => setBudgetForm({ ...budgetForm, totalBudget: e.target.value })} />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Team spending limit" type="number" value={budgetForm.teamSpendingLimit} onChange={(e) => setBudgetForm({ ...budgetForm, teamSpendingLimit: e.target.value })} />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Resource budget" type="number" value={budgetForm.resourceBudget} onChange={(e) => setBudgetForm({ ...budgetForm, resourceBudget: e.target.value })} />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" type="date" value={budgetForm.deadline} onChange={(e) => setBudgetForm({ ...budgetForm, deadline: e.target.value })} />
                  </div>
                  {actorRole === "admin" ? (
                    <select className="rounded-lg border border-slate-200 px-3 py-2" required value={budgetForm.assignedTo} onChange={(e) => setBudgetForm({ ...budgetForm, assignedTo: e.target.value })}>
                      <option value="">Assign a finance user to approve</option>
                      {data.financeMembers.map((fm) => (
                        <option key={String(fm.id)} value={String(fm.id)}>{String(fm.name)}</option>
                      ))}
                    </select>
                  ) : null}
                  <div className="flex justify-end gap-3">
                    <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => { setShowBudgetModal(false); setEditingBudgetId(null); }}>Cancel</button>
                    <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">{editingBudgetId ? "Update" : "Allocate"}</button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
          {/* Invoice form modal */}
          {showInvoiceForm ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
                <h4 className="text-lg font-semibold">Create Invoice</h4>
                <form className="mt-4 grid gap-3" onSubmit={createInvoice}>
                  <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Client name" value={invoiceForm.clientName} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value })} />
                  <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Client email" type="email" value={invoiceForm.clientEmail} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientEmail: e.target.value })} />
                  <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Amount" type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
                  <textarea className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Description (optional)" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
                  <div className="flex justify-end gap-3">
                    <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => { setShowInvoiceForm(false); setInvoiceForm({ boardId: "", clientName: "", clientEmail: "", amount: "", description: "" }); }}>Cancel</button>
                    <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">Create</button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
          {/* Resource request form modal */}
          {showResourceForm ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
                <h4 className="text-lg font-semibold">Request Resource</h4>
                <form className="mt-4 grid gap-3" onSubmit={createResourceRequest}>
                  {resourceForm.items.map((item, idx) => (
                    <div className="flex gap-2 items-start" key={idx}>
                      <div className="flex-1 grid gap-2">
                        <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Item name" value={item.name} onChange={(e) => updateResourceItem(idx, "name", e.target.value)} />
                        <div className="flex gap-2">
                          <input className="w-24 rounded-lg border border-slate-200 px-3 py-2" required placeholder="Qty" type="number" min={1} value={item.quantity} onChange={(e) => updateResourceItem(idx, "quantity", Number(e.target.value))} />
                          <input className="flex-1 rounded-lg border border-slate-200 px-3 py-2" placeholder="Reason" value={item.reason} onChange={(e) => updateResourceItem(idx, "reason", e.target.value)} />
                        </div>
                      </div>
                      <button type="button" className="mt-2 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600" onClick={() => removeResourceItem(idx)}>X</button>
                    </div>
                  ))}
                  <button type="button" className="text-sm text-blue-600 underline text-left" onClick={addResourceItem}>+ Add item</button>
                  <textarea className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Additional notes (optional)" value={resourceForm.notes} onChange={(e) => setResourceForm({ ...resourceForm, notes: e.target.value })} />
                  <div className="flex justify-end gap-3">
                    <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => { setShowResourceForm(false); setResourceForm({ items: [{ name: "", quantity: 1, reason: "" }], notes: "" }); }}>Cancel</button>
                    <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">Submit</button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>) : null}

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
          {actorRole !== "finance" ? (
            <select className="rounded-lg border border-slate-200 px-3 py-2" required value={expenseForm.assignedTo} onChange={(e) => setExpenseForm({ ...expenseForm, assignedTo: e.target.value })}>
              <option value="">Assign finance user</option>
              {data.financeMembers.map((fm) => (
                <option key={String(fm.id)} value={String(fm.id)}>{String(fm.name)}</option>
              ))}
            </select>
          ) : null}
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
              {/* {actorRole === "finance" ? (
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={() => editSalary(salary)}>Edit</button>
              ) : null} */}
              {String(salary.status) === "pending" && actorRole === "admin" ? (
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={() => updateStatus("salary", String(salary.id), "approved")}>Approve payout</button>
              ) : null}
              {String(salary.status) === "approved" && actorRole === "finance" ? (
                <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus("salary", String(salary.id), "paid")}>Mark paid</button>
              ) : null}
            </div>
          ))}
          {data.salaries.length === 0 ? <p className="py-4 text-sm text-slate-500">No salary records for this month.</p> : null}
        </div>
      </section>

      {/* Leave Impact on Payroll */}
      {leaveImpacts.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold">Leave Impact on Payroll</h4>
          <p className="mt-1 text-xs text-slate-400">Approved leave deductions for {month}</p>
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
                {leaveImpacts.map((impact, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">{impact.employeeName}</td>
                    <td className="py-3 pr-4">{impact.leaves}</td>
                    <td className="py-3 text-right text-rose-600">-₹{impact.deduction.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-3 pr-4">Total</td>
                  <td className="pt-3 pr-4">{leaveImpacts.reduce((s, i) => s + i.leaves, 0)}</td>
                  <td className="pt-3 text-right text-rose-600">-₹{leaveImpacts.reduce((s, i) => s + i.deduction, 0).toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold">Expense Requests</h4>
        <div className="mt-4 divide-y divide-slate-200">
          {data.expenses.map((expense) => {
            const assignedToId = expense.assignedTo ? String((expense.assignedTo as AnyRecord)._id ?? (expense.assignedTo as AnyRecord).id ?? "") : "";
            const isAssignedToMe = assignedToId === String(profileId);
            const noAssignment = !expense.assignedTo;
            const hasAssigned = !!expense.assignedTo;
            const expStatus = String(expense.status);

            const canForward = actorRole === "finance" && expStatus === "pending" && isAssignedToMe;
            const canAdminApprove = actorRole === "admin" && (expStatus === "forwarded" || (expStatus === "pending" && noAssignment));
            const canAccept = actorRole === "finance" && expStatus === "approved" && (noAssignment || isAssignedToMe);
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(expense.id)}>
                <div>
                  <p className="font-medium">{String(expense.title)} - ₹{Number(expense.amount ?? 0).toLocaleString("en-IN")}</p>
                  <p className="text-sm text-slate-500">
                    {displayNested(expense.requester, "name", "Requester")} • {String(expense.category)} • {String(expense.status)}
                    {expense.assignedTo ? <> • Assigned: {displayNested(expense.assignedTo, "name", "Finance")}</> : null}
                    {expense.forwardedBy ? <> • Forwarded: {displayNested(expense.forwardedBy, "name", "Finance")}</> : null}
                    {expense.rejectionReason ? <> • Reason: {String(expense.rejectionReason)}</> : null}
                    {expense.acceptedBy ? <> • Accepted: {displayNested(expense.acceptedBy, "name", "Finance")}</> : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canForward ? (
                    <>
                      <button className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600" onClick={() => setRejectTarget({ id: String(expense.id), type: "expense" })}>Reject</button>
                      <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus("expense", String(expense.id), "forwarded")}>Forward to admin</button>
                    </>
                  ) : null}
                  {canAdminApprove ? (
                    <>
                      <button className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600" onClick={() => setRejectTarget({ id: String(expense.id), type: "expense" })}>Reject</button>
                      <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus("expense", String(expense.id), "approved")}>Approve</button>
                    </>
                  ) : null}
                  {canAccept ? (
                    <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus("expense", String(expense.id), "accepted")}>Accept</button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {data.expenses.length === 0 ? <p className="py-4 text-sm text-slate-500">No expense requests yet.</p> : null}
        </div>
      </section>
      {rejectTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h4 className="text-lg font-semibold">Rejection reason</h4>
            <textarea className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2" rows={3} placeholder="Why are you rejecting this request?" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="mt-4 flex justify-end gap-3">
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</button>
              <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={!rejectReason.trim()} onClick={rejectItem}>Reject</button>
            </div>
          </div>
        </div>
      ) : null}
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
