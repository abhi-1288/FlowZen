import type { AnyRecord } from "../shared";

export type SalaryBreakdown = {
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
};

export type PolicyData = {
  foodAmount: number;
  travelAccommodationAmount: number;
  foodOptedOutMembers: { _id: string; name: string; email: string; role: string }[];
  travelOptedOutMembers: { _id: string; name: string; email: string; role: string }[];
};

export type PolicyApiResponse = PolicyData & { nowOptedOut: boolean };

export type FinanceDashboard = {
  totalPayroll: number;
  pendingSalaries: number;
  paidSalaries: number;
};

export type ReportsData = {
  revenue: number;
  expenses: number;
  profit: number;
  pendingInvoices: number;
  pendingInvoicesAmount: number;
};

export type LeaveImpact = {
  employeeName: string;
  leaves: number;
  deduction: number;
};

export type InvoiceForm = {
  boardId: string;
  clientName: string;
  clientEmail: string;
  amount: string;
  description: string;
};

export type BudgetForm = {
  boardId: string;
  totalBudget: string;
  teamSpendingLimit: string;
  resourceBudget: string;
  deadline: string;
  assignedTo: string;
};

export type ExpenseForm = {
  category: string;
  title: string;
  amount: string;
  quantity: string;
  reason: string;
  assignedTo: string;
};

export type FinanceData = {
  month: string;
  canManage: boolean;
  monthEndGenerated: boolean;
  dashboard: FinanceDashboard;
  salaries: AnyRecord[];
  expenses: AnyRecord[];
  budgets: AnyRecord[];
  boards: AnyRecord[];
  members: AnyRecord[];
  financeMembers: AnyRecord[];
};

export type RejectTarget = {
  id: string;
  type: "expense" | "budget";
};

export type SalaryModalTab = "unpaid" | "paid";

export type FinanceSubTab = "my" | "ops" | "reports";
