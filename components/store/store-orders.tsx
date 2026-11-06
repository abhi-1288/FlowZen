"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { StoreChip, StoreEmpty, StoreShell } from "@/components/store/store-shell";
import { StoreOrderCard, type StoreOrderDto } from "@/components/store/order-card";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Awaiting" },
  { value: "approved", label: "Approved" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "closed", label: "Rejected / Cancelled" },
] as const;

export function StoreOrders() {
  const [orders, setOrders] = useState<StoreOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ orders: StoreOrderDto[] }>(
        "/api/store/orders?scope=my",
        undefined,
        { toast: false },
      );
      setOrders(res.orders ?? []);
    } catch {
      /* a failed refresh keeps whatever is on screen; toast surfaced by apiFetch */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "closed") return o.status === "rejected" || o.status === "cancelled";
    return o.status === filter;
  });

  return (
    <StoreShell
      view="orders"
      title="My Orders"
      subtitle="Track what you have requested."
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
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <StoreChip
            key={f.value}
            active={filter === f.value}
            onClick={() => setFilter(f.value)}
            count={
              f.value === "all"
                ? orders.length
                : orders.filter((o) =>
                    f.value === "closed"
                      ? o.status === "rejected" || o.status === "cancelled"
                      : o.status === f.value,
                  ).length
            }
          >
            {f.label}
          </StoreChip>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <RefreshCw className="animate-spin" size={24} />
        </div>
      ) : visible.length === 0 ? (
        <StoreEmpty
          icon={Package}
          title={
            filter === "all" ? "No orders yet" : "Nothing in this filter"
          }
          message={
            filter === "all"
              ? "Everything you request from the store shows up here with its live progress."
              : "Once an order hits this state it will appear here."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <StoreOrderCard key={order.id} order={order} canCancel onChanged={() => void load()} />
          ))}
        </div>
      )}
    </StoreShell>
  );
}
