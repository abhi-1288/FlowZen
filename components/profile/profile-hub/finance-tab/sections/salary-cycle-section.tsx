"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, SectionHeader } from "../../shared";
import type { AnyRecord } from "../../shared";
import type { SalaryCycleData } from "../types";

export function SalaryCycleSection({
  salaryCycle,
  actorRole,
  profileId,
  adminOptions,
  onRefresh,
}: {
  salaryCycle: SalaryCycleData | null;
  actorRole: string;
  profileId: string;
  adminOptions: AnyRecord[];
  onRefresh: () => void;
}) {
  const [proposedStartDay, setProposedStartDay] = useState("");
  const [proposedEndDay, setProposedEndDay] = useState("");
  const [assignedAdmin, setAssignedAdmin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isFinance = actorRole === "finance";
  const isAdmin = actorRole === "admin";

  const pending = salaryCycle?.salaryCycleChangeStatus === "pending";
  const isAssignedApprover = isAdmin && salaryCycle?.salaryCycleChangeApprover?._id === profileId;

  async function handlePropose() {
    setErrorMsg("");
    const startDay = Number(proposedStartDay);
    const endDay = Number(proposedEndDay);
    if (startDay < 1 || startDay > 31 || !Number.isInteger(startDay)) {
      setErrorMsg("Invalid start day");
      return;
    }
    if (endDay < 1 || endDay > 31 || !Number.isInteger(endDay)) {
      setErrorMsg("Invalid end day");
      return;
    }
    if (startDay <= endDay) {
      setErrorMsg("Last month date must be greater than current month date");
      return;
    }
    if (!assignedAdmin) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/finance/salary-cycle", {
        method: "POST",
        body: JSON.stringify({ salaryCycleStartDay: startDay, salaryCycleEndDay: endDay, assignedAdminId: assignedAdmin }),
      });
      setProposedStartDay("");
      setProposedEndDay("");
      setAssignedAdmin("");
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to propose change");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    try {
      await apiFetch("/api/finance", {
        method: "PATCH",
        body: JSON.stringify({ type: "salary-cycle", id: "", status: "approved" }),
      });
      onRefresh();
    } catch {
      // handled by apiFetch
    }
  }

  async function handleReject() {
    try {
      await apiFetch("/api/finance", {
        method: "PATCH",
        body: JSON.stringify({ type: "salary-cycle", id: "", status: "rejected" }),
      });
      onRefresh();
    } catch {
      // handled by apiFetch
    }
  }

  const startDay = salaryCycle?.salaryCycleStartDay;
  const endDay = salaryCycle?.salaryCycleEndDay;
  const cycleDay = salaryCycle?.salaryCycleDay ?? 29;
  const displayStart = startDay ?? (cycleDay > 1 ? cycleDay : null);
  const displayEnd = endDay ?? (cycleDay > 1 ? cycleDay - 1 : null);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Salary Cycle" description="Configure the salary period cycle day and manage pending changes." accent="cyan" />

      {/* Current Setting */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Cycle Day</span>
          <span className="text-sm font-semibold text-slate-900">
            {displayStart && displayEnd ? `${displayStart}${ordinal(displayStart)} to ${displayEnd}${ordinal(displayEnd)}` : "1st of each month"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Salary period: {displayStart && displayEnd ? `${displayStart}${ordinal(displayStart)} of previous month to ${displayEnd}${ordinal(displayEnd)} of current month` : "last day of previous month to 1st of current month"}
        </p>
      </div>

      {/* Pending Change */}
      {pending ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">Pending Change</p>
              <p className="text-xs text-amber-600">
                Proposed: {salaryCycle.pendingSalaryCycleStartDay ? `${salaryCycle.pendingSalaryCycleStartDay}${ordinal(salaryCycle.pendingSalaryCycleStartDay ?? 0)} to ${salaryCycle.pendingSalaryCycleEndDay}${ordinal(salaryCycle.pendingSalaryCycleEndDay ?? 0)}` : `${salaryCycle.pendingSalaryCycleDay}${ordinal(salaryCycle.pendingSalaryCycleDay ?? 0)} day`}
                {salaryCycle.salaryCycleChangeRequestedBy ? ` by ${salaryCycle.salaryCycleChangeRequestedBy.name}` : ""}
              </p>
            </div>
            {isAssignedApprover ? (
              <div className="flex gap-2">
                <ActionButton variant="approve" onClick={handleApprove}>Approve</ActionButton>
                <ActionButton variant="danger" onClick={handleReject}>Reject</ActionButton>
              </div>
            ) : isAdmin && !isAssignedApprover ? (
              <span className="text-xs text-amber-600">Assigned to another admin</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Proposal Form (Finance only, when no pending change) */}
      {isFinance && !pending ? (
        <div className="space-y-3">
          {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[120px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Last Month Date</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="number"
                min={1}
                max={31}
                placeholder="e.g. 29"
                value={proposedStartDay}
                onChange={(e) => setProposedStartDay(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Current Month Date</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="number"
                min={1}
                max={31}
                placeholder="e.g. 28"
                value={proposedEndDay}
                onChange={(e) => setProposedEndDay(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Assign Admin</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={assignedAdmin}
                onChange={(e) => setAssignedAdmin(e.target.value)}
              >
                <option value="">Select admin...</option>
                {adminOptions.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>{String(a.name ?? "")}</option>
                ))}
              </select>
            </div>
            <ActionButton variant="primary" disabled={!proposedStartDay || !proposedEndDay || !assignedAdmin || submitting} onClick={handlePropose}>
              {submitting ? "Proposing..." : "Propose Change"}
            </ActionButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ordinal(n: number): string {
  if (n === 0) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
