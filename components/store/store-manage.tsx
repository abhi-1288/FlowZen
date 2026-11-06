"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { categoryLabel } from "@/lib/store-constants";
import { Modal } from "@/components/profile/profile-hub/modal";
import { StoreScanModal } from "./store-scan-modal";
import {
  StoreAlert,
  StoreCategoryIcon,
  StoreChip,
  StoreEmpty,
  StoreShell,
  StockBadge,
} from "@/components/store/store-shell";

type StoreItemDto = {
  id: string;
  name: string;
  productNumber: string;
  barcode: string;
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
  barcode: "",
  batchNumber: "",
  category: "stationery",
  description: "",
  unit: "piece",
  price: "",
  stock: "",
};

type StockFilter = "all" | "low" | "out";

export function StoreManage() {
  const [items, setItems] = useState<StoreItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  // Product modal state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StoreItemDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Overlay state
  const [showScanner, setShowScanner] = useState(false);
  const [adjusting, setAdjusting] = useState<{ item: StoreItemDto; direction: "in" | "out" } | null>(null);
  const [deleting, setDeleting] = useState<StoreItemDto | null>(null);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (category !== "all") query.set("category", category);
      const hasQuery = query.toString();
      const [itemsRes, catRes] = await Promise.all([
        apiFetch<{ items: StoreItemDto[]; region: string }>(
          `/api/store/items${hasQuery ? `?${hasQuery}` : ""}`,
          undefined,
          { toast: false },
        ),
        apiFetch<{ categories: CategoryDto[] }>("/api/store/categories", undefined, { toast: false }),
      ]);
      setItems(itemsRes.items ?? []);
      setRegion(itemsRes.region ?? "");
      setCategories(catRes.categories ?? []);
    } catch (err) {
      setItemsResponseUnavailable(err);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  // apiFetch already toasts network errors; keep the local banner only as a
  // layout hint so the page still reads right when nothing loads.
  const [loadError, setLoadError] = useState("");
  function setItemsResponseUnavailable(err: unknown) {
    setItems([]);
    setLoadError(err instanceof Error ? err.message : "Unable to load inventory.");
  }

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(prefill?: {
    productNumber?: string;
    name?: string;
    description?: string;
    price?: string;
    category?: string;
  }) {
    setEditing(null);
    setForm({
      ...emptyForm,
      productNumber: prefill?.productNumber ?? "",
      name: prefill?.name ?? "",
      description: prefill?.description ?? "",
      price: prefill?.price ?? "",
      category: prefill?.category || emptyForm.category,
    });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(item: StoreItemDto) {
    setEditing(item);
    setForm({
      name: item.name,
      productNumber: item.productNumber,
      barcode: item.barcode ?? "",
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
        barcode: form.barcode.trim(),
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

  async function confirmAdjust(direction: "in" | "out", quantity: number) {
    if (!adjusting) return;
    const item = adjusting.item;
    setBusyId(item.id);
    try {
      await apiFetch(`/api/store/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: direction, quantity }),
      });
      setAdjusting(null);
      await load();
    } catch {
      /* toast already shown */
    } finally {
      setBusyId("");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await apiFetch(`/api/store/items/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await load();
    } catch {
      /* toast already shown */
    } finally {
      setBusyId("");
    }
  }

  const visible = items.filter((item) => {
    const stock = Number(item.stock ?? 0);
    if (stockFilter === "out") return stock <= 0;
    if (stockFilter === "low") return stock > 0 && stock <= 5;
    return true;
  });

  const counts = {
    out: items.filter((i) => Number(i.stock ?? 0) <= 0).length,
    low: items.filter((i) => Number(i.stock ?? 0) > 0 && Number(i.stock ?? 0) <= 5).length,
  };

  return (
    <StoreShell
      view="manage"
      title="Inventory"
      subtitle={`${region ? `${region} stock` : "Company-wide stock"} · ${items.length} product${items.length === 1 ? "" : "s"}`}
      actions={
        <>
          <button
            onClick={() => void load()}
            className="neu-btn grid h-10 w-10 place-items-center rounded-full"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className="neu-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold"
          >
            <ScanLine size={15} />
            Scan
          </button>
          <button
            onClick={() => openCreate()}
            className="neu-btn neu-btn-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold"
          >
            <Plus size={15} />
            Add product
          </button>
        </>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="neu-inset flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, product number or batch…"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-zinc-100"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="neu-inset shrink-0 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-zinc-200"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <StoreChip
            active={stockFilter === "all"}
            onClick={() => setStockFilter("all")}
            count={items.length}
          >
            All stock
          </StoreChip>
          <StoreChip
            active={stockFilter === "low"}
            onClick={() => setStockFilter("low")}
            count={counts.low}
          >
            Low (≤ 5)
          </StoreChip>
          <StoreChip
            active={stockFilter === "out"}
            onClick={() => setStockFilter("out")}
            count={counts.out}
          >
            Out
          </StoreChip>
        </div>
      </div>

      {loadError ? (
        <StoreAlert>
          {loadError}
          <button onClick={() => setLoadError("")} aria-label="Dismiss" className="ml-auto">
            <X size={14} />
          </button>
        </StoreAlert>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : visible.length === 0 ? (
        <StoreEmpty
          icon={Boxes}
          title={
            items.length === 0
              ? "No products yet"
              : loadError
                ? "Couldn't load the inventory"
                : "Nothing matches these filters"
          }
          message={
            items.length === 0
              ? "Add your first product — or scan a barcode to stock it directly."
              : "Try clearing the search, category or stock filters."
          }
        >
          {items.length === 0 ? (
            <button
              onClick={() => openCreate()}
              className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-semibold"
            >
              Add product
            </button>
          ) : null}
        </StoreEmpty>
      ) : (
        <>
          {/* Mobile: compact cards */}
          <div className="space-y-3 lg:hidden">
            {visible.map((item) => (
              <article key={item.id} className="neu-card rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <StoreCategoryIcon category={item.category} size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{item.name}</h3>
                      <StockBadge stock={Number(item.stock ?? 0)} unit={item.unit} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-zinc-500">
                      {item.productNumber}
                      {item.barcode ? ` · Barcode ${item.barcode}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                      {categoryLabel(item.category)}
                      {item.batchNumber ? ` · Batch ${item.batchNumber}` : ""}
                      {` · ₹${Number(item.price ?? 0).toFixed(2)} / ${item.unit}`}
                    </p>
                  </div>
                </div>
                <ItemActions
                  busy={busyId === item.id}
                  onAdjust={(direction) => setAdjusting({ item, direction })}
                  onEdit={() => openEdit(item)}
                  onDelete={() => setDeleting(item)}
                  className="mt-3 justify-end border-t border-slate-100 pt-2.5 dark:border-zinc-800"
                />
              </article>
            ))}
          </div>

          {/* Desktop: full table */}
          <div className="neu-card hidden overflow-hidden rounded-2xl lg:block">
            <table className="w-full text-sm">
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
                {visible.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-zinc-800/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <StoreCategoryIcon category={item.category} size={16} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-zinc-100">{item.name}</p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {item.productNumber}
                            {item.barcode ? ` · Barcode ${item.barcode}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{categoryLabel(item.category)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.batchNumber || "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">
                      {Number(item.price ?? 0) > 0
                        ? `₹${Number(item.price).toFixed(2)}`
                        : "—"}
                      <span className="ml-1 text-[11px] text-slate-400">/ {item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StockBadge stock={Number(item.stock ?? 0)} unit={item.unit} />
                    </td>
                    <td className="px-4 py-3">
                      <ItemActions
                        busy={busyId === item.id}
                        onAdjust={(direction) => setAdjusting({ item, direction })}
                        onEdit={() => openEdit(item)}
                        onDelete={() => setDeleting(item)}
                        className="justify-end"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showScanner ? (
        <StoreScanModal
          onClose={() => {
            setShowScanner(false);
            void load();
          }}
          onStocked={() => void load()}
          onUnknownCode={(code, prefill) => {
            setShowScanner(false);
            openCreate({
              productNumber: code,
              name: prefill?.name,
              description: prefill?.description,
              price: prefill?.price,
              category: prefill?.category,
            });
          }}
        />
      ) : null}

      {adjusting ? (
        <StockAdjustModal
          item={adjusting.item}
          direction={adjusting.direction}
          busy={busyId === adjusting.item.id}
          onClose={() => setAdjusting(null)}
          onConfirm={(quantity) => void confirmAdjust(adjusting.direction, quantity)}
        />
      ) : null}

      {deleting ? (
        <Modal open onClose={() => setDeleting(null)} maxWidth="max-w-md">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              <Trash2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                Remove “{deleting.name}”?
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                {Number(deleting.stock ?? 0)} {deleting.unit}
                {Number(deleting.stock ?? 0) === 1 ? "" : "s"} on hand. Past orders keep their
                history — only the store listing goes away.
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setDeleting(null)}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Keep it
            </button>
            <button
              onClick={() => void confirmDelete()}
              disabled={busyId === deleting.id}
              className="neu-btn neu-btn-danger inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busyId === deleting.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Remove product
            </button>
          </div>
        </Modal>
      ) : null}

      {showForm ? (
        <Modal open onClose={() => setShowForm(false)} maxWidth="max-w-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {editing ? `Edit ${editing.name}` : "Add product"}
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              aria-label="Close"
            >
              <X size={17} />
            </button>
          </div>
          {formError ? (
            <StoreAlert>{formError}</StoreAlert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input
              label="Product number"
              value={form.productNumber}
              onChange={(v) => setForm({ ...form, productNumber: v })}
            />
            <Input
              label="Barcode (optional)"
              value={form.barcode}
              onChange={(v) => setForm({ ...form, barcode: v })}
            />
            <Input
              label="Batch number (optional)"
              value={form.batchNumber}
              onChange={(v) => setForm({ ...form, batchNumber: v })}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">Category</span>
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
              label="Price (₹, optional)"
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
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">Description</span>
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
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
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
    </StoreShell>
  );
}

function ItemActions({
  busy,
  onAdjust,
  onEdit,
  onDelete,
  className = "",
}: {
  busy: boolean;
  onAdjust: (direction: "in" | "out") => void;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <IconBtn
        title="Check in (add stock)"
        disabled={busy}
        onClick={() => onAdjust("in")}
        className="text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
      >
        <Plus size={14} />
      </IconBtn>
      <IconBtn
        title="Check out (remove stock)"
        disabled={busy}
        onClick={() => onAdjust("out")}
        className="text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Minus size={14} />
      </IconBtn>
      <IconBtn title="Edit product" onClick={onEdit}>
        <Pencil size={14} />
      </IconBtn>
      <IconBtn title="Remove from store" disabled={busy} onClick={onDelete} danger>
        <Trash2 size={14} />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-40 ${
        danger
          ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
          : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function StockAdjustModal({
  item,
  direction,
  busy,
  onClose,
  onConfirm,
}: {
  item: StoreItemDto;
  direction: "in" | "out";
  busy: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const onHand = Number(item.stock ?? 0);
  const incoming = direction === "in";
  const next = incoming ? onHand + quantity : Math.max(onHand - quantity, 0);
  const invalid = !Number.isFinite(quantity) || quantity < 1;

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            {incoming ? "Check in stock" : "Check out stock"}
          </h3>
          <p className="mt-0.5 max-w-[15rem] truncate text-sm text-slate-500 dark:text-zinc-400">
            {item.name}
          </p>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          <X size={17} />
        </button>
      </div>

      <div className="neu-inset mt-4 flex items-center justify-between rounded-xl px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          On hand
        </span>
        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
          {onHand} {item.unit}
          {onHand === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setQuantity((q) => Math.max(q - 1, 1))}
          className="neu-btn grid h-10 w-10 place-items-center rounded-lg"
          title="One less"
        >
          <Minus size={15} />
        </button>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.floor(Number(e.target.value)))}
          className="neu-inset flex-1 rounded-lg px-3 py-2.5 text-center text-lg font-semibold text-slate-800 dark:text-zinc-100"
        />
        <button
          onClick={() => setQuantity((q) => q + 1)}
          className="neu-btn grid h-10 w-10 place-items-center rounded-lg"
          title="One more"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-500/10">
        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
          New balance
        </span>
        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-200">
          {invalid ? "—" : `${next} ${item.unit}${next === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(quantity)}
          disabled={busy || invalid}
          className={`neu-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
            incoming ? "neu-btn-success" : "neu-btn-danger"
          }`}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : incoming ? <Plus size={15} /> : <Minus size={15} />}
          {incoming ? "Check in" : "Check out"}
        </button>
      </div>
    </Modal>
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
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}
