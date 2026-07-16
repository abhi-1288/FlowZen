"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton } from "../../shared";

const sectionClass = "rounded-xl border border-slate-200 bg-white p-5";

export function AdvanceRequestSection({
  approvers,
  showToast,
}: {
  approvers: { id: string; name: string }[];
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [repayInMonths, setRepayInMonths] = useState("1");
  const [approverId, setApproverId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      showToast("Enter a valid advance amount.", "error");
      return;
    }
    if (!reason.trim()) {
      showToast("Enter a reason for the advance.", "error");
      return;
    }
    if (!approverId) {
      showToast("Select an approver.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/finance/salary-advance", {
        method: "POST",
        body: JSON.stringify({
          advanceAmount: Number(amount),
          reason: reason.trim(),
          repayInMonths: Number(repayInMonths),
          approverId,
        }),
      });
      showToast("Advance salary request submitted.", "success");
      setAmount("");
      setReason("");
      setRepayInMonths("1");
      setApproverId("");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit advance request.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={sectionClass}>
      <div className="mb-4 border-l-4 border-violet-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Advance Salary</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Request a salary advance against future earnings.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Amount (₹)
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="number"
              min={1}
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Repay in (months)
            </label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={repayInMonths}
              onChange={(e) => setRepayInMonths(e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>
                  {n} month{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {amount && Number(amount) > 0 && Number(repayInMonths) > 0 ? (
              <p className="text-xs text-slate-500">
                ~₹{Math.round(Number(amount) / Number(repayInMonths)).toLocaleString("en-IN")}/month
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Reason
          </label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
            placeholder="Why do you need this advance?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
        {approvers.length > 0 ? (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Assign to
            </label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              required
            >
              <option value="">Select an approver...</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <ActionButton variant="primary" disabled={submitting} className="px-4">
          {submitting ? "Requesting..." : "Request Advance"}
        </ActionButton>
      </form>
    </section>
  );
}
