import type { FormEvent } from "react";
import { ActionButton, SectionHeader, Card } from "../../shared";
import type { AnyRecord } from "../../shared";
import type { ExpenseForm } from "../types";

export function ExpenseFormSection({
  expenseForm,
  actorRole,
  financeMembers,
  onSubmit,
  onFormChange,
}: {
  expenseForm: ExpenseForm;
  actorRole: string;
  financeMembers: AnyRecord[];
  onSubmit: (event: FormEvent) => void;
  onFormChange: (form: ExpenseForm) => void;
}) {
  return (
    <Card>
      <SectionHeader title="Expense Request" description="Submit a new expense for approval" accent="rose" />
      <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={onSubmit}>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={expenseForm.category}
          onChange={(e) => onFormChange({ ...expenseForm, category: e.target.value })}
        >
          <option value="software">Software purchase</option>
          <option value="device">Laptop/device</option>
          <option value="travel">Travel expense</option>
          <option value="office-resources">Office resources</option>
        </select>
        <input
          className="rounded-lg border border-slate-200 px-3 py-2"
          required
          placeholder="Title"
          value={expenseForm.title}
          onChange={(e) => onFormChange({ ...expenseForm, title: e.target.value })}
        />
        <input
          className="rounded-lg border border-slate-200 px-3 py-2"
          placeholder="Amount"
          type="number"
          value={expenseForm.amount}
          onChange={(e) => onFormChange({ ...expenseForm, amount: e.target.value })}
        />
        <input
          className="rounded-lg border border-slate-200 px-3 py-2"
          required
          min={1}
          placeholder="Quantity"
          type="number"
          value={expenseForm.quantity}
          onChange={(e) => onFormChange({ ...expenseForm, quantity: e.target.value })}
        />
        {actorRole !== "finance" ? (
          <select
            className="rounded-lg border border-slate-200 px-3 py-2"
            required
            value={expenseForm.assignedTo}
            onChange={(e) => onFormChange({ ...expenseForm, assignedTo: e.target.value })}
          >
            <option value="">Assign finance user</option>
            {financeMembers.map((fm) => (
              <option key={String(fm.id)} value={String(fm.id)}>{String(fm.name)}</option>
            ))}
          </select>
        ) : null}
        <ActionButton variant="primary">Request</ActionButton>
        <textarea
          className="rounded-lg border border-slate-200 px-3 py-2 md:col-span-4"
          placeholder="Reason"
          value={expenseForm.reason}
          onChange={(e) => onFormChange({ ...expenseForm, reason: e.target.value })}
        />
      </form>
    </Card>
  );
}
