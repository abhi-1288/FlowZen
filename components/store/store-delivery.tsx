"use client";

import { useCallback, useEffect, useState } from "react";
import {
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

const STAGE_BUTTONS = [
  {
    value: "packing",
    label: "Packing",
    active: "bg-amber-500 text-white",
    idle: "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950",
  },
  {
    value: "out-for-delivery",
    label: "Out for delivery",
    active: "bg-sky-600 text-white",
    idle: "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950",
  },
  {
    value: "delivered",
    label: "Delivered",
    active: "bg-emerald-600 text-white",
    idle: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950",
  },
] as const;

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
  const [error, setError] = useState("");
  const [section, setSection] = useState<Section>("delivery");
  const [filter, setFilter] = useState<FilterValue>("active");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const { showSuccessToast } = useNotificationToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ orders: StoreOrderDto[] }>(
        "/api/store/orders?scope=all",
        undefined,
        { toast: false },
      );
      setOrders(
        (res.orders ?? []).filter((o) => o.status === "approved" || o.status === "fulfilled"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load deliveries.");
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
    setError("");
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
      const label = STAGE_BUTTONS.find((b) => b.value === status)?.label ?? status;
      const productName = order.items?.[index]?.name ?? "product";
      showSuccessToast(`${label} marked for ${productName}`);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this product.");
    } finally {
      setBusy("");
    }
  }

  async function setAllPacking(order: StoreOrderDto, indexes: number[]) {
    setBusy(`${order.id}:batch:packing`);
    setError("");
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
      setError(err instanceof Error ? err.message : "Unable to update products.");
    } finally {
      setBusy("");
    }
  }

  async function setTakeAway(order: StoreOrderDto, status: "ready" | "handed-over") {
    setBusy(`${order.id}:takeaway:${status}`);
    setError("");
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
      setError(err instanceof Error ? err.message : "Unable to update this take-away order.");
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
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-sky-600 text-white">
            <Truck size={21} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Delivery</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Approved orders — pack deliveries, prepare take-aways and hand them over.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          className="neu-btn inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

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
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
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
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.value
                ? "bg-sky-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : visible.length === 0 ? (
        <div className="neu-card grid place-items-center gap-2 rounded-2xl p-12 text-center text-sm text-slate-500">
          {section === "takeaway" ? "No take-away orders here right now." : "Nothing to deliver right now."}
        </div>
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
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-800 dark:text-zinc-100">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          takeAway
                            ? takeAwayStatusColor(order.takeAwayStatus)
                            : order.status === "fulfilled"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
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
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            {batchBusy ? (
                              <Loader2 size={11} className="mr-1 inline animate-spin" />
                            ) : null}
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
    </div>
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
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {canAct && status === "pending" ? (
        <button
          type="button"
          disabled={Boolean(busyStatus)}
          onClick={onReady}
          className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busyStatus === "ready" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <PackageCheck size={13} />
          )}
          Mark packed &amp; ready for pickup
        </button>
      ) : null}
      {canAct && status === "ready" ? (
        <button
          type="button"
          disabled={Boolean(busyStatus)}
          onClick={onHandOver}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busyStatus === "handed-over" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <PackageCheck size={13} />
          )}
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
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <Receipt size={13} />
      View invoice
    </a>
  );
}

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
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="truncate text-sm text-slate-700 dark:text-zinc-200">
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
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STAGE_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              disabled={busy}
              onClick={() => onSet(btn.value)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                status === btn.value ? btn.active : btn.idle
              }`}
            >
              {busyStatus === btn.value ? (
                <Loader2 size={11} className="mr-1 inline animate-spin" />
              ) : null}
              {btn.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
