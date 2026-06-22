import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord, displayNested, formatRole, formatRoleWithCustom } from "./shared";

type FinanceData = {
  month: string;
  canManage: boolean;
  monthEndGenerated: boolean;
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
    pfDeduction: number;
    esicDeduction: number;
    allowances: number;
    manualDeductions: number;
    totalDeductions: number;
    foodDeduction: number;
    travelDeduction: number;
    grossSalary: number;
    finalSalary: number;
    periodStart: string;
    periodEnd: string;
  } | null>(null);
  const [memberPfNumber, setMemberPfNumber] = useState("");
  const [memberPfAmount, setMemberPfAmount] = useState("");
  const [memberEsicNumber, setMemberEsicNumber] = useState("");
  const [memberEsicAmount, setMemberEsicAmount] = useState("");
  const [salaryGenerating, setSalaryGenerating] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ boardId: "", totalBudget: "", teamSpendingLimit: "", resourceBudget: "", deadline: "", assignedTo: "" });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [showExpiredBudgets, setShowExpiredBudgets] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: "software", title: "", amount: "", quantity: "1", reason: "", assignedTo: "" });
  const [forwardAdminByExpense, setForwardAdminByExpense] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: "expense" | "budget" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteSalaryId, setDeleteSalaryId] = useState<string | null>(null);
  const [deleteSalaryEmployee, setDeleteSalaryEmployee] = useState("");

  // Invoice
  const [invoices, setInvoices] = useState<AnyRecord[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ boardId: "", clientName: "", clientEmail: "", amount: "", description: "" });

  // Reports
  const [reports, setReports] = useState<{ revenue: number; expenses: number; profit: number; pendingInvoices: number; pendingInvoicesAmount: number } | null>(null);

  // Leave impact
  const [leaveImpacts, setLeaveImpacts] = useState<{ employeeName: string; leaves: number; deduction: number }[]>([]);

  // Salary overview modal
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryModalTab, setSalaryModalTab] = useState<"unpaid" | "paid">("unpaid");
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  // Personal salary slips
  const [mySlips, setMySlips] = useState<AnyRecord[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(true);

  const [financeSubTab, setFinanceSubTab] = useState<"my" | "ops" | "reports">("my");

  // Policies
  const [policyData, setPolicyData] = useState<{
    foodAmount: number;
    travelAccommodationAmount: number;
    foodOptedOutMembers: { _id: string; name: string; email: string; role: string }[];
    travelOptedOutMembers: { _id: string; name: string; email: string; role: string }[];
  } | null>(null);
  const [foodOptedIn, setFoodOptedIn] = useState(true);
  const [travelOptedIn, setTravelOptedIn] = useState(true);

  useEffect(() => {
    if (!policyData || !profileId) return;
    setFoodOptedIn(!policyData.foodOptedOutMembers.some((m) => String(m._id) === String(profileId)));
    setTravelOptedIn(!policyData.travelOptedOutMembers.some((m) => String(m._id) === String(profileId)));
  }, [policyData, profileId]);

  async function toggleOptInOut(type: "food" | "travel", optedIn: boolean) {
    try {
      await apiFetch("/api/finance/policy", {
        method: "PATCH",
        body: JSON.stringify({ type, optedIn }),
      });
      if (type === "food") {
        setFoodOptedIn(optedIn);
      } else {
        setTravelOptedIn(optedIn);
      }
      showToast(`Successfully ${optedIn ? "opted in" : "opted out"} of ${type} policy.`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update policy.", "error");
    }
  }

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

  // Load policy data
  useEffect(() => {
    if (!data) return;
    apiFetch<{ foodAmount: number; travelAccommodationAmount: number; foodOptedOutMembers: { _id: string; name: string; email: string; role: string }[]; travelOptedOutMembers: { _id: string; name: string; email: string; role: string }[] }>("/api/finance/policy")
      .then((res) => setPolicyData({
        foodAmount: res.foodAmount,
        travelAccommodationAmount: res.travelAccommodationAmount,
        foodOptedOutMembers: res.foodOptedOutMembers ?? [],
        travelOptedOutMembers: res.travelOptedOutMembers ?? [],
      }))
      .catch(() => { });
  }, [data]);

  // Load personal salary slips
  useEffect(() => {
    setSlipsLoading(true);
    apiFetch<{ salaries: AnyRecord[] }>("/api/finance/salary-slip?employee=me")
      .then((res) => setMySlips(res.salaries ?? []))
      .catch(() => setMySlips([]))
      .finally(() => setSlipsLoading(false));
  }, [month]);

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
      setMemberPfNumber(res.employee?.pfNumber ?? "");
      setMemberPfAmount(String(Number(res.employee?.pfDeductionAmount ?? 0) > 0 ? Number(res.employee?.pfDeductionAmount) : ""));
      setMemberEsicNumber(res.employee?.esicNumber ?? "");
      setMemberEsicAmount(String(Number(res.employee?.esicDeductionAmount ?? 0) > 0 ? Number(res.employee?.esicDeductionAmount) : ""));
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
          pfNumber: memberPfNumber,
          pfDeductionAmount: memberPfAmount ? Number(memberPfAmount) : 0,
          esicNumber: memberEsicNumber,
          esicDeductionAmount: memberEsicAmount ? Number(memberEsicAmount) : 0,
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
    setExpenseForm({ category: "software", title: "", amount: "", quantity: "1", reason: "", assignedTo: "" });
    showToast("Expense request submitted.", "success");
    await load();
  }

  async function togglePolicyOptOut(type: "food" | "travel") {
    try {
      const res = await apiFetch<{
        foodAmount: number;
        travelAccommodationAmount: number;
        foodOptedOutMembers: { _id: string; name: string; email: string; role: string }[];
        travelOptedOutMembers: { _id: string; name: string; email: string; role: string }[];
        nowOptedOut: boolean;
      }>("/api/finance/policy", {
        method: "PATCH",
        body: JSON.stringify({ memberId: profileId, type }),
      });
      setPolicyData({
        foodAmount: res.foodAmount,
        travelAccommodationAmount: res.travelAccommodationAmount,
        foodOptedOutMembers: res.foodOptedOutMembers,
        travelOptedOutMembers: res.travelOptedOutMembers,
      });
      const label = type === "food" ? "Food Allowance" : "Travel Accommodation";
      showToast(res.nowOptedOut ? `You opted out of ${label} deductions.` : `You opted back into ${label} deductions.`, "success");
    } catch {
      showToast("Unable to update policy opt-out.", "error");
    }
  }

  async function updateStatus(type: "salary" | "expense" | "budget" | "bill", id: string, status: string, extra: Record<string, string> = {}) {
    await apiFetch("/api/finance", {
      method: "PATCH",
      body: JSON.stringify({ type, id, status, ...extra }),
    });
    showToast(`${type === "salary" ? "Salary" : type === "budget" ? "Budget" : type === "bill" ? "Bill" : "Expense"} ${status}.`, "success");
    await load();
  }

  async function deleteSalary() {
    if (!deleteSalaryId) return;
    try {
      await apiFetch(`/api/finance/salary/${deleteSalaryId}`, { method: "DELETE" });
      showToast("Salary record deleted.", "success");
      setDeleteSalaryId(null);
      setDeleteSalaryEmployee("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete salary record.", "error");
    }
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

  // Salary edit (removed in favor of regenerate)
  const salaryFormRef = useRef<HTMLDivElement>(null);

  const memberRoleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of data?.members ?? []) {
      map.set(String(m.id), String(m.role));
    }
    return map;
  }, [data?.members]);

  const getSalaryRole = (salary: AnyRecord): string => {
    const empId = String((salary.employee as AnyRecord)?._id ?? (salary.employee as AnyRecord)?.id ?? "");
    return memberRoleMap.get(empId) || displayNested(salary.employee, "role", "employee");
  };

  const toggleRole = (role: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  if (!data) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">Loading finance...</section>;
  }

  const isFinanceOrAdmin = actorRole === "finance" || actorRole === "admin";
  const adminOptions = data.members.filter((m) => String(m.role) === "admin");

  const tabClass = (t: string) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
      financeSubTab === t
        ? "bg-slate-950 text-white shadow-sm"
        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-4 border-amber-500 pl-4">
          <h3 className="text-base font-semibold text-slate-900">Finance</h3>
          <p className="mt-0.5 text-sm text-slate-500">Payroll, payout status, budgets, and expense requests.</p>
        </div>
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </div>

      {isFinanceOrAdmin && (() => {
        const today = new Date().getDate();
        if (today >= 20 && today <= 21) {
          return (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Salary Reminder
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Generate salaries by the 28th of this month to ensure timely processing.
                </p>
              </div>
              {actorRole === "finance" ? (
                <button
                  className="shrink-0 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900"
                  onClick={() => setShowSalaryModal(true)}
                >
                  View
                </button>
              ) : null}
            </div>
          );
        }
        if (today >= 22 && today <= 27) {
          return (
            <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 p-4">
              <div>
                <p className="text-sm font-medium text-sky-800">
                  Salary Reminder
                </p>
                <p className="mt-1 text-xs text-sky-700">
                  Don't forget to generate salaries before the 28th.
                </p>
              </div>
              {actorRole === "finance" ? (
                <button
                  className="shrink-0 rounded-lg bg-sky-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-900"
                  onClick={() => setShowSalaryModal(true)}
                >
                  View
                </button>
              ) : null}
            </div>
          );
        }
        return null;
      })()}

      {(() => {
        // Counts for badge display on each sub-tab
        const myRequestsCount = data.expenses.filter((e) => {
          const status = String(e.status ?? "");
          // Show badge for expenses the current user requested that are still actionable
          return status === "pending" || status === "forwarded";
        }).length;

        const pendingSalariesCount = data.salaries.filter((s) => String(s.status ?? "") === "pending").length;
        const pendingBudgetsCount = data.budgets.filter((b) => String(b.status ?? "") === "pending").length;
        const acceptedExpensesCount = data.expenses.filter((e) => String(e.status ?? "") === "accepted").length;
        const opsCount = pendingSalariesCount + pendingBudgetsCount + acceptedExpensesCount;

        const pendingInvoicesCount = invoices.filter((inv) => String(inv.status ?? "") === "pending").length;

        const Badge = ({ count }: { count: number }) =>
          count > 0 ? (
            <span
              className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
                financeSubTab === "my" || financeSubTab === "ops" || financeSubTab === "reports"
                  ? "bg-amber-400 text-amber-900"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {count}
            </span>
          ) : null;

        return (
          <div className="flex gap-2">
            <button className={tabClass("my")} onClick={() => setFinanceSubTab("my")}>
              My Requests
              {myRequestsCount > 0 && (
                <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${financeSubTab === "my" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                  {myRequestsCount}
                </span>
              )}
            </button>
            <button className={tabClass("ops")} onClick={() => setFinanceSubTab("ops")}>
              Operations
              {opsCount > 0 && (
                <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${financeSubTab === "ops" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>
                  {opsCount}
                </span>
              )}
            </button>
            <button className={tabClass("reports")} onClick={() => setFinanceSubTab("reports")}>
              Reports
              {pendingInvoicesCount > 0 && (
                <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${financeSubTab === "reports" ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"}`}>
                  {pendingInvoicesCount}
                </span>
              )}
            </button>
          </div>
        );
      })()}

      {data.monthEndGenerated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Salaries auto-generated for {data.month}
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            {data.dashboard.pendingSalaries} salary record(s) are pending admin approval. The least-loaded admin has been notified.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <FinanceCard label="Total payroll this month" value={`₹${Number(data.dashboard.totalPayroll).toLocaleString("en-IN")}`} />
        <FinanceCard label="Pending salaries" value={String(data.dashboard.pendingSalaries)} />
        <FinanceCard label="Paid salaries" value={String(data.dashboard.paidSalaries)} />
      </div>

      {/* ══════════ My Requests ══════════ */}
      {financeSubTab === "my" ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
            <div className="mb-5 border-l-4 border-rose-500 pl-4">
              <h3 className="text-base font-semibold text-slate-900">Expense Request</h3>
              <p className="mt-0.5 text-sm text-slate-500">Submit a new expense for approval</p>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={submitExpense}>
              <select className="rounded-lg border border-slate-200 px-3 py-2" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                <option value="software">Software purchase</option>
                <option value="device">Laptop/device</option>
                <option value="travel">Travel expense</option>
                <option value="office-resources">Office resources</option>
              </select>
              <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Title" value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Amount" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" required min={1} placeholder="Quantity" type="number" value={expenseForm.quantity} onChange={(e) => setExpenseForm({ ...expenseForm, quantity: e.target.value })} />
              {actorRole !== "finance" ? (
                <select className="rounded-lg border border-slate-200 px-3 py-2" required value={expenseForm.assignedTo} onChange={(e) => setExpenseForm({ ...expenseForm, assignedTo: e.target.value })}>
                  <option value="">Assign finance user</option>
                  {data.financeMembers.map((fm) => (
                    <option key={String(fm.id)} value={String(fm.id)}>{String(fm.name)}</option>
                  ))}
                </select>
              ) : null}
              <ActionButton variant="primary">Request</ActionButton>
              <textarea className="rounded-lg border border-slate-200 px-3 py-2 md:col-span-4" placeholder="Reason" value={expenseForm.reason} onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })} />
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
            <div className="mb-5 border-l-4 border-rose-500 pl-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                My Expense Requests
                {data.expenses.length > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-100 px-1.5 text-[11px] font-bold text-rose-700">{data.expenses.length}</span>
                )}
                {data.expenses.filter((e) => ["pending", "forwarded"].includes(String(e.status ?? ""))).length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    {data.expenses.filter((e) => ["pending", "forwarded"].includes(String(e.status ?? ""))).length} pending
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">Track and manage your expense submissions</p>
            </div>
            <div className="mt-4 divide-y divide-slate-200">
              {data.expenses.map((expense) => {
            const expenseId = String(expense.id);
            const assignedToId = expense.assignedTo ? String((expense.assignedTo as AnyRecord)._id ?? (expense.assignedTo as AnyRecord).id ?? "") : "";
            const adminApproverId = expense.adminApprover ? String((expense.adminApprover as AnyRecord)._id ?? (expense.adminApprover as AnyRecord).id ?? "") : "";
            const isAssignedToMe = assignedToId === String(profileId);
            const isAssignedAdmin = adminApproverId === String(profileId);
            const noAssignment = !expense.assignedTo;
            const hasAssigned = !!expense.assignedTo;
            const expStatus = String(expense.status);

            const canForward = actorRole === "finance" && expStatus === "pending" && isAssignedToMe;
            const canAdminApprove = actorRole === "admin" && ((expStatus === "forwarded" && isAssignedAdmin) || (expStatus === "pending" && noAssignment));
            const canAccept = actorRole === "finance" && expStatus === "approved" && (noAssignment || isAssignedToMe);
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={expenseId}>
                <div>
                  <p className="font-medium">{String(expense.title)} x {Number(expense.quantity ?? 1)} - ₹{Number(expense.amount ?? 0).toLocaleString("en-IN")}</p>
                  <p className="text-sm text-slate-500">
                    {displayNested(expense.requester, "name", "Requester")} • {String(expense.category)} • <span className={expStatus === "accepted" ? "text-amber-600 font-semibold" : ""}>{String(expense.status)}{expStatus === "accepted" ? " (Not Disbursed)" : ""}</span>
                    {expense.assignedTo ? <> • Assigned: {displayNested(expense.assignedTo, "name", "Finance")}</> : null}
                    {expense.forwardedBy ? <> • Forwarded: {displayNested(expense.forwardedBy, "name", "Finance")}</> : null}
                    {expense.rejectionReason ? <> • Reason: {String(expense.rejectionReason)}</> : null}
                    {expense.adminApprover ? <> • Admin: {displayNested(expense.adminApprover, "name", "Admin")}</> : null}
                    {expense.acceptedBy ? <> • Accepted: {displayNested(expense.acceptedBy, "name", "Finance")}</> : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canForward ? (
                    <>
                      <ActionButton variant="danger" className="px-3" onClick={() => setRejectTarget({ id: expenseId, type: "expense" })}>Reject</ActionButton>
                      <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" required value={forwardAdminByExpense[expenseId] ?? ""} onChange={(e) => setForwardAdminByExpense({ ...forwardAdminByExpense, [expenseId]: e.target.value })}>
                        <option value="">Select admin</option>
                        {adminOptions.map((admin) => (
                          <option key={String(admin.id)} value={String(admin.id)}>{String(admin.name ?? admin.email ?? "Admin")}</option>
                        ))}
                      </select>
                      <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={!forwardAdminByExpense[expenseId]} onClick={() => updateStatus("expense", expenseId, "forwarded", { adminApprover: forwardAdminByExpense[expenseId] })}>Forward to admin</button>
                    </>
                  ) : null}
                  {canAdminApprove ? (
                    <>
                      <ActionButton variant="danger" className="px-3" onClick={() => setRejectTarget({ id: expenseId, type: "expense" })}>Reject</ActionButton>
                      <ActionButton variant="approve" className="px-3" onClick={() => updateStatus("expense", expenseId, "approved")}>Approve</ActionButton>
                    </>
                  ) : null}
                  {canAccept ? (
                    <ActionButton variant="approve" className="px-3" onClick={() => updateStatus("expense", expenseId, "accepted")}>Accept</ActionButton>
                  ) : null}
                </div>
              </div>
            );
          })}
          {data.expenses.length === 0 ? <p className="py-4 text-sm text-slate-500">No expense requests yet.</p> : null}
        </div>
      </section>
        </div>
      ) : null}

      {/* ══════════ Operations ══════════ */}
      {financeSubTab === "ops" ? (
        <div className="space-y-5">
          {data.canManage ? (
            <>
              <div className="grid gap-5 xl:grid-cols-2">
                {actorRole === "finance" ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]" ref={salaryFormRef}>
                    <div className="mb-5 border-l-4 border-emerald-500 pl-4">
                      <h3 className="text-base font-semibold text-slate-900">Generate Monthly Salary</h3>
                      <p className="mt-0.5 text-sm text-slate-500">Create salary records for employees</p>
                    </div>
                    <div className="mt-4">
                      {salaryStep === 1 && (
                        <form onSubmit={(e) => { e.preventDefault(); setSalaryStep(2); }} className="grid gap-3">
                          <p className="text-sm font-medium text-slate-700">Step 1: Select Date Range</p>
                          <div className="grid grid-cols-2 gap-3">
                            <input className="rounded-lg border border-slate-200 px-3 py-2" type="date" required value={salaryPeriod.start} onChange={(e) => setSalaryPeriod({ ...salaryPeriod, start: e.target.value })} />
                            <input className="rounded-lg border border-slate-200 px-3 py-2" type="date" required value={salaryPeriod.end} onChange={(e) => setSalaryPeriod({ ...salaryPeriod, end: e.target.value })} />
                          </div>
                          <ActionButton variant="primary" className="justify-self-end">Next</ActionButton>
                        </form>
                      )}
                      {salaryStep === 2 && (
                        <form onSubmit={calculateSalary} className="grid gap-3">
                          <p className="text-sm font-medium text-slate-700">Step 2: Select Employee</p>
                          <select className="rounded-lg border border-slate-200 px-3 py-2" required value={salaryEmployeeId} onChange={(e) => setSalaryEmployeeId(e.target.value)}>
                            <option value="">Select employee</option>
                            {data.members.map((member: AnyRecord) => (
                              <option key={String(member.id)} value={String(member.id)}>
                                {String(member.name)} - {formatRoleWithCustom(String(member.role), member.customRole)}
                              </option>
                            ))}
                          </select>
                          <div className="flex justify-between">
                            <ActionButton variant="secondary" type="button" onClick={() => setSalaryStep(1)}>Back</ActionButton>
                            <ActionButton variant="primary">Calculate</ActionButton>
                          </div>
                        </form>
                      )}
                      {salaryStep === 3 && salaryBreakdown && (
                        <form onSubmit={submitSalary} className="grid gap-3 text-sm">
                          <p className="font-medium text-slate-700">Step 3: Review & Adjust</p>
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
                            <div className="flex justify-between"><span>Period:</span> <span>{salaryBreakdown.periodStart} to {salaryBreakdown.periodEnd}</span></div>
                            {salaryBreakdown.periodStart !== salaryPeriod.start && (
                              <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">&#9888; Period adjusted — employee joined on {salaryBreakdown.periodStart}</p>
                            )}
                            <div className="flex justify-between"><span>Employee:</span><span className="font-medium text-slate-900">{(() => { const m = data.members.find((x: any) => String(x.id) === salaryEmployeeId); return m ? `${String(m.name)} (${formatRoleWithCustom(String(m.role), m.customRole)})` : "-"; })()}</span></div>
                            <div className="flex justify-between"><span>Total Days:</span> <span>{salaryBreakdown.totalDays}</span></div>
                            <div className="flex justify-between text-rose-600"><span>Absent Days:</span> <span>{salaryBreakdown.absentDays}</span></div>
                            <div className="flex justify-between text-emerald-600"><span>Paid Leave Days:</span> <span>{salaryBreakdown.paidLeaveDays}</span></div>
                            <div className="flex justify-between text-rose-600"><span>Unpaid Leave Days:</span> <span>{salaryBreakdown.unpaidLeaveDays}</span></div>
                            <div className="flex justify-between"><span>Payable Days:</span> <span>{salaryBreakdown.payableDays}</span></div>
                            <div className="flex justify-between"><span>Daily Salary:</span> <span>&#x20B9;{salaryBreakdown.dailySalary.toLocaleString("en-IN")}</span></div>
                            <div className="flex justify-between"><span>Gross Salary:</span> <span>&#x20B9;{salaryBreakdown.grossSalary.toLocaleString("en-IN")}</span></div>
                            <div className="flex justify-between text-rose-600"><span>Attendance/Leave Deduction:</span> <span>- &#x20B9;{salaryBreakdown.leaveDeduction.toLocaleString("en-IN")}</span></div>
                            {salaryBreakdown.foodDeduction > 0 ? <div className="flex justify-between text-rose-600"><span>Food Deduction:</span> <span>- &#x20B9;{salaryBreakdown.foodDeduction.toLocaleString("en-IN")}</span></div> : null}
                            {salaryBreakdown.travelDeduction > 0 ? <div className="flex justify-between text-rose-600"><span>Travel Accommodation Deduction:</span> <span>- &#x20B9;{salaryBreakdown.travelDeduction.toLocaleString("en-IN")}</span></div> : null}
                             <div className="flex justify-between text-emerald-600"><span>Total In Hand:</span> <span>&#x20B9;{Math.max(0, salaryBreakdown.grossSalary + Number(salaryAllowances || 0) - (Number(salaryDeductions || 0) + (salaryBreakdown.foodDeduction ?? 0) + (salaryBreakdown.travelDeduction ?? 0))).toLocaleString("en-IN")}</span></div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Manual Allowances (&#x20B9;)</label><input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="0" value={salaryAllowances} onChange={(e) => setSalaryAllowances(e.target.value)} /></div>
                            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Manual Deductions (&#x20B9;)</label><input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="number" min="0" value={salaryDeductions} onChange={(e) => setSalaryDeductions(e.target.value)} /></div>
                          </div>

                          {/* PF & ESIC */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-slate-500 mb-1 block">PF Account No.</label>
                              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="text" placeholder="Enter PF number" value={memberPfNumber} onChange={(e) => setMemberPfNumber(e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 mb-1 block">
                                PF Amount (&#x20B9;)
                                {(salaryBreakdown.pfDeduction ?? 0) > 0 ? <span className="ml-1 text-rose-600">(-&#x20B9;{salaryBreakdown.pfDeduction.toLocaleString("en-IN")})</span> : null}
                              </label>
                              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" min="0" placeholder="Leave empty for auto %" value={memberPfAmount} onChange={(e) => setMemberPfAmount(e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 mb-1 block">ESIC Account No.</label>
                              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="text" placeholder="Enter ESIC number" value={memberEsicNumber} onChange={(e) => setMemberEsicNumber(e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 mb-1 block">
                                ESIC Amount (&#x20B9;)
                                {(salaryBreakdown.esicDeduction ?? 0) > 0 ? <span className="ml-1 text-rose-600">(-&#x20B9;{salaryBreakdown.esicDeduction.toLocaleString("en-IN")})</span> : null}
                              </label>
                              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" min="0" placeholder="Leave empty for auto %" value={memberEsicAmount} onChange={(e) => setMemberEsicAmount(e.target.value)} />
                            </div>
                          </div>

                            <div className="rounded-lg bg-emerald-50 p-3 flex justify-between font-bold text-emerald-700 text-lg mt-2"><span>Net Salary:</span><span>&#x20B9;{Math.max(0, salaryBreakdown.grossSalary + Number(salaryAllowances || 0) - (Number(salaryDeductions || 0) + (salaryBreakdown.foodDeduction ?? 0) + (salaryBreakdown.travelDeduction ?? 0) + (memberPfAmount ? Number(memberPfAmount) : (salaryBreakdown.pfDeduction ?? 0)) + (memberEsicAmount ? Number(memberEsicAmount) : (salaryBreakdown.esicDeduction ?? 0)))).toLocaleString("en-IN")}</span></div>
                          <div className="flex justify-between mt-2">
                            <ActionButton variant="secondary" type="button" onClick={() => setSalaryStep(2)}>Back</ActionButton>
                            <ActionButton variant="approve" disabled={salaryGenerating}>{salaryGenerating ? "Generating..." : "Generate Salary"}</ActionButton>
                          </div>
                        </form>
                      )}
                    </div>
                  </section>
                ) : null}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
                  <div className="mb-5 border-l-4 border-rose-500 pl-4">
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      Expense Allocator
                      {data.expenses.filter((e) => String(e.status) === "accepted").length > 0 && (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-100 px-1.5 text-[11px] font-bold text-rose-700">
                          {data.expenses.filter((e) => String(e.status) === "accepted").length} to disburse
                        </span>
                      )}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-500">Disburse money or hardware for accepted expense requests.</p>
                  </div>
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {data.expenses.filter((e) => String(e.status) === "accepted").length === 0 ? <p className="py-2 text-sm text-slate-500">No accepted expenses ready for disbursement.</p> : null}
                    {data.expenses.filter((e) => String(e.status) === "accepted").map((expense) => (
                      <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2" key={String(expense.id)}>
                        <div>
                          <p className="text-sm font-medium">{String(expense.title)} x {Number(expense.quantity ?? 1)}</p>
                          <p className="text-xs text-slate-500">{displayNested(expense.requester, "name", "Member")} <span className="text-[10px] uppercase text-slate-400">({displayNested(expense.requester, "role", "–")})</span> &bull; {String(expense.category)} &bull; Qty: {Number(expense.quantity ?? 1)} &bull; &#x20B9;{Number(expense.amount ?? 0).toLocaleString("en-IN")}</p>
                        </div>
                        <ActionButton variant="approve" className="px-3 py-1.5 text-xs" onClick={() => updateStatus("expense", String(expense.id), "disbursed")}>Disburse</ActionButton>
                      </div>
                    ))}
                  </div>
                  {data.expenses.filter((e) => String(e.status) === "disbursed").length > 0 ? (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs font-medium text-slate-500">Disbursed</p>
                      {data.expenses.filter((e) => String(e.status) === "disbursed").map((expense) => (
                        <div key={String(expense.id)} className="flex items-center justify-between py-1.5 text-sm">
                          <span>&#x20B9;{Number(expense.amount ?? 0).toLocaleString("en-IN")} &mdash; {String(expense.title)} x {Number(expense.quantity ?? 1)} <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">disbursed</span></span>
                          <div className="ml-2 inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">{displayNested(expense.requester, "name", "Member")} ({displayNested(expense.requester, "role", "Member")})</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
                <div className="mb-5 border-l-4 border-sky-500 pl-4">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    Invoices
                    {invoices.length > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-100 px-1.5 text-[11px] font-bold text-sky-700">{invoices.length}</span>
                    )}
                    {invoices.filter((inv) => String(inv.status ?? "") === "pending").length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        {invoices.filter((inv) => String(inv.status ?? "") === "pending").length} unpaid
                      </span>
                    )}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-500">Generate client invoices and track payments.</p>
                </div>
                <div className="mb-3 flex justify-end">
                  <ActionButton variant="primary" onClick={() => setShowInvoiceForm(true)}>Create Invoice</ActionButton>
                </div>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {invoices.length === 0 ? <p className="py-2 text-sm text-slate-500">No invoices yet.</p> : null}
                  {invoices.map((inv) => (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2" key={String(inv.id)}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{String(inv.clientName)} &mdash; &#x20B9;{Number(inv.amount ?? 0).toLocaleString("en-IN")}</p>
                        <p className="text-xs text-slate-500 truncate">{String(inv.invoiceNumber)} &bull; {String(inv.status)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {isFinanceOrAdmin ? (String(inv.status) === "pending" ? <ActionButton variant="approve" className="px-2 py-1 text-xs" onClick={() => markInvoice(String(inv.id), "paid")}>Mark paid</ActionButton> : <ActionButton variant="secondary" className="px-2 py-1 text-xs" onClick={() => markInvoice(String(inv.id), "pending")}>Mark pending</ActionButton>) : null}
                        <ActionButton variant="secondary" className="px-2 py-1 text-xs" onClick={() => window.open(`/invoice/${String(inv.id)}`, "_blank")}>PDF</ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
                <div className="mb-5 border-l-4 border-violet-500 pl-4">
                  <h3 className="text-base font-semibold text-slate-900">Project Budget Allocation</h3>
                  <p className="mt-0.5 text-sm text-slate-500">Set project budgets and submit for approval.</p>
                </div>
                <div className="flex justify-end">
                  <ActionButton variant="primary" onClick={() => openBudgetModal()}>Allocate Budget</ActionButton>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
                <div className="mb-5 border-l-4 border-violet-500 pl-4">
                  <h3 className="text-base font-semibold text-slate-900">Allocated Budgets{data.budgets.filter((b) => String(b.status) === "pending").length > 0 ? <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{data.budgets.filter((b) => String(b.status) === "pending").length} pending</span> : null}</h3>
                  {actorRole === "finance" ? <button className="text-sm text-blue-600 underline" onClick={() => setShowExpiredBudgets(true)}>View expired budgets</button> : null}
                </div>
                <div className="mt-4 divide-y divide-slate-200">
                  {data.budgets.map((budget) => {
                    const deadline = budget.deadline ? new Date(String(budget.deadline)) : null;
                    const isExpired = deadline && (Date.now() - deadline.getTime()) > 25 * 24 * 60 * 60 * 1000;
                    if (isExpired) return null;
                    const budgetStatus = String(budget.status ?? "pending");
                    const budgetAssignedTo = (budget.assignedTo as AnyRecord)?._id ?? (budget.assignedTo as AnyRecord)?.id ?? "";
                    const isPendingForMe = (actorRole === "finance" && String(budgetAssignedTo) === profileId && budgetStatus === "pending") || (actorRole === "admin" && !budget.assignedTo && budgetStatus === "pending");
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(budget.id)}>
                        <div>
                          <p className="font-medium">{displayNested(budget.board, "title", "Board")}</p>
                          <p className="text-sm text-slate-500">Total: &#x20B9;{Number(budget.totalBudget ?? 0).toLocaleString("en-IN")}{Number(budget.teamSpendingLimit ?? 0) > 0 ? <> &bull; Team limit: &#x20B9;{Number(budget.teamSpendingLimit).toLocaleString("en-IN")}</> : null}{Number(budget.resourceBudget ?? 0) > 0 ? <> &bull; Resource: &#x20B9;{Number(budget.resourceBudget).toLocaleString("en-IN")}</> : null}{budget.deadline ? <> &bull; Deadline: {new Date(String(budget.deadline)).toLocaleDateString()}</> : null}{budget.decidedBy ? <> &bull; By: {displayNested(budget.decidedBy, "name", "User")}</> : null}</p>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${budgetStatus === "approved" ? "bg-emerald-100 text-emerald-700" : budgetStatus === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{budgetStatus}</span>
                        </div>
                        <div className="flex gap-2">
                          <ActionButton variant="secondary" className="px-3" onClick={() => openBudgetModal(budget)}>Edit</ActionButton>
                          {isPendingForMe ? (<><ActionButton variant="approve" className="px-3" onClick={() => updateStatus("budget", String(budget.id), "approved")}>Approve</ActionButton><ActionButton variant="danger" className="px-3" onClick={() => setRejectTarget({ id: String(budget.id), type: "budget" })}>Reject</ActionButton></>) : null}
                        </div>
                      </div>
                    );
                  })}
                  {data.budgets.filter((b) => { const d = b.deadline ? new Date(String(b.deadline)) : null; return !(d && (Date.now() - d.getTime()) > 25 * 24 * 60 * 60 * 1000); }).length === 0 ? <p className="py-4 text-sm text-slate-500">No budgets allocated yet.</p> : null}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
                <div className="mb-5 border-l-4 border-emerald-500 pl-4">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    Salary Records
                    {data.salaries.length > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[11px] font-bold text-emerald-700">{data.salaries.length}</span>
                    )}
                    {data.salaries.filter((s) => String(s.status ?? "") === "pending").length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        {data.salaries.filter((s) => String(s.status ?? "") === "pending").length} pending
                      </span>
                    )}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-500">Manage monthly salary payouts</p>
                </div>
                <div className="mt-4 divide-y divide-slate-200">
                  {data.salaries.map((salary) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(salary.id)}>
                      <div>
                        <p className="font-medium">{displayNested(salary.employee, "name", "Employee")} - &#x20B9;{Number(salary.netSalary ?? 0).toLocaleString("en-IN")}</p>
                        <p className="text-sm text-slate-500">{String(salary.month)} &bull; {String(salary.status)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {String(salary.status) === "pending" && actorRole === "finance" ? <ActionButton variant="danger" className="px-3" onClick={() => { setDeleteSalaryId(String(salary.id)); setDeleteSalaryEmployee(displayNested(salary.employee, "name", "Employee")); }}>Delete</ActionButton> : null}
                        {String(salary.status) === "pending" && actorRole === "admin" ? <><ActionButton variant="secondary" className="px-3" onClick={() => updateStatus("salary", String(salary.id), "approved")}>Approve payout</ActionButton><ActionButton variant="danger" className="px-3" onClick={() => updateStatus("salary", String(salary.id), "rejected")}>Reject</ActionButton></> : null}
                        {String(salary.status) === "approved" && actorRole === "finance" ? <ActionButton variant="approve" className="px-3" onClick={() => updateStatus("salary", String(salary.id), "paid")}>Mark paid</ActionButton> : null}
                        {String(salary.status) === "paid" ? <a href={`/salary-slip/${String(salary.id)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">View Slip</a> : null}
                      </div>
                    </div>
                  ))}
                  {data.salaries.length === 0 ? <p className="py-4 text-sm text-slate-500">No salary records for this month.</p> : null}
                </div>
              </section>
            </>
          ) : null}
        </div>
      ) : null}

      {/* ══════════ Reports ══════════ */}
      {financeSubTab === "reports" ? (
        <div className="space-y-5">
          {reports ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
              <div className="mb-5 border-l-4 border-indigo-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">Reports & Analytics</h3>
                <p className="mt-0.5 text-sm text-slate-500">Yearly financial summary</p>
              </div>
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
            </section>
          ) : null}
          {policyData && (policyData.foodAmount > 0 || policyData.travelAccommodationAmount > 0) ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
              <div className="mb-5 border-l-4 border-amber-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">Company Policies</h3>
                <p className="mt-0.5 text-sm text-slate-500">Fixed deductions configured by finance. Opt in/out separately below.</p>
              </div>
              <div className="mt-3 space-y-2">
                {policyData.foodAmount > 0 ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">Food Allowance (&#x20B9;{policyData.foodAmount})</p>
                      <p className="text-xs text-slate-500">Fixed deduction from salary</p>
                    </div>
                    <div className="flex gap-2">
                      <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${foodOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => toggleOptInOut("food", true)}>Active</button>
                      <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!foodOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => toggleOptInOut("food", false)}>Opt Out</button>
                    </div>
                  </div>
                ) : null}
                {policyData.travelAccommodationAmount > 0 ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">Travel Accommodation (&#x20B9;{policyData.travelAccommodationAmount})</p>
                      <p className="text-xs text-slate-500">Fixed deduction from salary</p>
                    </div>
                    <div className="flex gap-2">
                      <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${travelOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => toggleOptInOut("travel", true)}>Active</button>
                      <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!travelOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => toggleOptInOut("travel", false)}>Opt Out</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
          {leaveImpacts.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
              <div className="mb-5 border-l-4 border-amber-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">Leave Impact on Payroll</h3>
                <p className="mt-0.5 text-sm text-slate-500">Approved leave deductions for {month}</p>
              </div>
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
            </section>
          ) : null}

          {/* Personal Salary Slip */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
            <div className="mb-5 border-l-4 border-emerald-500 pl-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                My Salary Slip
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {month
                  ? `Salary slip for ${new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`
                  : "Select a month to view your salary slip"}
              </p>
            </div>
            <div className="mt-4">
              {slipsLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (() => {
                const slip = mySlips.find(
                  (s) => String(s.month ?? "") === month && String(s.status ?? "") === "paid"
                );
                if (!slip) {
                  return (
                    <p className="text-sm text-slate-500">
                      No salary slip available for this month yet.
                    </p>
                  );
                }
                const slipId = String(slip._id ?? slip.id ?? "");
                return (
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {slip.paidAt
                          ? `Paid on ${new Date(String(slip.paidAt)).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}`
                          : ""}
                      </p>
                    </div>
                    <a
                      href={`/salary-slip/${slipId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      View Slip
                    </a>
                  </div>
                );
              })()}
            </div>
          </section>
        </div>
      ) : null}

      {/* ── Shared Modals ── */}
      {rejectTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h4 className="text-lg font-semibold">Rejection reason</h4>
            <textarea className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2" rows={3} placeholder="Why are you rejecting this request?" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="mt-4 flex justify-end gap-3">
              <ActionButton variant="secondary" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</ActionButton>
              <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={!rejectReason.trim()} onClick={rejectItem}>Reject</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteSalaryId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h4 className="text-lg font-semibold">Delete salary record?</h4>
            <p className="mt-2 text-sm text-slate-600">This will permanently delete the salary record for <strong>{deleteSalaryEmployee}</strong>. This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <ActionButton variant="secondary" onClick={() => { setDeleteSalaryId(null); setDeleteSalaryEmployee(""); }}>Cancel</ActionButton>
              <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white" onClick={deleteSalary}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}

      {showExpiredBudgets ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">Expired Budgets</h4>
              <ActionButton variant="ghost" onClick={() => setShowExpiredBudgets(false)}>Close</ActionButton>
            </div>
            <div className="mt-4 divide-y divide-slate-200">
              {data.budgets.filter((b) => { const d = b.deadline ? new Date(String(b.deadline)) : null; return d && (Date.now() - d.getTime()) > 25 * 24 * 60 * 60 * 1000; }).length === 0 ? <p className="py-4 text-sm text-slate-500">No expired budgets.</p> : null}
              {data.budgets.map((budget) => { const deadline = budget.deadline ? new Date(String(budget.deadline)) : null; const isExpired = deadline && (Date.now() - deadline.getTime()) > 25 * 24 * 60 * 60 * 1000; if (!isExpired) return null; return (<div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(budget.id)}><div><p className="font-medium">{displayNested(budget.board, "title", "Board")}</p><p className="text-sm text-slate-500">Total: &#x20B9;{Number(budget.totalBudget ?? 0).toLocaleString("en-IN")}{budget.deadline ? <> &bull; Deadline: {new Date(String(budget.deadline)).toLocaleDateString()}</> : null}{budget.decidedBy ? <> &bull; Set by: {displayNested(budget.decidedBy, "name", "User")}</> : null}</p></div></div>); })}
            </div>
          </div>
        </div>
      ) : null}

      {showBudgetModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h4 className="text-lg font-semibold">{editingBudgetId ? "Edit Budget" : "Allocate Budget"}</h4>
            <form className="mt-4 grid gap-3" onSubmit={submitBudget}>
              <select className="rounded-lg border border-slate-200 px-3 py-2" required value={budgetForm.boardId} onChange={(e) => setBudgetForm({ ...budgetForm, boardId: e.target.value })}>
                <option value="">Select project</option>
                {data.boards.map((board: AnyRecord) => (<option key={String(board.id)} value={String(board.id)}>{String(board.title)} ({String(board.label ?? "Created by Unknown")})</option>))}
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
                  {data.financeMembers.map((fm: AnyRecord) => (<option key={String(fm.id)} value={String(fm.id)}>{String(fm.name)}</option>))}
                </select>
              ) : null}
              <div className="flex justify-end gap-3">
                <ActionButton variant="secondary" type="button" onClick={() => { setShowBudgetModal(false); setEditingBudgetId(null); }}>Cancel</ActionButton>
                <ActionButton variant="primary">{editingBudgetId ? "Update" : "Allocate"}</ActionButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showInvoiceForm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h4 className="text-lg font-semibold">Create Invoice</h4>
            <form className="mt-4 grid gap-3" onSubmit={createInvoice}>
              <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Client name" value={invoiceForm.clientName} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Client email" type="email" value={invoiceForm.clientEmail} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientEmail: e.target.value })} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Amount" type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
              <textarea className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Description (optional)" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
              <div className="flex justify-end gap-3">
                <ActionButton variant="secondary" type="button" onClick={() => { setShowInvoiceForm(false); setInvoiceForm({ boardId: "", clientName: "", clientEmail: "", amount: "", description: "" }); }}>Cancel</ActionButton>
                <ActionButton variant="primary">Create</ActionButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showSalaryModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h4 className="text-lg font-semibold text-slate-900">Salary Overview</h4>
              <ActionButton variant="ghost" onClick={() => { setShowSalaryModal(false); setExpandedRoles(new Set()); }}>Close</ActionButton>
            </div>
            <div className="flex gap-2 border-b border-slate-200 px-6 py-3">
              <button
                className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                  salaryModalTab === "unpaid"
                    ? "bg-rose-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setSalaryModalTab("unpaid")}
              >
                Unpaid
              </button>
              <button
                className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                  salaryModalTab === "paid"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setSalaryModalTab("paid")}
              >
                Paid
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {(() => {
                const statusFilter = salaryModalTab === "unpaid" ? ["pending", "approved"] : ["paid"];
                const filteredSalaries = data.salaries.filter((s) =>
                  statusFilter.includes(String(s.status ?? ""))
                );

                const salariedEmpIds = new Set<string>();
                for (const s of data.salaries) {
                  const eid = String((s.employee as AnyRecord)?._id ?? (s.employee as AnyRecord)?.id ?? "");
                  if (eid) salariedEmpIds.add(eid);
                }

                const grouped: Record<string, AnyRecord[]> = {};
                for (const salary of filteredSalaries) {
                  const role = getSalaryRole(salary);
                  if (!grouped[role]) grouped[role] = [];
                  grouped[role].push(salary);
                }

                if (salaryModalTab === "unpaid") {
                  for (const member of data.members) {
                    const memberId = String(member.id);
                    if (!salariedEmpIds.has(memberId)) {
                      const role = String(member.role ?? "employee");
                      if (!grouped[role]) grouped[role] = [];
                      grouped[role].push({ __isMember: true, member } as any);
                    }
                  }
                }

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
                  const salaryItems = items.filter((s) => !(s as any).__isMember);
                  const memberItems = items.filter((s) => (s as any).__isMember);
                  const totalAmount = salaryItems.reduce(
                    (sum, s) => sum + Number(s.netSalary ?? 0),
                    0
                  );
                  return (
                    <div className="mb-3 rounded-lg border border-slate-200 overflow-hidden" key={role}>
                      <button
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
                        onClick={() => toggleRole(role)}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs transition-transform ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          >
                            ▶
                          </span>
                          <span className="text-sm font-semibold capitalize text-slate-900">
                            {formatRole(role)}
                          </span>
                          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-700">
                            {items.length}
                          </span>
                        </div>
                        {salaryModalTab === "unpaid" && totalAmount > 0 ? (
                          <span className="text-sm font-medium text-slate-600">
                            ₹{totalAmount.toLocaleString("en-IN")}
                          </span>
                        ) : salaryModalTab === "paid" ? (
                          <span className="text-sm font-medium text-slate-600">
                            ₹{totalAmount.toLocaleString("en-IN")}
                          </span>
                        ) : null}
                      </button>
                      {isOpen ? (
                        <div className="divide-y divide-slate-100">
                          {salaryItems.map((salary) => {
                            const empName = displayNested(
                              salary.employee,
                              "name",
                              "Employee"
                            );
                            const empRole = formatRoleWithCustom(
                              getSalaryRole(salary),
                              (salary.employee as AnyRecord)?.customRole
                            );
                            return (
                              <div
                                className="flex items-center justify-between px-4 py-2.5 text-sm"
                                key={String(salary.id)}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-slate-900">
                                    {empName}
                                  </p>
                                  <p className="text-xs text-slate-400 capitalize">
                                    {empRole}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-semibold text-slate-800">
                                    ₹{Number(salary.netSalary ?? 0).toLocaleString("en-IN")}
                                  </span>
                                  <span
                                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                      String(salary.status) === "paid"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : String(salary.status) === "approved"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {String(salary.status)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {memberItems.map((entry) => {
                            const member = (entry as any).member as AnyRecord;
                            return (
                              <div
                                className="flex items-center justify-between px-4 py-2.5 text-sm"
                                key={String(member.id)}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-slate-900">
                                    {String(member.name ?? "Unknown")}
                                  </p>
                                  <p className="text-xs text-slate-400 capitalize">
                                    {formatRoleWithCustom(
                                      String(member.role ?? "employee"),
                                      member.customRole
                                    )}
                                  </p>
                                </div>
                                <div className="shrink-0">
                                  <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    Not generated
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FinanceCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </section>
  );
}
