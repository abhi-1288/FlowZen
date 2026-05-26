import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LeaveRequest } from "@/models/LeaveRequest";
import { FinanceSalary } from "@/models/FinanceSalary";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const url = new URL(request.url);
  const month = String(url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7));

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 1);

  const approvedLeaves = await LeaveRequest.find({
    company: actor.company,
    status: "approved",
    startDate: { $lt: monthEnd },
    endDate: { $gte: monthStart },
  }).populate("requester", "name email");

  const employees = await User.find({ company: actor.company, companyStatus: "approved" }).select("_id name email");
  const empMap = new Map(employees.map((e: any) => [String(e._id), e]));

  const impacts: { employeeId: string; employeeName: string; leaves: number; deduction: number }[] = [];

  for (const leave of approvedLeaves) {
    const empId = String((leave as any).requester?._id ?? leave.requester ?? "");
    const emp = empMap.get(empId) || (leave as any).requester;
    if (!emp) continue;

    let salary = await FinanceSalary.findOne({
      company: actor.company,
      employee: empId,
      month,
    }).select("netSalary");

    if (!salary) {
      salary = await FinanceSalary.findOne({ company: actor.company, employee: empId })
        .sort({ month: -1 })
        .select("netSalary");
    }

    const dailyRate = salary ? (salary.netSalary ?? 0) / 30 : 0;
    const deduction = Math.round(leave.duration * dailyRate);

    const existing = impacts.find((i) => i.employeeId === empId);
    if (existing) {
      existing.leaves += leave.duration;
      existing.deduction += deduction;
    } else {
      impacts.push({
        employeeId: empId,
        employeeName: String((emp as any).name ?? "Unknown"),
        leaves: leave.duration,
        deduction,
      });
    }
  }

  impacts.sort((a, b) => b.deduction - a.deduction);

  return NextResponse.json({ month, impacts });
}
