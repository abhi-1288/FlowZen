import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { FinanceSalary } from "@/models/FinanceSalary";
import { User } from "@/models/User";
import { assertSalaryTargetInFinanceScope, canAccessFinanceRecord, canManageFinance, computeSalaryBreakdown, getSalaryPeriod } from "../../helpers";
import { isCompanyOwner } from "@/lib/admin-region-scope";
import { resolveRegionPolicy } from "@/lib/region-scope";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select(
    "name role company companyStatus regionLabel",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  const { id } = await params;

  const salary = await FinanceSalary.findOne({
    _id: id,
    company: actor.company,
  }).populate("employee", "name email role customRole companyIdentityCode baseSalary regionLabel");
  if (!salary) return jsonError("Salary record not found.", 404);

  const employeeId = String(salary.employee._id ?? salary.employee);

  // Own record, or a finance/admin acting inside their own region.
  if (!(await canAccessFinanceRecord(actor, employeeId))) {
    return jsonError("This salary record is outside your region.", 403);
  }

  // canAccessFinanceRecord returns true for any non-manager role, so a regular
  // employee could otherwise read any salary by id. Non-own reads are limited
  // to finance/admin and the company owner.
  if (employeeId !== String(actor._id)) {
    const company = (await Company.findById(actor.company).select("owner").lean()) as {
      owner?: unknown;
    } | null;
    if (!isCompanyOwner(company, actor) && !canManageFinance(String(actor.role ?? ""))) {
      return jsonError("You can only view your own salary record.", 403);
    }
  }

  const month = salary.month;
  // The employee's own region policy, not the actor's.
  const employeeRegionLabel = String(salary.employee?.regionLabel ?? "");
  const policy = await resolveRegionPolicy(salary.company, employeeRegionLabel);

  let periodStart: string;
  let periodEnd: string;
  if (salary.kind === "settlement" && salary.periodStart && salary.periodEnd) {
    periodStart = salary.periodStart;
    periodEnd = salary.periodEnd;
  } else {
    const period = getSalaryPeriod(month, policy || {});
    periodStart = period.periodStart;
    periodEnd = period.periodEnd;
  }

  const computed = await computeSalaryBreakdown({
    actorCompany: actor.company,
    employeeId,
    periodStart,
    periodEnd,
    allowances: Number(salary.allowances ?? 0),
    manualDeductions: Number(salary.manualDeductions ?? 0),
  });

  const emp = salary.employee as any;
  const detail = {
    id: String(salary._id),
    month: salary.month,
    kind: salary.kind ?? "monthly",
    periodStart,
    periodEnd,
    settlementReason: salary.settlementReason ?? "",
    baseSalary: salary.baseSalary,
    allowances: salary.allowances,
    manualDeductions: salary.manualDeductions,
    deductions: salary.deductions,
    netSalary: salary.netSalary,
    status: salary.status,
    approvedBy: salary.approvedBy,
    paidAt: salary.paidAt,
    note: salary.note,
    rejectionReason: salary.rejectionReason,
    rejectedBy: salary.rejectedBy,
    rejectedAt: salary.rejectedAt,
    resentAt: salary.resentAt,
    resentCount: salary.resentCount,
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
    "name role company companyStatus regionLabel",
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
  }).select("status employee");
  if (!salary) return jsonError("Salary record not found.", 404);
  const outOfRegion = await assertSalaryTargetInFinanceScope(actor, String(salary.employee));
  if (outOfRegion) return jsonError(outOfRegion, 403);
  if (salary.status !== "pending")
    return jsonError("Only pending salary records can be deleted.", 400);

  await FinanceSalary.deleteOne({ _id: id, company: actor.company });

  return NextResponse.json({ ok: true });
}
