"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord } from "../shared";
import type { SalaryBreakdown, BudgetForm, ExpenseForm, InvoiceForm, RejectTarget, SalaryModalTab, PolicyData } from "./types";
import { useFinanceData, useInvoices, useReports, useLeaveImpacts, usePolicyData, useMySalarySlips, useSalaryCycle } from "./hooks";
import { toggleRoleInSet } from "./helpers";
import { DashboardCards } from "./sections/dashboard-cards";
import { SalaryReminder } from "./sections/salary-reminder";
import { FinanceSubTabs } from "./sections/sub-tabs";
import { ExpenseFormSection } from "./sections/expense-form-section";
import { ExpenseListSection } from "./sections/expense-list-section";
import { SalaryWizardSection } from "./sections/salary-wizard-section";
import { ExpenseAllocatorSection } from "./sections/expense-allocator-section";
import { InvoicesSection } from "./sections/invoices-section";
import { BudgetAllocateSection } from "./sections/budget-allocate-section";
import { BudgetListSection } from "./sections/budget-list-section";
import { AdvanceRequestSection } from "./sections/advance-request-section";
import { SalaryRecordsSection } from "./sections/salary-records-section";
import { ReportsSection } from "./sections/reports-section";
import { PoliciesSection } from "./sections/policies-section";
import { LeaveImpactSection } from "./sections/leave-impact-section";
import { SalarySlipSection } from "./sections/salary-slip-section";
import { SalaryCycleSection } from "./sections/salary-cycle-section";
import { RejectModal } from "./modals/reject-modal";
import { DeleteSalaryModal } from "./modals/delete-salary-modal";
import { ExpiredBudgetsModal } from "./modals/expired-budgets-modal";
import { BudgetModal } from "./modals/budget-modal";
import { InvoiceModal } from "./modals/invoice-modal";
import { SalaryOverviewModal } from "./modals/salary-overview-modal";
import { SalaryDetailModal } from "./modals/salary-detail-modal";

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
  const { data, load } = useFinanceData(month, showToast);
  const [salaryStep, setSalaryStep] = useState<1 | 2 | 3>(1);
  const [salaryPeriod, setSalaryPeriod] = useState({ start: "", end: "" });
  const [salaryEmployeeId, setSalaryEmployeeId] = useState("");
  const [salaryAllowances, setSalaryAllowances] = useState("");
  const [salaryDeductions, setSalaryDeductions] = useState("");
  const [salaryBreakdown, setSalaryBreakdown] = useState<SalaryBreakdown | null>(null);
  const [memberPfNumber, setMemberPfNumber] = useState("");
  const [memberEsicNumber, setMemberEsicNumber] = useState("");
  const [memberPfExempted, setMemberPfExempted] = useState(false);
  const [memberEsicExempted, setMemberEsicExempted] = useState(false);
  const [memberTdsExempted, setMemberTdsExempted] = useState(false);
  const [salaryGenerating, setSalaryGenerating] = useState(false);
  const [budgetForm, setBudgetForm] = useState<BudgetForm>({ boardId: "", totalBudget: "", teamSpendingLimit: "", resourceBudget: "", deadline: "", assignedTo: "" });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [showExpiredBudgets, setShowExpiredBudgets] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({ category: "software", title: "", amount: "", quantity: "1", reason: "", assignedTo: "" });
  const [forwardAdminByExpense, setForwardAdminByExpense] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteSalaryId, setDeleteSalaryId] = useState<string | null>(null);
  const [deleteSalaryEmployee, setDeleteSalaryEmployee] = useState("");
  const [salaryDetailId, setSalaryDetailId] = useState<string | null>(null);
  const [salaryDetailEmployee, setSalaryDetailEmployee] = useState("");
  const { invoices, setInvoices } = useInvoices(data);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>({ boardId: "", clientName: "", clientEmail: "", amount: "", description: "" });
  const reports = useReports(data);
  const leaveImpacts = useLeaveImpacts(data, month);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryModalTab, setSalaryModalTab] = useState<SalaryModalTab>("unpaid");
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const { mySlips, slipsLoading } = useMySalarySlips(month);
  const { policyData, setPolicyData } = usePolicyData(data);
  const { salaryCycle, setSalaryCycle, refreshSalaryCycle } = useSalaryCycle(data);
  const [financeSubTab, setFinanceSubTab] = useState<"my" | "ops" | "reports">("my");
  const [foodOptedIn, setFoodOptedIn] = useState(true);
  const [travelOptedIn, setTravelOptedIn] = useState(true);
  const [pfPctInput, setPfPctInput] = useState("");
  const [esicPctInput, setEsicPctInput] = useState("");
  const [tdsPctInput, setTdsPctInput] = useState("");

  useEffect(() => {
    if (!policyData) return;
    if (profileId) {
      setFoodOptedIn(!policyData.foodOptedOutMembers.some((m) => String(m._id) === String(profileId)));
      setTravelOptedIn(!policyData.travelOptedOutMembers.some((m) => String(m._id) === String(profileId)));
    }
    setPfPctInput(String(policyData.pfPercentage));
    setEsicPctInput(String(policyData.esicPercentage));
    setTdsPctInput(String(policyData.tdsPercentage));
  }, [policyData, profileId]);

  async function toggleOptInOut(type: "food" | "travel", optedIn: boolean) {
    try {
      await apiFetch("/api/finance/policy", { method: "PATCH", body: JSON.stringify({ type, optedIn }) });
      if (type === "food") setFoodOptedIn(optedIn);
      else setTravelOptedIn(optedIn);
      showToast(`Successfully ${optedIn ? "opted in" : "opted out"} of ${type} policy.`, "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to update policy.", "error");
    }
  }

  async function toggleAdvanceSalary(enabled: boolean) {
    try {
      const res = await apiFetch<{ advanceSalaryEnabled: boolean }>("/api/finance/policy", {
        method: "POST",
        body: JSON.stringify({ advanceSalaryEnabled: enabled }),
      });
      setPolicyData((prev) => prev ? { ...prev, advanceSalaryEnabled: res.advanceSalaryEnabled } : prev);
      showToast(`Advance salary ${enabled ? "enabled" : "disabled"}.`, "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to update policy.", "error");
    }
  }

  async function savePercentages() {
    try {
      const res = await apiFetch<PolicyData>("/api/finance/policy", {
        method: "POST",
        body: JSON.stringify({
          pfPercentage: Number(pfPctInput),
          esicPercentage: Number(esicPctInput),
          tdsPercentage: Number(tdsPctInput),
        }),
      });
      setPolicyData((prev) => prev ? { ...prev, pfPercentage: res.pfPercentage, esicPercentage: res.esicPercentage, tdsPercentage: res.tdsPercentage } : prev);
      showToast("Deduction percentages saved.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save percentages.", "error");
    }
  }

  async function calculateSalary(event: FormEvent) {
    event.preventDefault();
    try {
      const res = await apiFetch<{ breakdown: SalaryBreakdown; employee: AnyRecord }>("/api/finance", {
        method: "POST",
        body: JSON.stringify({ action: "calculate-salary", employeeId: salaryEmployeeId, periodStart: salaryPeriod.start, periodEnd: salaryPeriod.end }),
      });
      setSalaryBreakdown(res.breakdown);
      setMemberPfNumber(String(res.employee?.pfNumber ?? ""));
      setMemberEsicNumber(String(res.employee?.esicNumber ?? ""));
      setMemberPfExempted(Boolean(res.employee?.pfExempted));
      setMemberEsicExempted(Boolean(res.employee?.esicExempted));
      setMemberTdsExempted(Boolean(res.employee?.tdsExempted));
      setSalaryAllowances("");
      setSalaryDeductions("");
      setSalaryStep(3);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to calculate salary.", "error");
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
          action: "generate-salary", employeeId: salaryEmployeeId, periodStart: salaryPeriod.start, periodEnd: salaryPeriod.end,
          allowances: salaryAllowances, deductions: salaryDeductions, pfNumber: memberPfNumber,
          esicNumber: memberEsicNumber,
          pfExempted: memberPfExempted, esicExempted: memberEsicExempted, tdsExempted: memberTdsExempted,
        }),
      });
      showToast("Salary record generated and sent for approval.", "success");
      setSalaryStep(1);
      setSalaryPeriod({ start: "", end: "" });
      setSalaryEmployeeId("");
      setSalaryBreakdown(null);
      await load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to generate salary.", "error");
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
    await apiFetch("/api/finance", { method: "POST", body: JSON.stringify({ action: "set-budget", ...budgetForm }) });
    setShowBudgetModal(false);
    setEditingBudgetId(null);
    setBudgetForm({ boardId: "", totalBudget: "", teamSpendingLimit: "", resourceBudget: "", deadline: "", assignedTo: "" });
    showToast("Budget saved and sent for approval.", "success");
    await load();
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance", { method: "POST", body: JSON.stringify({ action: "request-expense", ...expenseForm }) });
    setExpenseForm({ category: "software", title: "", amount: "", quantity: "1", reason: "", assignedTo: "" });
    showToast("Expense request submitted.", "success");
    await load();
  }

  async function updateStatus(type: "salary" | "expense" | "budget" | "bill", id: string, status: string, extra: Record<string, string> = {}) {
    await apiFetch("/api/finance", { method: "PATCH", body: JSON.stringify({ type, id, status, ...extra }) });
    showToast(`${type === "salary" ? "Salary" : type === "budget" ? "Budget" : type === "bill" ? "Bill" : "Expense"} ${status}.`, "success");
    await load();
  }

  async function bulkStatusUpdate(ids: string[], status: "approved" | "rejected") {
    try {
      const res = await apiFetch<{ modified: number }>("/api/finance", {
        method: "PATCH",
        body: JSON.stringify({ type: "salary-bulk", ids, status }),
      });
      showToast(`${res.modified} salary record(s) ${status}.`, "success");
      await load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Bulk operation failed.", "error");
    }
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
    await apiFetch("/api/finance", {
      method: "PATCH",
      body: JSON.stringify({ type: rejectTarget.type, id: rejectTarget.id, status: "rejected", rejectionReason: rejectReason.trim() }),
    });
    setRejectTarget(null);
    setRejectReason("");
    showToast("Rejected.", "success");
    await load();
  }

  async function createInvoice(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/finance/invoice", { method: "POST", body: JSON.stringify(invoiceForm) });
    setShowInvoiceForm(false);
    setInvoiceForm({ boardId: "", clientName: "", clientEmail: "", amount: "", description: "" });
    showToast("Invoice created.", "success");
    const res = await apiFetch<{ invoices: AnyRecord[] }>("/api/finance/invoice");
    setInvoices(res.invoices);
  }

  async function markInvoice(id: string, status: string) {
    await apiFetch("/api/finance/invoice", { method: "PATCH", body: JSON.stringify({ id, status }) });
    showToast(`Invoice ${status === "paid" ? "marked paid" : "marked pending"}.`, "success");
    const res = await apiFetch<{ invoices: AnyRecord[] }>("/api/finance/invoice");
    setInvoices(res.invoices);
  }

  const memberRoleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of data?.members ?? []) {
      map.set(String(m.id), String(m.role));
    }
    return map;
  }, [data?.members]);

  if (!data) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">Loading finance...</section>;
  }

  const isFinanceOrAdmin = actorRole === "finance" || actorRole === "admin";
  const hasFinanceMember = (data.financeMembers ?? []).length > 0;
  const adminOptions = data.members.filter((m) => String(m.role) === "admin");
  const approvers = [
    ...(data.financeMembers ?? []),
    ...(data.members ?? []),
  ].filter((m, i, arr) => {
    const role = String(m.role);
    return (role === "admin" || role === "human-resource" || role === "finance") &&
      arr.findIndex((x) => String(x.id) === String(m.id)) === i;
  }).map((m) => ({ id: String(m.id), name: String(m.name ?? m.email ?? "Unknown") }));

  if (!isFinanceOrAdmin) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="border-l-4 border-amber-500 pl-4">
            <h3 className="text-base font-semibold text-slate-900">Finance</h3>
            <p className="mt-0.5 text-sm text-slate-500">Monthly payroll, salary slips, and expense requests.</p>
          </div>
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-slate-800">Monthly Payroll</h4>
          <SalarySlipSection mySlips={mySlips} slipsLoading={slipsLoading} month={month} />
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-slate-800">Request Expense</h4>
          <div className="space-y-4">
            <ExpenseFormSection expenseForm={expenseForm} actorRole={actorRole} financeMembers={data.financeMembers} onSubmit={submitExpense} onFormChange={setExpenseForm} />
            <ExpenseListSection expenses={data.expenses} actorRole={actorRole} profileId={profileId} adminOptions={adminOptions} forwardAdminByExpense={forwardAdminByExpense} onForwardAdmin={(id, adminId) => setForwardAdminByExpense({ ...forwardAdminByExpense, [id]: adminId })} onReject={(id, type) => setRejectTarget({ id, type })} onStatusUpdate={updateStatus} />
          </div>
        </div>

        {policyData?.advanceSalaryEnabled ? (
        <div>
          <AdvanceRequestSection approvers={approvers} showToast={showToast} />
        </div>
        ) : null}

        <div>
          <h4 className="mb-3 text-sm font-semibold text-slate-800">Reports</h4>
          <div className="space-y-5">
            <ReportsSection reports={reports} />
