"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client-utils";

type InvoiceData = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  subtotal?: number;
  gstRate?: number;
  gstAmount?: number;
  total?: number;
  dueDate?: string;
  items?: { description: string; quantity: number; rate: number; amount: number }[];
  description: string;
  status: string;
  approvalStatus?: string;
  createdAt: string;
  region?: string;
  board?: { title?: string };
  company?: { name?: string; address?: string; addresses?: { label?: string; address?: string }[] };
  approvedBy?: { name?: string };
};

export default function InvoicePage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ invoices: InvoiceData[] }>("/api/finance/invoice")
      .then((res) => {
        const found = res.invoices.find((i) => i.id === id);
        setInvoice(found ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!invoice) return <div className="flex min-h-screen items-center justify-center">Invoice not found.</div>;

  return (
    <div className="min-h-screen bg-white p-8 print:p-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{invoice.company?.name ?? "Invoice"}</h1>
            {invoice.region ? <p className="text-sm text-slate-500">{invoice.region}</p> : null}
            {invoice.company?.address ? <p className="text-sm text-slate-500">{invoice.company.address}</p> : null}
          </div>
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm text-white print:hidden"
            onClick={() => window.print()}
          >
            Download PDF
          </button>
        </div>

        <div className="border-b border-slate-200 pb-6">
          <p className="text-lg font-semibold">{invoice.invoiceNumber}</p>
          <p className="text-sm text-slate-500">{new Date(invoice.createdAt).toLocaleDateString()}</p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Client</p>
            <p className="mt-1 font-medium">{invoice.clientName}</p>
            {invoice.clientEmail ? <p className="text-sm text-slate-500">{invoice.clientEmail}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Status</p>
            <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-medium ${invoice.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {invoice.status}
            </span>
          </div>
        </div>

        {invoice.board?.title ? (
          <p className="mt-4 text-sm text-slate-500">Project: {invoice.board.title}</p>
        ) : null}

        <div className="mt-8 border-t border-slate-200 pt-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium uppercase text-slate-500">
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Rate</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items?.length ? invoice.items : [{ description: invoice.description || "Professional services", quantity: 1, rate: invoice.amount, amount: invoice.amount }]).map((item, index) => <tr key={index}>
                <td className="py-4">{item.description}</td>
                <td className="py-4 text-right">{item.quantity}</td>
                <td className="py-4 text-right">₹{Number(item.rate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                <td className="py-4 text-right">₹{Number(item.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
              </tr>)}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200"><td colSpan={3} className="pt-4 text-right">Subtotal</td><td className="pt-4 text-right">₹{Number(invoice.subtotal ?? invoice.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
              <tr><td colSpan={3} className="pt-2 text-right">GST ({Number(invoice.gstRate ?? 0)}%)</td><td className="pt-2 text-right">₹{Number(invoice.gstAmount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
              <tr className="text-base font-semibold"><td colSpan={3} className="pt-3 text-right">Total</td><td className="pt-3 text-right">₹{Number(invoice.total ?? invoice.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td></tr>
            </tfoot>
          </table>
        </div>

        {invoice.approvedBy?.name ? (
          <div className="mt-8 border-t border-slate-200 pt-6 text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Approved by</p>
            <p className="mt-1 font-medium">{invoice.approvedBy.name}</p>
            <p className="text-xs text-slate-400">Admin approval</p>
          </div>
        ) : null}

        <p className="mt-12 text-center text-xs text-slate-400">Generated by FlowZen Finance</p>
      </div>
    </div>
  );
}
