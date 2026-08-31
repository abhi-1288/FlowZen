import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, displayNested } from "../../shared";
import type { AnyRecord } from "../../shared";
import type { SalaryBreakdown } from "../types";

const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-black/40";
const modalClass = "flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl neu-card";

export function SalaryEditModal({
  target,
  submitting,
  onClose,
  onSubmit,
}: {
  target: AnyRecord | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (allowances: string, deductions: string, note: string) => void;
}) {
  const [allowances, setAllowances] = useState("");
  const [deductions, setDeductions] = useState("");
  const [note, setNote] = useState("");
  const [breakdown, setBreakdown] = useState<SalaryBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;
    setAllowances(String(target.allowances ?? 0));
    setDeductions(String(target.manualDeductions ?? target.deductions ?? 0));
    setNote(String(target.note ?? ""));
    setError("");
    if (target.breakdown) {
      setBreakdown(target.breakdown as SalaryBreakdown);
      return;
    }
    setLoading(true);
    apiFetch<AnyRecord>(`/api/finance/salary/${String(target.id)}`)
      .then((data) => {
        if (data.breakdown) setBreakdown(data.breakdown as SalaryBreakdown);
        setAllowances(String(data.allowances ?? 0));
        setDeductions(String(data.manualDeductions ?? data.deductions ?? 0));
        setNote(String(data.note ?? ""));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load salary."),
      )
      .finally(() => setLoading(false));
  }, [target]);

  if (!target) return null;

  const fixedAllowances = Number(allowances || 0);
  const fixedDeductions = Number(deductions || 0);
  const pf = breakdown?.pfDeduction ?? 0;
  const esic = breakdown?.esicDeduction ?? 0;
  const tds = breakdown?.tdsDeduction ?? 0;
  const food = breakdown?.foodDeduction ?? 0;
  const travel = breakdown?.travelDeduction ?? 0;
  const gross = breakdown?.grossSalary ?? 0;
  const netSalary = Math.max(
    0,
    gross + fixedAllowances - (fixedDeductions + food + travel + pf + esic + tds),
  );
  const isRejected = String(target.status ?? "") === "rejected";
  const rejectionReason = String(target.rejectionReason ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(allowances, deductions, note);
  }

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <div className="flex items-center justify-between border-b border-[var(--c-border-light)] px-6 py-4">
          <h4 className="text-lg font-semibold text-slate-900">Edit &amp; Re-send Salary</h4>
          <ActionButton variant="ghost" onClick={onClose}>Close</ActionButton>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error ? (
              <p className="mb-3 text-sm text-rose-600">{error}</p>
            ) : null}
            <div className="rounded-lg neu-inset p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee</span>
                <span className="font-medium text-slate-900">
                  {displayNested(target.employee, "name", "Employee")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Month</span>
                <span className="font-medium text-slate-900">{String(target.month ?? "")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-medium">{String(target.status ?? "")}</span>
              </div>
              {isRejected && rejectionReason ? (
                <div className="rounded bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                  Admin rejection: {rejectionReason}
                </div>
              ) : null}
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading breakdown...</p>
            ) : (
              <div className="grid gap-3 mt-4">
                <div className="rounded-lg neu-inset p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gross Salary</span>
                    <span className="font-medium text-slate-900">₹{gross.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Deductions (PF/ESIC/TDS/Food/Travel)</span>
                    <span>- ₹{(food + travel + pf + esic + tds).toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Manual Allowances (₹)</label>
                    <input className="w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm" type="number" min="0" value={allowances} onChange={(e) => setAllowances(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Manual Deductions (₹)</label>
                    <input className="w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm" type="number" min="0" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Note to Admin</label>
                  <textarea className="w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the change or revision..." />
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 flex justify-between font-bold text-emerald-700">
                  <span>Net Salary</span>
                  <span>₹{netSalary.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--c-border-light)] px-6 py-4">
            <ActionButton variant="secondary" type="button" onClick={onClose}>Cancel</ActionButton>
            <ActionButton variant="approve" type="submit" disabled={submitting}>
              {submitting ? "Sending..." : isRejected ? "Re-send for Approval" : "Send for Approval"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
