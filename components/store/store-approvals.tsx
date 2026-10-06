"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckSquare, Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { StoreOrderCard, type StoreOrderDto } from "@/components/store/order-card";

export function StoreApprovals({ onChanged }: { onChanged?: () => void }) {
  const [orders, setOrders] = useState<StoreOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Kept in a ref so a parent that rebuilds this callback on every render
  // cannot re-trigger the load effect below.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ orders: StoreOrderDto[] }>(
        "/api/store/orders?scope=awaiting",
        undefined,
        { toast: false },
      );
      setOrders(res.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load approvals.");
    } finally {
      setLoading(false);
    }
  }, []);

  const notify = () => {
    void load();
    onChangedRef.current?.();
  };

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-amber-500 text-white">
            <CheckSquare size={21} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Store Approvals</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Orders waiting on your decision. Approving releases the held stock.
            </p>
          </div>
        </div>
        <button
          onClick={() => notify()}
          className="neu-btn inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : orders.length === 0 ? (
        <div className="neu-card grid place-items-center gap-2 rounded-2xl p-12 text-center text-sm text-slate-500">
          Nothing is waiting for you. Enjoy the quiet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <StoreOrderCard
              key={order.id}
              order={order}
              canApprove
              onChanged={() => notify()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
