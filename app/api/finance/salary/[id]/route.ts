import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { FinanceSalary } from "@/models/FinanceSalary";
import { User } from "@/models/User";
import { computeSalaryBreakdown, getSalaryPeriod } from "../../helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select(
    "name role company companyStatus",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  const { id } = await params;

  const salary = await FinanceSalary.findOne({
    _id: id,
    company: actor.company,
  }).populate("employee", "name email role customRole companyIdentityCode baseSalary");
  if (!salary) return jsonError("Salary record not found.", 404);

  const month = salary.month;
  const policy = await CompanyPolicy.findOne({ company: actor.company }).select("salaryCycleDay salaryCycleStartDay salaryCycleEndDay");
  const { periodStart, periodEnd } = getSalaryPeriod(month, policy || {});

  const computed = await computeSalaryBreakdown({
    actorCompany: actor.company,
    employeeId: String(salary.employee._id ?? salary.employee),
    periodStart,
    periodEnd,
    allowances: 0,
    manualDeductions: 0,
  });

  const emp = salary.employee as any;
  const detail = {
    id: String(salary._id),
    month: salary.month,
    baseSalary: salary.baseSalary,
    allowances: salary.allowances,
    deductions: salary.deductions,
    netSalary: salary.netSalary,
    status: salary.status,
    approvedBy: salary.approvedBy,
    paidAt: salary.paidAt,
    createdAt: salary.createdAt,
    updatedAt: salary.updatedAt,
    employee: {
      _id: String(emp._id ?? emp),
      name: String(emp.name ?? ""),
      email: String(emp.email ?? ""),
      role: String(emp.role ?? ""),
      customRole: String(emp.customRole ?? ""),
      companyIdentityCode: String(emp.companyIdentityCode ?? ""),
      baseSalary: Number(emp.baseSalary ?? 0),
    },
    breakdown: "error" in computed ? null : computed.breakdown,
  };

  return NextResponse.json(detail);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select(
    "name role company companyStatus",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);
  if (String(actor.role) !== "finance")
    return jsonError("Only finance can delete salary records.", 403);

  const { id } = await params;

  const salary = await FinanceSalary.findOne({
    _id: id,
    company: actor.company,
  }).select("status");
  if (!salary) return jsonError("Salary record not found.", 404);
  if (salary.status !== "pending")
    return jsonError("Only pending salary records can be deleted.", 400);

  await FinanceSalary.deleteOne({ _id: id, company: actor.company });

  return NextResponse.json({ ok: true });
}
