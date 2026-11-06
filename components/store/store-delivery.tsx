"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  PackageCheck,
  Receipt,
  RefreshCw,
  Store as StoreIcon,
  Truck,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import {
  deliveryStatusColor,
  deliveryStatusLabel,
  fulfillmentMethodLabel,
  takeAwayStatusColor,
  takeAwayStatusLabel,
} from "@/lib/store-constants";
import type { StoreOrderDto, StoreOrderLine } from "@/components/store/order-card";
import { StoreChip, StoreEmpty, StoreShell } from "@/components/store/store-shell";

const SECTIONS = [
  { value: "delivery", label: "Delivery orders", icon: Truck },
  { value: "takeaway", label: "Take-away orders", icon: StoreIcon },
] as const;

type Section = (typeof SECTIONS)[number]["value"];

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

/** The three warehouse stages in the order they happen. */
const STAGES = [
  { value: "packing", label: "Packing" },
  { value: "out-for-delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
] as const;

const STAGE_SOLID: Record<string, string> = {
  packing: "bg-amber-500 text-white",
  "out-for-delivery": "bg-sky-600 text-white",
  delivered: "bg-emerald-600 text-white",
};

const STAGE_SOFT: Record<string, string> = {
  packing: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "out-for-delivery": "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

function stageIndex(status: string) {
  return STAGES.findIndex((s) => s.value === status);
}

function lineStatus(line: StoreOrderLine) {
  return String(line.deliveryStatus ?? "pending");
}

function deliveredCount(order: StoreOrderDto) {
  return (order.items ?? []).filter((l) => lineStatus(l) === "delivered").length;
}

function isTakeAwayOrder(order: StoreOrderDto) {
  return String(order.fulfillmentMethod ?? "delivery") === "takeaway";
}

function invoiceLink(order: StoreOrderDto) {
  return `/store-invoice/${order.id}`;
}

export function StoreDelivery({ onChanged }: { onChanged?: () => void } = {}) {
  const [orders, setOrders] = useState<StoreOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("delivery");
  const [filter, setFilter] = useState<FilterValue>("active");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const { showSuccessToast, showErrorToast } = useNotificationToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ orders: StoreOrderDto[] }>(
        "/api/store/orders?scope=all",
        undefined,
        { toast: false },
      );
      setOrders(
        (res.orders ?? []).filter((o) => o.status === "approved" || o.status === "fulfilled"),
      );
    } catch {
      /* toast surfaced by apiFetch */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patchOrder(updated: StoreOrderDto) {
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? { ...o, ...updated, id: o.id } : o)),
    );
  }

  async function setStatus(order: StoreOrderDto, index: number, status: string) {
    setBusy(`${order.id}:${index}:${status}`);
    try {
      const res = await apiFetch<{ order: StoreOrderDto & { id: string } }>(
        `/api/store/orders/${order.id}/delivery`,
        {
          method: "PATCH",
          body: JSON.stringify({ index, status }),
        },
        { toast: false },
      );
      patchOrder(res.order);
      const label = STAGES.find((b) => b.value === status)?.label ?? status;
      const productName = order.items?.[index]?.name ?? "product";
      showSuccessToast(`${label} marked for ${productName}`);
      onChanged?.();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Unable to update this product.");
    } finally {
      setBusy("");
    }
  }

  async function setAllPacking(order: StoreOrderDto, indexes: number[]) {
    setBusy(`${order.id}:batch:packing`);
    try {
      const res = await apiFetch<{ order: StoreOrderDto & { id: string } }>(
        `/api/store/orders/${order.id}/delivery`,
        {
          method: "PATCH",
          body: JSON.stringify({ indexes, status: "packing" }),
        },
        { toast: false },
      );
      patchOrder(res.order);
      showSuccessToast(`${indexes.length} products marked Packing`);
      onChanged?.();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Unable to update products.");
    } finally {
      setBusy("");
    }
  }

  async function setTakeAway(order: StoreOrderDto, status: "ready" | "handed-over") {
    setBusy(`${order.id}:takeaway:${status}`);
    try {
      const res = await apiFetch<{ order: StoreOrderDto & { id: string } }>(
        `/api/store/orders/${order.id}/takeaway`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
        { toast: false },
      );
      patchOrder(res.order);
      showSuccessToast(
        status === "ready"
          ? `Order ${order.orderNumber} marked ready for pickup`
          : `Order ${order.orderNumber} handed over — invoice ready`,
      );
      onChanged?.();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Unable to update this take-away order.");
    } finally {
      setBusy("");
    }
  }

  const sectionOrders = orders.filter((o) =>
    section === "takeaway" ? isTakeAwayOrder(o) : !isTakeAwayOrder(o),
  );

  const visible = sectionOrders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "completed") return o.status === "fulfilled";
    return o.status === "approved";
  });

  const sectionCounts: Record<Section, number> = {
    delivery: orders.filter((o) => !isTakeAwayOrder(o) && o.status === "approved").length,
    takeaway: orders.filter((o) => isTakeAwayOrder(o) && o.status === "approved").length,
  };

  return (
    <StoreShell
      view="delivery"
      title="Delivery"
      subtitle="Approved orders — pack deliveries, prepare take-aways and hand them over."
      actions={
        <button
          onClick={() => void load()}
          disabled={loading}
          className="neu-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = section === item.value;
          return (
            <button
              key={item.value}
              onClick={() => {
                setSection(item.value);
                setFilter("active");
              }}
              aria-pressed={active}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon size={16} />
                {item.label}
              </span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold dark:bg-zinc-800">
                {sectionCounts[item.value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <StoreChip
            key={f.value}
            active={filter === f.value}
            onClick={() => setFilter(f.value)}
            count={
              f.value === "all"
                ? sectionOrders.length
                : sectionOrders.filter((o) =>
                    f.value === "completed" ? o.status === "fulfilled" : o.status === "approved",
                  ).length
            }
          >
            {f.label}
          </StoreChip>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : visible.length === 0 ? (
        <StoreEmpty
          icon={Truck}
          title={section === "takeaway" ? "No take-away orders here" : "Nothing to deliver"}
          message="Approved orders show up here with their packing progress."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => {
            const takeAway = isTakeAwayOrder(order);
            const items = order.items ?? [];
            const isBulk = items.length > 1;
            const isLocked = order.status !== "approved";
            const done = deliveredCount(order);
            const expanded = open[order.id] ?? (isBulk && order.status === "approved");
            const batchBusy = busy.startsWith(`${order.id}:batch:`);
            const pendingIndexes = items
              .map((line, idx) => (lineStatus(line) === "pending" ? idx : -1))
              .filter((idx) => idx >= 0);
            const lineBusy = (idx: number) => {
              const prefix = `${order.id}:${idx}:`;
              return busy.startsWith(prefix) ? busy.slice(prefix.length) : "";
            };
            const takeAwayBusy = busy.startsWith(`${order.id}:takeaway:`)
              ? busy.slice(`${order.id}:takeaway:`.length)
              : "";

            return (
              <article key={order.id} className="neu-card rounded-2xl p-4">
                <button
                  type="button"
                  onClick={() => setOpen((prev) => ({ ...prev, [order.id]: !expanded }))}
                  aria-expanded={expanded}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-800 dark:text-zinc-100">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          takeAway
                            ? takeAwayStatusColor(order.takeAwayStatus)
                            : order.status === "fulfilled"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                        }`}
                      >
                        {takeAway
                          ? takeAwayStatusLabel(order.takeAwayStatus)
                          : order.status === "fulfilled"
                            ? "Delivered"
                            : "To deliver"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {takeAway
                          ? `${items.length} product${items.length === 1 ? "" : "s"}`
                          : `${done}/${items.length} delivered`}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {fulfillmentMethodLabel(order.fulfillmentMethod)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                      {order.requester?.name ?? "Unknown requester"}
                      {order.regionLabel ? ` · ${order.regionLabel}` : ""}
                      {order.createdAt ? ` · ${new Date(order.createdAt).toLocaleDateString()}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                      {takeAway ? "Collector" : "To"}:{" "}
                      <span className="font-medium">{order.deliveryName}</span>
                      {order.department ? ` — ${order.department}` : ""}
                    </p>
                  </div>
                  {isBulk ? (
                    <ChevronDown
                      size={16}
                      className={`mt-1 shrink-0 text-slate-400 transition-transform duration-300 ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  ) : null}
                </button>

                {isBulk ? (
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <ul className="mt-3 space-y-2">
                        {items.map((line, idx) => (
                          <li key={idx} className="neu-inset rounded-xl p-3">
                            {takeAway ? (
                              <TakeAwayLine line={line} />
                            ) : (
                              <ProductLine
                                line={line}
                                busyStatus={lineBusy(idx)}
                                locked={isLocked}
                                onSet={(status) => void setStatus(order, idx, status)}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                      {!takeAway && order.status === "approved" && pendingIndexes.length > 0 ? (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            disabled={busy !== ""}
                            onClick={() => void setAllPacking(order, pendingIndexes)}
                            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            {batchBusy ? <Loader2 size={11} className="animate-spin" /> : null}
                            Mark all as packing
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : items[0] ? (
                  <div className="neu-inset mt-3 rounded-xl p-3">
                    {takeAway ? (
                      <TakeAwayLine line={items[0]} />
                    ) : (
                      <ProductLine
                        line={items[0]}
                        busyStatus={lineBusy(0)}
                        locked={isLocked}
                        onSet={(status) => void setStatus(order, 0, status)}
                      />
                    )}
                  </div>
                ) : null}

                {takeAway ? (
                  <TakeAwayActions
                    order={order}
                    busyStatus={takeAwayBusy}
                    onReady={() => void setTakeAway(order, "ready")}
                    onHandOver={() => void setTakeAway(order, "handed-over")}
                  />
                ) : order.invoiceIssuedAt ? (
                  <div className="mt-3">
                    <InvoiceLink order={order} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </StoreShell>
  );
}

function TakeAwayLine({ line }: { line: StoreOrderLine }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="truncate text-sm text-slate-700 dark:text-zinc-200">
        {line.name}
        <span className="ml-2 font-mono text-[11px] text-slate-400">{line.productNumber}</span>
      </span>
      <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
        {line.quantity} {line.unit}
      </span>
    </div>
  );
}

function TakeAwayActions({
  order,
  busyStatus,
  onReady,
  onHandOver,
}: {
  order: StoreOrderDto;
  busyStatus: string;
  onReady: () => void;
  onHandOver: () => void;
}) {
  const status = String(order.takeAwayStatus ?? "pending");
  const canAct = order.status === "approved";
  const hasInvoice = Boolean(order.invoiceIssuedAt);

  if (!canAct && !hasInvoice) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      {canAct && status === "pending" ? (
        <button
          type="button"
          disabled={Boolean(busyStatus)}
          onClick={onReady}
          className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busyStatus === "ready" ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={13} />}
          Mark packed &amp; ready for pickup
        </button>
      ) : null}
      {canAct && status === "ready" ? (
        <button
          type="button"
          disabled={Boolean(busyStatus)}
          onClick={onHandOver}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busyStatus === "handed-over" ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={13} />}
          Mark handed over
        </button>
      ) : null}
      {hasInvoice ? <InvoiceLink order={order} /> : null}
    </div>
  );
}

function InvoiceLink({ order }: { order: StoreOrderDto }) {
  return (
    <a
      href={invoiceLink(order)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
    >
      <Receipt size={13} />
      View invoice
    </a>
  );
}

/**
 * One product line with its three-stage stepper: Packing → Out for delivery →
 * Delivered. Every stage is directly clickable (the API accepts any settable
 * status), so the warehouse can also correct a mis-click by stepping back.
 */
function ProductLine({
  line,
  busyStatus,
  locked,
  onSet,
}: {
  line: StoreOrderLine;
  busyStatus: string;
  locked: boolean;
  onSet: (status: string) => void;
}) {
  const status = lineStatus(line);
  const busy = Boolean(busyStatus);
  const current = stageIndex(status); // -1 for pending
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-slate-700 dark:text-zinc-200">
          {line.name}
          <span className="ml-2 font-mono text-[11px] text-slate-400">{line.productNumber}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
            {line.quantity} {line.unit}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${deliveryStatusColor(status)}`}
          >
            {deliveryStatusLabel(status)}
          </span>
        </span>
      </div>

      {!locked ? (
        <ol className="mt-2.5 flex items-center gap-1" aria-label="Delivery stages">
          {STAGES.map((stage, idx) => {
            const isCurrent = status === stage.value;
            const isDone = current >= 0 && idx < current;
            // Stepping to an earlier stage is allowed through the API too, so
            // "future" stages stay subtle but still clickable for corrections.
            const isAhead = current >= 0 && idx > current;
            const isPending = current < 0;
            const base =
              isCurrent
                ? STAGE_SOLID[stage.value]
                : isDone
                  ? STAGE_SOFT[stage.value]
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800";
            return (
              <li key={stage.value} className="flex flex-1 items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSet(stage.value)}
                  title={`Set this product to “${stage.label}”`}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${base}`}
                >
                  {isCurrent || isDone ? (
                    <Check size={10} strokeWidth={3.5} className={isCurrent ? "" : "opacity-60"} />
                  ) : isPending ? (
                    <span className="leading-none opacity-60">{idx + 1}</span>
                  ) : isAhead ? (
                    <span className="leading-none opacity-60">{idx + 1}</span>
                  ) : null}
                  {stage.label}
                  {busyStatus === stage.value ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : null}
                </button>
                {idx < STAGES.length - 1 ? (
                  <span
                    aria-hidden
                    className={`h-px w-2 flex-none sm:w-3 ${
                      current >= 0 && idx <= current - 1 ? "bg-emerald-400" : "bg-slate-200 dark:bg-zinc-700"
                    }`}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </>
  );
}
