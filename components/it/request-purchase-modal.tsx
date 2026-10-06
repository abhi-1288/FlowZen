"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import {
  type ProcurementCategory,
  ALL_PROCUREMENT_CATEGORIES,
  PROCUREMENT_CATEGORY_LABELS,
} from "./it-types";

type WarehouseItem = {
  id: string;
  category: ProcurementCategory;
  model: string;
  stock: number;
  notes?: string;
};

function categoryTitle(category: ProcurementCategory, model: string): string {
  const label = PROCUREMENT_CATEGORY_LABELS[category];
  return model ? `${label} — ${model}` : label;
}

export function RequestPurchaseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<ProcurementCategory>("laptop");
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [assignedTo, setAssignedTo] = useState("");
  const [assigneeOptions, setAssigneeOptions] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isHardware = category === "laptop" || category === "desktop";

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ assignees: { id: string; name: string }[] }>("/api/procurement/assignees")
      .then((res) => {
        if (!cancelled) setAssigneeOptions(res.assignees);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHardware) {
      setSelectedItemId("");
      setItems([]);
      return;
    }
    let cancelled = false;
    apiFetch<{ items: WarehouseItem[] }>(`/api/it/warehouse?category=${category}`, undefined, {
      toast: false,
    })
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [category, isHardware]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const maxQuantity = isHardware
    ? Math.max(1, selectedItem?.stock ?? 1)
    : undefined;

  const title = isHardware
    ? categoryTitle(category, selectedItem?.model ?? "")
    : itemName.trim();

  function canSubmit(): boolean {
    if (!title || !assignedTo) return false;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) return false;
    if (maxQuantity !== undefined && qty > maxQuantity) return false;
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit()) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/procurement", {
        method: "POST",
        body: JSON.stringify({
          title,
          category,
          vendor: vendor.trim(),
          amount: Number(amount),
          quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
          assignedTo: assignedTo || undefined,
        }),
      });
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-[#111]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            Request a Purchase
          </h3>
          <button
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                Category
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProcurementCategory)}
              >
                {ALL_PROCUREMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PROCUREMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isHardware ? (
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Archive size={14} className="text-slate-400" />
                <label className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                  Available in warehouse
                </label>
              </div>
              <div className="space-y-2">
                {items.map((item) => {
                  const hasStock = item.stock > 0;
                  const active = selectedItemId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!hasStock}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? "border-slate-950 bg-slate-50 dark:border-zinc-100 dark:bg-zinc-800"
                          : "border-slate-200 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      } ${hasStock ? "" : "cursor-not-allowed opacity-50"}`}
                    >
                      <span className="font-medium text-slate-800 dark:text-zinc-200">
                        {item.model}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          hasStock
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}
                      >
                        {hasStock ? `${item.stock} in stock` : "Out of stock"}
                      </span>
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
                    No {PROCUREMENT_CATEGORY_LABELS[category].toLowerCase()} models listed in the
                    warehouse yet.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                Item
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                placeholder="e.g. Adobe Creative Cloud (annual)"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                Amount
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                Quantity
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                type="number"
                min="1"
                max={maxQuantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              {maxQuantity !== undefined && (
                <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
                  {selectedItem ? `${maxQuantity} available in warehouse` : "1+ units"}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                Vendor
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                placeholder="Optional"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Assign a reviewer
            </label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              required
            >
              <option value="">
                {assigneeOptions.length === 0
                  ? "No reviewer available in your region"
                  : "Select a reviewer"}
              </option>
              {assigneeOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              disabled={submitting || !canSubmit()}
              type="submit"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}