"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client-utils";

type SlipData = {
  slip: {
    id: string;
    month: string;
    status: string;
    paidAt: string | null;
    baseSalary: number;
    allowances: number;
    deductions: number;
    netSalary: number;
  };
  employee: {
    name: string;
    email: string;
    role: string;
    identityCode: string;
    pfNumber?: string;
    esicNumber?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
  };
  company: {
    name: string;
    icon: string;
  };
  breakdown: {
    monthlySalary: number;
    totalDays: number;
    absentDays: number;
    halfDayCount: number;
    payableDays: number;
    dailySalary: number;
    leaveDeduction: number;
    grossSalary: number;
    foodDeduction: number;
    travelDeduction: number;
    pfDeduction: number;
    esicDeduction: number;
    tdsDeduction: number;
    pfPct: number;
    esicPct: number;
    tdsPct: number;
    pfExempted: boolean;
    esicExempted: boolean;
    tdsExempted: boolean;
    finalSalary: number;
    periodStart: string;
    periodEnd: string;
    periodAdjusted: boolean;
    basicSalaryComponent?: number;
    houseRentAmount?: number;
    conveyanceAmount?: number;
    medicalAmount?: number;
    specialAllowanceAmount?: number;
    payBasis?: string;
    workedHours?: number;
    hourlyRate?: number;
    dailyRate?: number;
  };
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function monthLabel(month: string) {
  const y = month.slice(0, 4);
  const m = Number(month.slice(5, 7));
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[m - 1]} ${y}`;
}

function maskAccountNumber(value?: string) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (s.length < 4) return "XXXX";
  return `XXXX${s.slice(-4)}`;
}

export default function SalarySlipPage() {
  const params = useParams();
  const id = params ? String(params.id ?? "") : "";
  const [data, setData] = useState<SlipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch<SlipData>(`/api/finance/salary-slip/${id}`)
      .then((res) => { setData(res); setLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Failed to load"); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Loading salary slip...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-red-600">{error || "Salary slip not found."}</p>
      </div>
    );
  }

  const { slip, employee, company, breakdown } = data;
  function dedLabel(name: string, pct: number, exempted: boolean) {
    if (exempted) return `${name} (Exempt)`;
    return `${name} (${pct}%)`;
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-[210mm] bg-white shadow-lg print:shadow-none">
        <div className="p-8 print:p-6">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <div className="flex items-center justify-center gap-3">
              {company.icon ? (
                <img src={company.icon} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : null}
              <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">Salary Slip</p>
          </div>

          {/* Month & Status */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="font-semibold text-slate-900">{monthLabel(slip.month)}</p>
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-medium uppercase text-emerald-700">
              {slip.status}
            </span>
          </div>

          {/* Period */}
          <div className="mt-2 text-xs text-slate-500">
            Period: {breakdown.periodStart} to {breakdown.periodEnd}
            {breakdown.periodAdjusted ? (
              <span className="ml-2 text-amber-600">⚠ Period adjusted — employee joined on {breakdown.periodStart}</span>
            ) : null}
          </div>

          {/* Employee Details */}
          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase text-slate-500">Employee Details</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-900">{employee.name}</span></p>
              <p><span className="text-slate-500">Email:</span> <span className="text-slate-900">{employee.email}</span></p>
              <p><span className="text-slate-500">Role:</span> <span className="text-slate-900 capitalize">{employee.role.replace("-", " ")}</span></p>
              <p><span className="text-slate-500">ID:</span> <span className="text-slate-900">{employee.identityCode || "—"}</span></p>
              {employee.pfNumber ? (
                <p><span className="text-slate-500">PF:</span> <span className="text-slate-900">{employee.pfNumber}</span></p>
              ) : null}
              {employee.esicNumber ? (
                <p><span className="text-slate-500">ESIC:</span> <span className="text-slate-900">{employee.esicNumber}</span></p>
              ) : null}
              {maskAccountNumber(employee.bankAccountNumber) ? (
                <p><span className="text-slate-500">Bank A/c:</span> <span className="text-slate-900">{maskAccountNumber(employee.bankAccountNumber)}</span></p>
              ) : null}
              {employee.ifscCode ? (
                <p><span className="text-slate-500">IFSC:</span> <span className="text-slate-900">{employee.ifscCode}</span></p>
              ) : null}
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="mt-3 rounded-lg border border-slate-200 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase text-slate-500">Attendance Summary</h2>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-slate-500">Total Days</p>
                <p className="font-semibold text-slate-900">{breakdown.totalDays}</p>
              </div>
              <div>
                <p className="text-slate-500">Payable Days</p>
                <p className="font-semibold text-slate-900">{breakdown.payableDays}</p>
              </div>
              <div>
                <p className="text-slate-500">Absent</p>
                <p className="font-semibold text-slate-900">{breakdown.absentDays}</p>
              </div>
              <div>
                <p className="text-slate-500">Half Days</p>
                <p className="font-semibold text-slate-900">{breakdown.halfDayCount}</p>
              </div>
            </div>
          </div>

          {/* Earnings & Deductions */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase text-emerald-600">Earnings</h2>
              <div className="space-y-1.5 text-sm">
                {breakdown.payBasis === "per-hour" ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hours Worked</span>
                      <span className="font-medium text-slate-900">{breakdown.workedHours ?? 0} hrs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hourly Rate</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.hourlyRate ?? 0)}/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Pay (hr × rate)</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.grossSalary)}</span>
                    </div>
                  </>
                ) : breakdown.payBasis === "per-day" ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payable Days</span>
                      <span className="font-medium text-slate-900">{breakdown.payableDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Daily Rate</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.dailyRate ?? 0)}/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Pay (days × rate)</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.grossSalary)}</span>
                    </div>
                  </>
                ) : breakdown.basicSalaryComponent !== undefined ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Basic Salary</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.basicSalaryComponent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">House Rent Allowances</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.houseRentAmount ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Conveyance Allowances</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.conveyanceAmount ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Medical Allowances</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.medicalAmount ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Special Allowances</span>
                      <span className="font-medium text-slate-900">{formatINR(breakdown.specialAllowanceAmount ?? 0)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Basic Salary</span>
                    <span className="font-medium text-slate-900">{formatINR(breakdown.monthlySalary)}</span>
                  </div>
                )}
                {(slip.allowances > 0 || breakdown.basicSalaryComponent === undefined) ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Allowances</span>
                    <span className="font-medium text-slate-900">{formatINR(slip.allowances)}</span>
                  </div>
                ) : null}
                <div className="border-t border-slate-100 pt-1.5 flex justify-between font-semibold">
                  <span className="text-slate-700">Gross Pay</span>
                  <span className="text-slate-900">{formatINR(breakdown.grossSalary + slip.allowances)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase text-red-600">Deductions</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Leave Deduction</span>
                  <span className="font-medium text-slate-900">{formatINR(breakdown.leaveDeduction)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Food Deduction</span>
                  <span className="font-medium text-slate-900">{formatINR(breakdown.foodDeduction)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Travel Deduction</span>
                  <span className="font-medium text-slate-900">{formatINR(breakdown.travelDeduction)}</span>
                </div>
                {!breakdown.pfExempted ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">PF ({breakdown.pfPct}%)</span>
                    <span className="font-medium text-slate-900">{formatINR(breakdown.pfDeduction)}</span>
                  </div>
                ) : null}
                {!breakdown.esicExempted ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">ESIC ({breakdown.esicPct}%)</span>
                    <span className="font-medium text-slate-900">{formatINR(breakdown.esicDeduction)}</span>
                  </div>
                ) : null}
                {!breakdown.tdsExempted ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">TDS ({breakdown.tdsPct}%)</span>
                    <span className="font-medium text-slate-900">{formatINR(breakdown.tdsDeduction)}</span>
                  </div>
                ) : null}
                <div className="border-t border-slate-100 pt-1.5 flex justify-between font-semibold">
                  <span className="text-slate-700">Total Deductions</span>
                  <span className="text-slate-900">{formatINR(breakdown.leaveDeduction + breakdown.foodDeduction + breakdown.travelDeduction + breakdown.pfDeduction + breakdown.esicDeduction + breakdown.tdsDeduction)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary */}
          <div className="mt-3 rounded-lg border-2 border-slate-900 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Net Salary (Take Home)</p>
              <p className="text-xl font-bold text-slate-900">{formatINR(breakdown.finalSalary)}</p>
            </div>
            {slip.paidAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Paid on: {new Date(slip.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Download Button */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 print:hidden">
        <button
          className="rounded-lg bg-slate-950 px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-slate-800"
          type="button"
          onClick={() => window.print()}
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
