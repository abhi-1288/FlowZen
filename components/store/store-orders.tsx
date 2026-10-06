"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Package, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { StoreOrderCard, type StoreOrderDto } from "@/components/store/order-card";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Awaiting" },
  { value: "approved", label: "Approved" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "closed", label: "Rejected / Cancelled" },
];

export function StoreOrders() {
  const [orders, setOrders] = useState<StoreOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ orders: StoreOrderDto[] }>(
        "/api/store/orders?scope=my",
        undefined,
        { toast: false },
      );
      setOrders(res.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders.");
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
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-indigo-600 text-white">
            <Package size={21} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">My Orders</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Track what you have requested.</p>
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

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.value
                ? "bg-indigo-600 text-white"
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
          No orders here yet.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <StoreOrderCard
              key={order.id}
              order={order}
              canCancel
              onChanged={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
