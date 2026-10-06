"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Package, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import type { ProcurementCategory } from "./it-types";

type WarehouseItem = {
  id: string;
  category: ProcurementCategory;
  model: string;
  stock: number;
  notes?: string;
};

const CATEGORY_OPTIONS: ProcurementCategory[] = ["laptop", "desktop"];

export function ItWarehouseTab() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ProcurementCategory>("laptop");
  const [model, setModel] = useState("");
  const [stock, setStock] = useState("1");
  const [saving, setSaving] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ items: WarehouseItem[] }>("/api/it/warehouse", undefined, {
        toast: false,
      });
      setItems(res.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const stockTotal = useMemo(
    () => items.reduce((acc, i) => acc + (Number(i.stock) || 0), 0),
    [items],
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!model.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/api/it/warehouse", {
        method: "POST",
        body: JSON.stringify({ category, model: model.trim(), stock: Number(stock) }),
      });
      setModel("");
      setStock("1");
      await fetchItems();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjust(item: WarehouseItem, delta: number) {
    if (adjustingId) return;
    const qty = 1;
    if (delta < 0 && (item.stock || 0) < qty) return;
    setAdjustingId(item.id);
    try {
      await apiFetch(`/api/it/warehouse/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: delta > 0 ? "in" : "out", quantity: qty }),
      });
      await fetchItems();
    } catch {
      /* ignore */
    } finally {
      setAdjustingId(null);
    }
  }

  async function handleDelete(item: WarehouseItem) {
    if (!window.confirm(`Remove "${item.model}" from the warehouse?`)) return;
    try {
      await apiFetch(`/api/it/warehouse/${item.id}`, { method: "DELETE" });
      await fetchItems();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
          Warehouse inventory
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          These are the laptop and desktop models shown to members when they request a purchase.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4 dark:border-zinc-700 dark:bg-[#000000]"
        onSubmit={handleAdd}
      >
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          value={category}
          onChange={(e) => setCategory(e.target.value as ProcurementCategory)}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c === "laptop" ? "Laptop" : "Desktop"}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          placeholder="Model name, e.g. MacBook Pro 16"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          required
        />
        <div className="flex gap-2">
          <input
            className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            aria-label="Stock"
          />
          <button
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            disabled={saving || !model.trim()}
            type="submit"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </form>

      <div>
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <Package size={14} />
          <span>
            {items.length} model{items.length !== 1 ? "s" : ""} · {stockTotal} units in stock
          </span>
        </div>
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center dark:border-zinc-700">
            <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">
              No inventory yet
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
              Add your first laptop or desktop model above.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-[#000000]"
              >
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {item.category === "laptop" ? "Laptop" : "Desktop"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-200">
                    {item.model}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    onClick={() => handleAdjust(item, -1)}
                    disabled={item.stock < 1 || adjustingId === item.id}
                    type="button"
                    aria-label="Check out one"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-16 text-center text-sm font-semibold text-slate-800 dark:text-zinc-200">
                    {item.stock}
                  </span>
                  <button
                    className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    onClick={() => handleAdjust(item, 1)}
                    disabled={adjustingId === item.id}
                    type="button"
                    aria-label="Check in one"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                  onClick={() => handleDelete(item)}
                  type="button"
                  aria-label="Remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}