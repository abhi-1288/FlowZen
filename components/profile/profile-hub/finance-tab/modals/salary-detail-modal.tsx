import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton } from "../../shared";
import type { AnyRecord } from "../../shared";
import type { SalaryBreakdown } from "../types";

const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-black/40";
const modalClass = "flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl";

export function SalaryDetailModal({
  salaryId,
  onClose,
}: {
  salaryId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!salaryId) return;
    setLoading(true);
    setError("");
    apiFetch<AnyRecord>(`/api/finance/salary/${salaryId}`)
      .then((data) => setDetail(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [salaryId]);

  if (!salaryId) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h4 className="text-lg font-semibold text-slate-900">Salary Detail</h4>
          <ActionButton variant="ghost" onClick={onClose}>Close</ActionButton>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-rose-600">{error}</p>
          ) : detail ? (
            <SalaryDetailContent detail={detail} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SalaryDetailContent({ detail }: { detail: AnyRecord }) {
  const employee = detail.employee as AnyRecord;
  const breakdown = detail.breakdown as SalaryBreakdown | null;

  return (
    <div className="space-y-5">
      {/* Employee Info */}
      <div>
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Employee</h5>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
          <RowDetail label="Name" value={String(employee?.name ?? "")} />
          <RowDetail label="Email" value={String(employee?.email ?? "")} />
          <RowDetail label="Role" value={String(employee?.role ?? "")} />
          <RowDetail label="Emp Code" value={String(employee?.companyIdentityCode ?? "-")} />
          <RowDetail label="Base Salary" value={`₹${Number(employee?.baseSalary ?? 0).toLocaleString("en-IN")}`} />
        </div>
      </div>

      {/* Record Info */}
      <div>
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Record</h5>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
          <RowDetail label="Month" value={String(detail.month ?? "")} />
          <RowDetail label="Status" value={String(detail.status ?? "")} />
          <RowDetail label="Allowances" value={`₹${Number(detail.allowances ?? 0).toLocaleString("en-IN")}`} />
          <RowDetail label="Deductions" value={`₹${Number(detail.deductions ?? 0).toLocaleString("en-IN")}`} />
          <RowDetail label="Net Salary" value={`₹${Number(detail.netSalary ?? 0).toLocaleString("en-IN")}`} />
          <RowDetail label="Paid At" value={detail.paidAt ? new Date(String(detail.paidAt)).toLocaleDateString() : "-"} />
        </div>
      </div>

      {/* Recalculated Breakdown */}
      {breakdown ? (
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Breakdown</h5>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <RowDetail label="Period" value={`${breakdown.periodStart} to ${breakdown.periodEnd}`} />
            <RowDetail label="Total Days" value={String(breakdown.totalDays)} />
            <RowDetail label="Absent Days" value={String(breakdown.absentDays)} />
            <RowDetail label="Paid Leave" value={String(breakdown.paidLeaveDays)} />
            <RowDetail label="Unpaid Leave" value={String(breakdown.unpaidLeaveDays)} />
            <RowDetail label="Payable Days" value={String(breakdown.payableDays)} />
            <RowDetail label="Daily Salary" value={`₹${breakdown.dailySalary.toLocaleString("en-IN")}`} />
            <RowDetail label="Gross Salary" value={`₹${breakdown.grossSalary.toLocaleString("en-IN")}`} />
            <RowDetail label="Leave Deduction" value={`-₹${breakdown.leaveDeduction.toLocaleString("en-IN")}`} />
            <RowDetail label="Manual Deductions" value={`-₹${breakdown.manualDeductions.toLocaleString("en-IN")}`} />
            <RowDetail label="Food Deduction" value={`-₹${breakdown.foodDeduction.toLocaleString("en-IN")}`} />
            <RowDetail label="Travel Deduction" value={`-₹${breakdown.travelDeduction.toLocaleString("en-IN")}`} />
            <RowDetail label="PF Deduction" value={`-₹${breakdown.pfDeduction.toLocaleString("en-IN")}`} />
            <RowDetail label="ESIC Deduction" value={`-₹${breakdown.esicDeduction.toLocaleString("en-IN")}`} />
            <RowDetail label="TDS Deduction" value={`-₹${breakdown.tdsDeduction.toLocaleString("en-IN")}`} />
            <RowDetail label="Total Deductions" value={`-₹${breakdown.totalDeductions.toLocaleString("en-IN")}`} />
            <RowDetail label="Allowances" value={`+₹${breakdown.allowances.toLocaleString("en-IN")}`} />
            <div className="border-t border-slate-300 pt-1.5 mt-1.5">
              <RowDetail label="Final Salary" value={`₹${breakdown.finalSalary.toLocaleString("en-IN")}`} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RowDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}
