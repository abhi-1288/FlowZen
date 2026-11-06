"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckSquare, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { StoreEmpty, StoreShell } from "@/components/store/store-shell";
import { StoreOrderCard, type StoreOrderDto } from "@/components/store/order-card";

export function StoreApprovals({ onChanged }: { onChanged?: () => void }) {
  const [orders, setOrders] = useState<StoreOrderDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Kept in a ref so a parent that rebuilds this callback on every render
  // cannot re-trigger the load effect below.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ orders: StoreOrderDto[] }>(
        "/api/store/orders?scope=awaiting",
        undefined,
        { toast: false },
      );
      setOrders(res.orders ?? []);
    } catch {
      /* toast surfaced by apiFetch */
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
    <StoreShell
      view="approvals"
      title="Store Approvals"
      subtitle="Orders waiting on your decision. Approving releases the held stock."
      actions={
        <button
          onClick={notify}
          disabled={loading}
          className="neu-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <RefreshCw className="animate-spin" size={24} />
        </div>
      ) : orders.length === 0 ? (
        <StoreEmpty
          icon={CheckSquare}
          title="Nothing awaiting approval"
          message="You're all caught up — requests that need your decision appear here."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <StoreOrderCard key={order.id} order={order} canApprove onChanged={() => notify()} />
          ))}
        </div>
      )}
    </StoreShell>
  );
}
