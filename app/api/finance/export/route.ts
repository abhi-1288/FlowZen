import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { FinanceSalary } from "@/models/FinanceSalary";
import { User } from "@/models/User";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function safeFilenamePart(value: unknown) {
  const text = String(value ?? "company").trim();
  return (
    text
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "company"
  );
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const statusFilter = url.searchParams.get("status") ?? "";

  if (!/^\d{4}-\d{2}$/.test(month))
    return jsonError("Invalid month format. Use YYYY-MM.", 400);

  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  if (!["admin", "finance", "human-resource"].includes(String(actor.role ?? "")))
    return jsonError("Only admin, finance, or HR can export salary data.", 403);

  const query: Record<string, any> = { company: actor.company, month };
  if (statusFilter) query.status = statusFilter;

  const salaries = await FinanceSalary.find(query)
    .populate("employee", "name email role customRole companyIdentityCode baseSalary")
    .populate("approvedBy", "name")
    .populate("rejectedBy", "name")
    .populate("createdBy", "name")
    .sort({ "employee.name": 1 });

  const headers = [
    "Employee Code",
    "Employee Name",
    "Email",
    "Role",
    "Month",
    "Base Salary",
    "Allowances",
    "Deductions",
    "Net Salary",
    "Status",
    "Approved By",
    "Approved At",
    "Rejected By",
    "Rejection Reason",
    "Paid At",
    "Created By",
    "Created At",
  ];

  const lines = [headers.map(csvCell).join(",")];

  for (const salary of salaries) {
    const emp = salary.employee as any;
    const approvedByUser = salary.approvedBy as any;
    const rejectedByUser = salary.rejectedBy as any;
    const createdByUser = salary.createdBy as any;

    lines.push(
      [
        String(emp?.companyIdentityCode ?? ""),
        String(emp?.name ?? ""),
        String(emp?.email ?? ""),
        String(emp?.role ?? ""),
        salary.month,
        salary.baseSalary,
        salary.allowances,
        salary.deductions,
        salary.netSalary,
        salary.status,
        String(approvedByUser?.name ?? ""),
        salary.approvedAt ? new Date(salary.approvedAt).toLocaleDateString() : "",
        String(rejectedByUser?.name ?? ""),
        salary.rejectionReason ?? "",
        salary.paidAt ? new Date(salary.paidAt).toLocaleDateString() : "",
        String(createdByUser?.name ?? ""),
        salary.createdAt ? new Date(salary.createdAt).toLocaleDateString() : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const filename = `salary-register-${month}${statusFilter ? `-${statusFilter}` : ""}.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
