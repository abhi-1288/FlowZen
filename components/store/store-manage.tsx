"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  Loader2,
  Pencil,
  Plus,
  Minus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { categoryLabel } from "@/lib/store-constants";

type StoreItemDto = {
  id: string;
  name: string;
  productNumber: string;
  batchNumber: string;
  category: string;
  description: string;
  unit: string;
  price: number;
  stock: number;
  regionLabel: string;
};

type CategoryDto = { value: string; label: string };

const emptyForm = {
  name: "",
  productNumber: "",
  batchNumber: "",
  category: "stationery",
  description: "",
  unit: "piece",
  price: "",
  stock: "",
};

export function StoreManage() {
  const [items, setItems] = useState<StoreItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StoreItemDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [itemsRes, catRes] = await Promise.all([
        apiFetch<{ items: StoreItemDto[]; region: string }>(
          `/api/store/items${search ? `?search=${encodeURIComponent(search)}` : ""}`,
          undefined,
          { toast: false },
        ),
        apiFetch<{ categories: CategoryDto[] }>("/api/store/categories", undefined, { toast: false }),
      ]);
      setItems(itemsRes.items ?? []);
      setRegion(itemsRes.region ?? "");
      setCategories(catRes.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(item: StoreItemDto) {
    setEditing(item);
    setForm({
      name: item.name,
      productNumber: item.productNumber,
      batchNumber: item.batchNumber ?? "",
      category: item.category || "other",
      description: item.description ?? "",
      unit: item.unit || "piece",
      price: item.price ? String(item.price) : "",
      stock: String(item.stock ?? 0),
    });
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    setFormError("");
    if (!form.name.trim()) return setFormError("A product name is required.");
    if (!form.productNumber.trim()) return setFormError("A product number is required.");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        productNumber: form.productNumber.trim(),
        batchNumber: form.batchNumber.trim(),
        category: form.category,
        description: form.description.trim(),
        unit: form.unit.trim() || "piece",
        price: Number(form.price || 0),
        stock: Number(form.stock || 0),
      };
      if (editing) {
        await apiFetch(`/api/store/items/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/store/items", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save this product.");
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock(item: StoreItemDto, direction: "in" | "out") {
    const raw = window.prompt(
      direction === "in" ? `Units to check IN for ${item.name}:` : `Units to check OUT for ${item.name} (on hand: ${item.stock}):`,
    );
    if (raw === null) return;
    const quantity = Math.floor(Number(raw));
    if (!Number.isFinite(quantity) || quantity < 1) return;
    setBusyId(item.id);
    try {
      await apiFetch(`/api/store/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: direction, quantity }),
      });
      await load();
    } catch {
      /* toast already shown */
    } finally {
      setBusyId("");
    }
  }

  async function remove(item: StoreItemDto) {
    if (!window.confirm(`Remove "${item.name}" from the store?`)) return;
    setBusyId(item.id);
    try {
      await apiFetch(`/api/store/items/${item.id}`, { method: "DELETE" });
      await load();
    } catch {
      /* toast already shown */
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white">
            <Boxes size={21} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Inventory</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {region ? `${region} stock` : "Company-wide stock"} · {items.length} product(s)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="neu-btn inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openCreate}
            className="neu-btn neu-btn-primary inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold"
          >
            <Plus size={15} />
            Add product
          </button>
        </div>
      </header>

      <div className="neu-inset mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5">
        <Search size={16} className="text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, product number or batch…"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-zinc-100"
        />
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : items.length === 0 ? (
        <div className="neu-card grid place-items-center gap-3 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-500">No products yet. Add your first product.</p>
          <button
            onClick={openCreate}
            className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-semibold"
          >
            Add product
          </button>
        </div>
      ) : (
        <div className="neu-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-zinc-800">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 dark:text-zinc-100">{item.name}</p>
                    <p className="font-mono text-[11px] text-slate-400">{item.productNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{categoryLabel(item.category)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.batchNumber || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">
                    {Number(item.price ?? 0) > 0 ? `₹${Number(item.price).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        Number(item.stock) <= 0
                          ? "bg-rose-50 text-rose-600"
                          : Number(item.stock) <= 5
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {item.stock} {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <IconBtn
                        title="Check in (add stock)"
                        disabled={busyId === item.id}
                        onClick={() => void adjustStock(item, "in")}
                      >
                        <Plus size={14} />
                      </IconBtn>
                      <IconBtn
                        title="Check out (remove stock)"
                        disabled={busyId === item.id}
                        onClick={() => void adjustStock(item, "out")}
                      >
                        <Minus size={14} />
                      </IconBtn>
                      <IconBtn title="Edit" onClick={() => openEdit(item)}>
                        <Pencil size={14} />
                      </IconBtn>
                      <IconBtn title="Delete" danger disabled={busyId === item.id} onClick={() => void remove(item)}>
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <Modal title={editing ? "Edit product" : "Add product"} onClose={() => setShowForm(false)}>
          {formError ? (
            <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input
              label="Product number"
              value={form.productNumber}
              onChange={(v) => setForm({ ...form, productNumber: v })}
            />
            <Input
              label="Batch number (optional)"
              value={form.batchNumber}
              onChange={(v) => setForm({ ...form, batchNumber: v })}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <Input
              label="Price (optional)"
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
              type="number"
            />
            <Input
              label={editing ? "Stock on hand" : "Opening stock"}
              value={form.stock}
              onChange={(v) => setForm({ ...form, stock: v })}
              type="number"
            />
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="neu-btn neu-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={15} /> : null}
              {editing ? "Save changes" : "Add product"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-40 ${
        danger
          ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="neu-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
