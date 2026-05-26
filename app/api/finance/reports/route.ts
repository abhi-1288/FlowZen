import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { ProjectBudget } from "@/models/ProjectBudget";
import { ExpenseBill } from "@/models/ExpenseBill";
import { FinanceSalary } from "@/models/FinanceSalary";
import { ClientInvoice } from "@/models/ClientInvoice";
import { ExpenseRequest } from "@/models/ExpenseRequest";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [
    totalApprovedBudgets,
    totalBillsPaid,
    totalPayrollCost,
    pendingInvoicesAmount,
    totalInvoicesPaid,
    totalExpenses,
  ] = await Promise.all([
    ProjectBudget.aggregate([
      { $match: { company: actor.company, status: "approved", createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$totalBudget" } } },
    ]),
    ExpenseBill.aggregate([
      { $match: { company: actor.company, status: "paid", paidAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    FinanceSalary.aggregate([
      { $match: { company: actor.company, status: "paid", paidAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$netSalary" } } },
    ]),
    ClientInvoice.aggregate([
      { $match: { company: actor.company, status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    ClientInvoice.aggregate([
      { $match: { company: actor.company, status: "paid", paidAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ExpenseRequest.aggregate([
      { $match: { company: actor.company, status: "disbursed", disbursedAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const revenue = (totalInvoicesPaid[0]?.total ?? 0) + (totalApprovedBudgets[0]?.total ?? 0);
  const expenses = (totalBillsPaid[0]?.total ?? 0) + (totalPayrollCost[0]?.total ?? 0) + (totalExpenses[0]?.total ?? 0);
  const profit = revenue - expenses;
  const pendingInvoicesCount = pendingInvoicesAmount[0]?.count ?? 0;
  const pendingInvoicesTotal = pendingInvoicesAmount[0]?.total ?? 0;

  return NextResponse.json({
    year,
    revenue,
    expenses,
    profit,
    pendingInvoices: pendingInvoicesCount,
    pendingInvoicesAmount: pendingInvoicesTotal,
    payrollCost: totalPayrollCost[0]?.total ?? 0,
    totalApprovedBudgets: totalApprovedBudgets[0]?.total ?? 0,
  });
}