<PoliciesSection policyData={policyData} foodOptedIn={foodOptedIn} travelOptedIn={travelOptedIn} actorRole={actorRole} salaryCycle={salaryCycle} hasFinanceMember={hasFinanceMember} onToggleOptInOut={toggleOptInOut} onToggleAdvanceSalary={toggleAdvanceSalary} pfPctInput={pfPctInput} esicPctInput={esicPctInput} tdsPctInput={tdsPctInput} onPfPctChange={setPfPctInput} onEsicPctChange={setEsicPctInput} onTdsPctChange={setTdsPctInput} onSavePercentages={savePercentages} />
            <LeaveImpactSection leaveImpacts={leaveImpacts} month={month} />
          </div>
        </div>

        <RejectModal rejectTarget={rejectTarget} rejectReason={rejectReason} onReasonChange={setRejectReason} onCancel={() => { setRejectTarget(null); setRejectReason(""); }} onConfirm={rejectItem} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-4 border-amber-500 pl-4">
          <h3 className="text-base font-semibold text-slate-900">Finance</h3>
          <p className="mt-0.5 text-sm text-slate-500">Payroll, payout status, budgets, and expense requests.</p>
        </div>
        <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>

      {isFinanceOrAdmin ? <SalaryReminder actorRole={actorRole} onView={() => setShowSalaryModal(true)} /> : null}

      <FinanceSubTabs activeTab={financeSubTab} data={data} invoices={invoices} onTabChange={setFinanceSubTab} />

      {data.monthEndGenerated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">Salaries auto-generated for {data.month}</p>
          <p className="mt-1 text-xs text-emerald-600">
            {data.dashboard.pendingSalaries} salary record(s) are pending admin approval. The least-loaded admin has been notified.
          </p>
        </div>
      ) : null}

      <DashboardCards dashboard={data.dashboard} />

      {financeSubTab === "my" ? (
        <div className="space-y-5">
          {policyData?.advanceSalaryEnabled ? (
            <AdvanceRequestSection approvers={approvers} showToast={showToast} />
          ) : null}
          <ExpenseFormSection expenseForm={expenseForm} actorRole={actorRole} financeMembers={data.financeMembers} onSubmit={submitExpense} onFormChange={setExpenseForm} />
          <ExpenseListSection expenses={data.expenses} actorRole={actorRole} profileId={profileId} adminOptions={adminOptions} forwardAdminByExpense={forwardAdminByExpense} onForwardAdmin={(id, adminId) => setForwardAdminByExpense({ ...forwardAdminByExpense, [id]: adminId })} onReject={(id, type) => setRejectTarget({ id, type })} onStatusUpdate={updateStatus} />
        </div>
      ) : null}

      {financeSubTab === "ops" && data.canManage ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <SalaryWizardSection actorRole={actorRole} salaryStep={salaryStep} salaryPeriod={salaryPeriod} salaryEmployeeId={salaryEmployeeId} salaryAllowances={salaryAllowances} salaryDeductions={salaryDeductions} salaryBreakdown={salaryBreakdown} memberPfNumber={memberPfNumber} memberEsicNumber={memberEsicNumber} memberPfExempted={memberPfExempted} memberEsicExempted={memberEsicExempted} memberTdsExempted={memberTdsExempted} salaryGenerating={salaryGenerating} members={data.members} pfPercentage={policyData?.pfPercentage ?? 0} esicPercentage={policyData?.esicPercentage ?? 0} tdsPercentage={policyData?.tdsPercentage ?? 0} onStepChange={setSalaryStep} onPeriodChange={setSalaryPeriod} onEmployeeChange={setSalaryEmployeeId} onAllowancesChange={setSalaryAllowances} onDeductionsChange={setSalaryDeductions} onPfNumberChange={setMemberPfNumber} onEsicNumberChange={setMemberEsicNumber} onCalculate={calculateSalary} onSubmit={submitSalary} />
            <ExpenseAllocatorSection expenses={data.expenses} onStatusUpdate={updateStatus} />
          </div>
          <InvoicesSection invoices={invoices} isFinanceOrAdmin={isFinanceOrAdmin} onCreateInvoice={() => setShowInvoiceForm(true)} onMarkInvoice={markInvoice} />
          <BudgetAllocateSection onAllocate={() => openBudgetModal()} />
          <BudgetListSection budgets={data.budgets} actorRole={actorRole} profileId={profileId} onEdit={openBudgetModal} onApprove={(id) => updateStatus("budget", id, "approved")} onReject={(id, type) => setRejectTarget({ id, type })} onViewExpired={() => setShowExpiredBudgets(true)} />
          <SalaryRecordsSection salaries={data.salaries} actorRole={actorRole} month={month} onDelete={(id, name) => { setDeleteSalaryId(id); setDeleteSalaryEmployee(name); }} onStatusUpdate={updateStatus} onReject={(id, type) => setRejectTarget({ id, type })} onBulkStatusUpdate={bulkStatusUpdate} onViewDetail={(id, name) => { setSalaryDetailId(id); setSalaryDetailEmployee(name); }} />
          <SalaryCycleSection salaryCycle={salaryCycle} actorRole={actorRole} profileId={profileId} adminOptions={adminOptions} onRefresh={refreshSalaryCycle} />
        </div>
      ) : null}

      {financeSubTab === "reports" ? (
        <div className="space-y-5">
          <ReportsSection reports={reports} />
          <PoliciesSection policyData={policyData} foodOptedIn={foodOptedIn} travelOptedIn={travelOptedIn} actorRole={actorRole} salaryCycle={salaryCycle} hasFinanceMember={hasFinanceMember} onToggleOptInOut={toggleOptInOut} onToggleAdvanceSalary={toggleAdvanceSalary} pfPctInput={pfPctInput} esicPctInput={esicPctInput} tdsPctInput={tdsPctInput} onPfPctChange={setPfPctInput} onEsicPctChange={setEsicPctInput} onTdsPctChange={setTdsPctInput} onSavePercentages={savePercentages} />
          <LeaveImpactSection leaveImpacts={leaveImpacts} month={month} />
          <SalarySlipSection mySlips={mySlips} slipsLoading={slipsLoading} month={month} />
        </div>
      ) : null}

      <RejectModal rejectTarget={rejectTarget} rejectReason={rejectReason} onReasonChange={setRejectReason} onCancel={() => { setRejectTarget(null); setRejectReason(""); }} onConfirm={rejectItem} />
      <DeleteSalaryModal deleteSalaryId={deleteSalaryId} deleteSalaryEmployee={deleteSalaryEmployee} onCancel={() => { setDeleteSalaryId(null); setDeleteSalaryEmployee(""); }} onConfirm={deleteSalary} />
      <ExpiredBudgetsModal show={showExpiredBudgets} budgets={data.budgets} onClose={() => setShowExpiredBudgets(false)} />
      <BudgetModal show={showBudgetModal} editingBudgetId={editingBudgetId} budgetForm={budgetForm} boards={data.boards} financeMembers={data.financeMembers} actorRole={actorRole} onFormChange={setBudgetForm} onSubmit={submitBudget} onCancel={() => { setShowBudgetModal(false); setEditingBudgetId(null); }} />
      <InvoiceModal show={showInvoiceForm} invoiceForm={invoiceForm} onFormChange={setInvoiceForm} onSubmit={createInvoice} onCancel={() => { setShowInvoiceForm(false); setInvoiceForm({ boardId: "", clientName: "", clientEmail: "", amount: "", description: "" }); }} />
      <SalaryOverviewModal show={showSalaryModal} salaryModalTab={salaryModalTab} expandedRoles={expandedRoles} salaries={data.salaries} members={data.members} memberRoleMap={memberRoleMap} onTabChange={setSalaryModalTab} onToggleRole={(role) => setExpandedRoles(toggleRoleInSet(expandedRoles, role))} onClose={() => { setShowSalaryModal(false); setExpandedRoles(new Set()); }} />
      <SalaryDetailModal salaryId={salaryDetailId} onClose={() => { setSalaryDetailId(null); setSalaryDetailEmployee(""); }} />
    </div>
  );
}
