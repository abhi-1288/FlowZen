"use client";

import { useState } from "react";
import { Loader2, X, Check, Ban, Receipt } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import {
  statusLabel,
  statusColor,
  categoryLabel,
  deliveryStatusColor,
  deliveryStatusLabel,
  fulfillmentMethodLabel,
  takeAwayStatusColor,
  takeAwayStatusLabel,
} from "@/lib/store-constants";

export type StoreOrderLine = {
  item?: string;
  productNumber?: string;
  batchNumber?: string;
  name?: string;
  category?: string;
  unit?: string;
  price?: number;
  quantity?: number;
  /** Warehouse-set delivery progress, visible once the order is approved. */
  deliveryStatus?: string;
};

export type StoreOrderDto = {
  id: string;
  orderNumber: string;
  status: string;
  regionLabel?: string;
  deliveryName?: string;
  department?: string;
  fulfillmentMethod?: string;
  takeAwayStatus?: string;
  takeAwayReadyAt?: string | null;
  takeAwayHandedOverAt?: string | null;
  invoiceIssuedAt?: string | null;
  items: StoreOrderLine[];
  requester?: { id?: string; name?: string; email?: string; role?: string } | null;
  approver?: { id?: string; name?: string; email?: string; role?: string } | null;
  createdAt?: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  fulfilledAt?: string | null;
  rejectedReason?: string;
  cancelReason?: string;
  activity?: Array<{
    user?: unknown;
    action?: string;
    detail?: string;
    createdAt?: string;
  }>;
};

type Props = {
  order: StoreOrderDto;
  /** Which actions the viewer is allowed to attempt (server still enforces). */
  canApprove?: boolean;
  canCancel?: boolean;
  onChanged?: () => void;
};

export function StoreOrderCard({ order, canApprove, canCancel, onChanged }: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reasonOpen, setReasonOpen] = useState<"" | "rejected" | "cancelled">("");

  const isPending = order.status === "pending";
  const isApproved = order.status === "approved";
  const isTakeAway = String(order.fulfillmentMethod ?? "delivery") === "takeaway";
  const units = (order.items ?? []).reduce((sum, l) => sum + Number(l.quantity ?? 0), 0);
  const value = (order.items ?? []).reduce(
    (sum, l) => sum + Number(l.quantity ?? 0) * Number(l.price ?? 0),
    0,
  );

  async function transition(status: string, reason?: string) {
    setBusy(status);
    setError("");
    try {
      await apiFetch(`/api/store/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      setReasonOpen("");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this order.");
    } finally {
      setBusy("");
    }
  }

  return (
    <article className="neu-card rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-800 dark:text-zinc-100">
              {order.orderNumber}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor(order.status)}`}>
              {statusLabel(order.status)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isTakeAway
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  : "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              }`}
            >
              {fulfillmentMethodLabel(order.fulfillmentMethod)}
            </span>
            {isTakeAway && (isApproved || order.status === "fulfilled") ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${takeAwayStatusColor(order.takeAwayStatus)}`}
              >
                {takeAwayStatusLabel(order.takeAwayStatus)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {order.requester?.name ?? "Unknown requester"}
            {order.regionLabel ? ` · ${order.regionLabel}` : ""}
            {order.createdAt ? ` · ${new Date(order.createdAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-zinc-400">
          <p className="font-semibold text-slate-700 dark:text-zinc-200">
            {units} unit{units === 1 ? "" : "s"}
            {value > 0 ? ` · ₹${value.toFixed(2)}` : ""}
          </p>
          <p>
            {isTakeAway ? "Collector" : "To"}: {order.deliveryName}
          </p>
          {order.department ? <p>{order.department}</p> : null}
          {isTakeAway && order.regionLabel ? <p>Pickup: {order.regionLabel}</p> : null}
        </div>
      </div>

      <div className="neu-inset mt-3 rounded-xl p-3">
        <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
          {(order.items ?? []).map((line, idx) => (
            <li key={idx} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="truncate text-slate-700 dark:text-zinc-200">
                {line.name}
                <span className="ml-2 font-mono text-[11px] text-slate-400">{line.productNumber}</span>
                <span className="ml-2 text-[11px] uppercase text-slate-400">
                  {categoryLabel(line.category)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {!isTakeAway && (isApproved || order.status === "fulfilled") ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${deliveryStatusColor(line.deliveryStatus)}`}
                  >
                    {deliveryStatusLabel(line.deliveryStatus)}
                  </span>
                ) : null}
                <span className="text-xs font-semibold text-slate-500">
                  {line.quantity} {line.unit}
                  {Number(line.price ?? 0) > 0 ? ` · ₹${(Number(line.price) * Number(line.quantity)).toFixed(2)}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {(order.status === "rejected" || order.status === "cancelled") &&
      (order.rejectedReason || order.cancelReason) ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {order.status === "rejected" ? "Rejected" : "Cancelled"}: {order.rejectedReason || order.cancelReason}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}

      {reasonOpen ? (
        <ReasonPrompt
          status={reasonOpen}
          busy={Boolean(busy)}
          onCancel={() => setReasonOpen("")}
          onSubmit={(text) => transition(reasonOpen, text)}
        />
      ) : null}

      {(canApprove && isPending) || (canCancel && isPending) || order.invoiceIssuedAt ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canApprove && isPending ? (
            <>
              <button
                disabled={Boolean(busy)}
                onClick={() => transition("approved")}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === "approved" ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
                Approve
              </button>
              <button
                disabled={Boolean(busy)}
                onClick={() => setReasonOpen("rejected")}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
              >
                <X size={13} />
                Reject
              </button>
            </>
          ) : null}
          {canCancel && isPending ? (
            <button
              disabled={Boolean(busy)}
              onClick={() => setReasonOpen("cancelled")}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            >
              <Ban size={13} />
              Cancel
            </button>
          ) : null}
          {order.invoiceIssuedAt ? (
            <a
              href={`/store-invoice/${order.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Receipt size={13} />
              View invoice
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ReasonPrompt({
  status,
  busy,
  onCancel,
  onSubmit,
}: {
  status: "rejected" | "cancelled";
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="neu-inset mt-3 rounded-xl p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {status === "rejected" ? "Rejection" : "Cancellation"} reason
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
        placeholder="Required…"
      />
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy || !text.trim()}
          onClick={() => onSubmit(text.trim())}
          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
        >
          Back
        </button>
      </div>
    </div>
  );
}
