import type { FormEvent } from "react";
import { ActionButton } from "../../shared";
import type { InvoiceForm } from "../types";

const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-black/40";
const modalClass = "w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl";

export function InvoiceModal({
  show,
  invoiceForm,
  onFormChange,
  onSubmit,
  onCancel,
}: {
  show: boolean;
  invoiceForm: InvoiceForm;
  onFormChange: (form: InvoiceForm) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  if (!show) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h4 className="text-lg font-semibold">Create Invoice</h4>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Client name" value={invoiceForm.clientName} onChange={(e) => onFormChange({ ...invoiceForm, clientName: e.target.value })} />
          <input className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Client email" type="email" value={invoiceForm.clientEmail} onChange={(e) => onFormChange({ ...invoiceForm, clientEmail: e.target.value })} />
          <input className="rounded-lg border border-slate-200 px-3 py-2" required placeholder="Amount" type="number" value={invoiceForm.amount} onChange={(e) => onFormChange({ ...invoiceForm, amount: e.target.value })} />
          <textarea className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Description (optional)" value={invoiceForm.description} onChange={(e) => onFormChange({ ...invoiceForm, description: e.target.value })} />
          <div className="flex justify-end gap-3">
            <ActionButton variant="secondary" type="button" onClick={onCancel}>Cancel</ActionButton>
            <ActionButton variant="primary">Create</ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
