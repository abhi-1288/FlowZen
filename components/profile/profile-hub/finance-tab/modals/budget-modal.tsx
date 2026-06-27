import type { FormEvent } from "react";
import { ActionButton } from "../../shared";
import type { AnyRecord } from "../../shared";
import type { BudgetForm } from "../types";

const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-black/40";
const modalClass = "w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl";

export function BudgetModal({
  show,
  editingBudgetId,
  budgetForm,
  boards,
  financeMembers,
  actorRole,
  onFormChange,
  onSubmit,
  onCancel,
}: {
  show: boolean;
  editingBudgetId: string | null;
  budgetForm: BudgetForm;
  boards: AnyRecord[];
  financeMembers: AnyRecord[];
  actorRole: string;
  onFormChange: (form: BudgetForm) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  if (!show) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h4 className="text-lg font-semibold">{editingBudgetId ? "Edit Budget" : "Allocate Budget"}</h4>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <select className="rounded-lg border border-slate-200 px-3 py-2" required value={budgetForm.boardId} onChange={(e) => onFormChange({ ...budgetForm, boardId: e.target.value })}>
            <option value="">Select project</option>
            {boards.map((board) => (
              <option key={String(board.id)} value={String(board.id)}>{String(board.title)} ({String(board.label ?? "Created by Unknown")})</option>
            ))}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Total project budget" type="number" value={budgetForm.totalBudget} onChange={(e) => onFormChange({ ...budgetForm, totalBudget: e.target.value })} />
            <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Team spending limit" type="number" value={budgetForm.teamSpendingLimit} onChange={(e) => onFormChange({ ...budgetForm, teamSpendingLimit: e.target.value })} />
            <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Resource budget" type="number" value={budgetForm.resourceBudget} onChange={(e) => onFormChange({ ...budgetForm, resourceBudget: e.target.value })} />
            <input className="rounded-lg border border-slate-200 px-3 py-2" type="date" value={budgetForm.deadline} onChange={(e) => onFormChange({ ...budgetForm, deadline: e.target.value })} />
          </div>
          {actorRole === "admin" ? (
            <select className="rounded-lg border border-slate-200 px-3 py-2" required value={budgetForm.assignedTo} onChange={(e) => onFormChange({ ...budgetForm, assignedTo: e.target.value })}>
              <option value="">Assign a finance user to approve</option>
              {financeMembers.map((fm) => (
                <option key={String(fm.id)} value={String(fm.id)}>{String(fm.name)}</option>
              ))}
            </select>
          ) : null}
          <div className="flex justify-end gap-3">
            <ActionButton variant="secondary" type="button" onClick={onCancel}>Cancel</ActionButton>
            <ActionButton variant="primary">{editingBudgetId ? "Update" : "Allocate"}</ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
