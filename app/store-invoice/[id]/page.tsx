"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client-utils";

type InvoiceItem = {
  name: string;
  productNumber: string;
  category: string;
  unit: string;
  quantity: number;
};

type InvoiceData = {
  invoice: {
    number: string;
    issuedAt: string;
    completedAt: string | null;
    fulfillmentMethod: string;
    deliveryName: string;
    department: string;
    regionLabel: string;
    requester: { name?: string; email?: string; companyIdentityCode?: string } | null;
    approver: { name?: string; email?: string } | null;
    fulfilledBy: { name?: string } | null;
    items: InvoiceItem[];
  };
  company: {
    name: string;
    icon: string;
    address: string;
    supportEmail: string;
    website: string;
  };
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function methodLabel(value: string) {
  return value === "takeaway" ? "Take-away" : "Delivery";
}

export default function StoreInvoicePage() {
  const params = useParams();
  const id = params ? String(params.id ?? "") : "";
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch<InvoiceData>(`/api/store/orders/${id}/invoice`, undefined, { toast: false })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load invoice.");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Loading invoice...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-rose-600">{error || "Invoice not found."}</p>
      </div>
    );
  }

  const { invoice, company } = data;

  return (
    <div className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-end print:hidden">
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm print:rounded-none print:p-6 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <p className="text-lg font-bold text-slate-900">{company.name}</p>
              {company.address ? (
                <p className="mt-1 max-w-sm text-xs text-slate-500">{company.address}</p>
              ) : null}
              {company.supportEmail ? (
                <p className="mt-1 text-xs text-slate-500">{company.supportEmail}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold uppercase tracking-wide text-slate-900">Store Invoice</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-700">{invoice.number}</p>
              <p className="mt-1 text-xs text-slate-500">Issued {formatDateTime(invoice.issuedAt)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Requester
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {invoice.requester?.name ?? "—"}
              </p>
              {invoice.requester?.companyIdentityCode ? (
                <p className="text-xs text-slate-500">{invoice.requester.companyIdentityCode}</p>
              ) : null}
              {invoice.requester?.email ? (
                <p className="text-xs text-slate-500">{invoice.requester.email}</p>
              ) : null}
              {invoice.regionLabel ? (
                <p className="mt-1 text-xs text-slate-500">Region: {invoice.regionLabel}</p>
              ) : null}
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Fulfilment
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {methodLabel(invoice.fulfillmentMethod)}
              </p>
              <p className="text-xs text-slate-500">
                {invoice.fulfillmentMethod === "takeaway" ? "Collector" : "Delivered to"}:{" "}
                {invoice.deliveryName || "—"}
              </p>
              {invoice.department ? (
                <p className="text-xs text-slate-500">{invoice.department}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                Completed {formatDateTime(invoice.completedAt)}
              </p>
              {invoice.fulfilledBy?.name ? (
                <p className="text-xs text-slate-500">By {invoice.fulfilledBy.name}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-8">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-3">#</th>
                  <th className="pb-3 pr-3">Product</th>
                  <th className="pb-3 pr-3">Product No.</th>
                  <th className="pb-3 pr-3 text-right">Qty</th>
                  <th className="pb-3 text-right">Unit</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={`${item.productNumber}-${index}`} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 text-slate-400">{index + 1}</td>
                    <td className="py-2.5 pr-3 font-medium text-slate-800">{item.name}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
                      {item.productNumber}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{item.quantity}</td>
                    <td className="py-2.5 text-right text-slate-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500">
            <p>Approved by {invoice.approver?.name ?? "—"}</p>
            <p>This document records fulfilled store items. No payment amount is recorded.</p>
          </div>

          <p className="mt-8 text-center text-[11px] text-slate-400">Generated by FlowZen Store</p>
        </div>
      </div>
    </div>
  );
}
