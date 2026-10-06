"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, PackagePlus, Search, ShoppingCart, Store as StoreIcon, MapPin, Check } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useStoreCart } from "@/components/store/cart-context";
import { useStoreNav } from "@/components/store/store-nav";

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

export function StoreCatalog() {
  const nav = useStoreNav();
  const { add, count } = useStoreCart();
  const [items, setItems] = useState<StoreItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [justAdded, setJustAdded] = useState("");

  useEffect(() => {
    apiFetch<{ categories: CategoryDto[] }>("/api/store/categories", undefined, { toast: false })
      .then((res) => setCategories(res.categories ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const query = new URLSearchParams();
    if (category !== "all") query.set("category", category);
    if (search.trim()) query.set("search", search.trim());
    apiFetch<{ items: StoreItemDto[]; region: string }>(
      `/api/store/items?${query.toString()}`,
      undefined,
      { toast: false },
    )
      .then((res) => {
        if (!alive) return;
        setItems(res.items ?? []);
        setRegion(res.region ?? "");
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, StoreItemDto[]>();
    for (const item of items) {
      const key = item.category || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  function handleAdd(item: StoreItemDto) {
    add(
      {
        itemId: item.id,
        name: item.name,
        productNumber: item.productNumber,
        unit: item.unit,
        price: Number(item.price ?? 0),
        stock: Number(item.stock ?? 0),
      },
      1,
    );
    setJustAdded(item.id);
    setTimeout(() => setJustAdded(""), 1200);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <header className="neu-card mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-indigo-600 text-white">
            <StoreIcon size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Company Store</h1>
            <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400">
              <MapPin size={13} />
              {region ? `${region} stock` : "Company-wide stock"}
            </p>
          </div>
        </div>
        <button
          onClick={() => nav("cart")}
          className="neu-btn neu-btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
        >
          <ShoppingCart size={16} />
          Cart{count ? ` (${count})` : ""}
        </button>
      </header>

      <div className="mb-5 flex flex-col gap-3">
        <div className="neu-inset flex items-center gap-2 rounded-xl px-3 py-2.5">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, product number or batch…"
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-zinc-100"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip active={category === "all"} label="All" onClick={() => setCategory("all")} />
          {categories.map((c) => (
            <CategoryChip
              key={c.value}
              active={category === c.value}
              label={c.label}
              onClick={() => setCategory(c.value)}
            />
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : items.length === 0 ? (
        <div className="neu-card rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-zinc-400">
          No products are stocked in your region yet.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([key, group]) => (
            <section key={key}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                {categories.find((c) => c.value === key)?.label ?? key}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    added={justAdded === item.id}
                    onAdd={() => handleAdd(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

function ItemCard({ item, added, onAdd }: { item: StoreItemDto; added: boolean; onAdd: () => void }) {
  const stock = Number(item.stock ?? 0);
  const price = Number(item.price ?? 0);
  const out = stock <= 0;
  return (
    <article className="neu-card flex flex-col rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{item.name}</h3>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
            out
              ? "bg-rose-50 text-rose-600"
              : stock <= 5
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {out ? "Out of stock" : `${stock} ${item.unit}`}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-zinc-500">
        {item.productNumber}
        {item.batchNumber ? ` · Batch ${item.batchNumber}` : ""}
      </p>
      {item.description ? (
        <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">{item.description}</p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
          {price > 0 ? `₹${price.toFixed(2)} / ${item.unit}` : "No price set"}
        </span>
        <button
          onClick={onAdd}
          disabled={out}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            out
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : added
                ? "bg-emerald-600 text-white"
                : "neu-btn neu-btn-primary"
          }`}
        >
          {added ? <Check size={14} /> : <PackagePlus size={14} />}
          {added ? "Added" : "Add"}
        </button>
      </div>
    </article>
  );
}
