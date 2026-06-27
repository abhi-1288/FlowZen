import { ActionButton, Card, SectionHeader } from "../../shared";
import type { AnyRecord } from "../../shared";

export function InvoicesSection({
  invoices,
  isFinanceOrAdmin,
  onCreateInvoice,
  onMarkInvoice,
}: {
  invoices: AnyRecord[];
  isFinanceOrAdmin: boolean;
  onCreateInvoice: () => void;
  onMarkInvoice: (id: string, status: string) => void;
}) {
  const pendingInvoicesCount = invoices.filter((inv) => String(inv.status ?? "") === "pending").length;

  return (
    <Card>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            Invoices
            {invoices.length > 0 ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-100 px-1.5 text-[11px] font-bold text-sky-700">{invoices.length}</span>
            ) : null}
            {pendingInvoicesCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {pendingInvoicesCount} unpaid
              </span>
            ) : null}
          </span>
        }
        description="Generate client invoices and track payments."
      />
      <div className="mb-3 flex justify-end">
        <ActionButton variant="primary" onClick={onCreateInvoice}>Create Invoice</ActionButton>
      </div>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {invoices.length === 0 ? <p className="py-2 text-sm text-slate-500">No invoices yet.</p> : null}
        {invoices.map((inv) => (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2" key={String(inv.id)}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{String(inv.clientName)} &mdash; &#x20B9;{Number(inv.amount ?? 0).toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-500 truncate">{String(inv.invoiceNumber)} &bull; {String(inv.status)}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {isFinanceOrAdmin ? (
                String(inv.status) === "pending" ? (
                  <ActionButton variant="approve" className="px-2 py-1 text-xs" onClick={() => onMarkInvoice(String(inv.id), "paid")}>Mark paid</ActionButton>
                ) : (
                  <ActionButton variant="secondary" className="px-2 py-1 text-xs" onClick={() => onMarkInvoice(String(inv.id), "pending")}>Mark pending</ActionButton>
                )
              ) : null}
              <ActionButton variant="secondary" className="px-2 py-1 text-xs" onClick={() => window.open(`/invoice/${String(inv.id)}`, "_blank")}>PDF</ActionButton>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
