import type { FormEvent } from "react";
import { ActionButton } from "../../shared";
import type { InvoiceForm } from "../types";

const overlayClass = "fixed inset-0 z-[100] grid place-items-center bg-black/40";
const modalClass = "w-full max-w-lg rounded-2xl bg-[var(--c-bg-elevated)] p-6 shadow-xl";

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
  const subtotal = invoiceForm.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0);
  const gst = subtotal * (Number(invoiceForm.gstRate) || 0) / 100;
  const updateItem = (index: number, key: "description" | "quantity" | "rate", value: string) => {
    const items = invoiceForm.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item);
    onFormChange({ ...invoiceForm, items });
  };

  return (
    <div className={overlayClass}>
      <div className={`${modalClass} max-h-[90vh] max-w-2xl overflow-y-auto`}>
        <h4 className="text-lg font-semibold">Create Invoice</h4>
        <p className="mt-1 text-sm text-[var(--c-text-muted)]">Create an itemized invoice with GST calculations.</p>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <input className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" required placeholder="Client name" value={invoiceForm.clientName} onChange={(e) => onFormChange({ ...invoiceForm, clientName: e.target.value })} />
          <input className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" placeholder="Client email" type="email" value={invoiceForm.clientEmail} onChange={(e) => onFormChange({ ...invoiceForm, clientEmail: e.target.value })} />
          <input className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" required placeholder="What service/product is this for?" value={invoiceForm.serviceDescription} onChange={(e) => onFormChange({ ...invoiceForm, serviceDescription: e.target.value, description: e.target.value })} />
          <div className="rounded-xl border border-[var(--c-border-light)] p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Items</span><button type="button" className="text-sm text-[var(--color-primary)]" onClick={() => onFormChange({ ...invoiceForm, items: [...invoiceForm.items, { description: "", quantity: "1", rate: "" }] })}>+ Add item</button></div>
            <div className="grid gap-2">
              {invoiceForm.items.map((item, index) => <div className="grid gap-2 md:grid-cols-[1fr_90px_130px_auto]" key={index}>
                <input className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" required placeholder="Item or service" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} />
                <input className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" required min="0.01" step="0.01" type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} />
                <input className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" required min="0" step="0.01" type="number" placeholder="Unit price" value={item.rate} onChange={(e) => updateItem(index, "rate", e.target.value)} />
                {invoiceForm.items.length > 1 ? <button type="button" className="px-2 text-rose-600" onClick={() => onFormChange({ ...invoiceForm, items: invoiceForm.items.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button> : <span />}
              </div>)}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">GST rate (%)<input className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" min="0" max="100" step="0.01" type="number" value={invoiceForm.gstRate} onChange={(e) => onFormChange({ ...invoiceForm, gstRate: e.target.value })} /></label>
            <label className="grid gap-1 text-sm">Due date<input className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" type="date" value={invoiceForm.dueDate} onChange={(e) => onFormChange({ ...invoiceForm, dueDate: e.target.value })} /></label>
          </div>
          <textarea className="rounded-lg border border-[var(--c-border-light)] px-3 py-2" placeholder="Notes (optional)" value={invoiceForm.description} onChange={(e) => onFormChange({ ...invoiceForm, description: e.target.value })} />
          <div className="ml-auto w-full max-w-xs space-y-1 border-t border-[var(--c-border-light)] pt-3 text-right text-sm"><p>Subtotal: ₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p><p>GST: ₹{gst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p><p className="text-base font-bold">Total: ₹{(subtotal + gst).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div>
          <div className="flex justify-end gap-3">
            <ActionButton variant="secondary" type="button" onClick={onCancel}>Cancel</ActionButton>
            <ActionButton variant="primary">Create</ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
