"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, PackageOpen, PackagePlus, Search, ShoppingCart } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useStoreCart } from "@/components/store/cart-context";
import { useStoreNav } from "@/components/store/store-nav";
import {
  StoreCategoryIcon,
  StoreChip,
  StoreEmpty,
  StoreShell,
  StoreSkeleton,
  StockBadge,
} from "@/components/store/store-shell";

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

const SORTS = [
  { value: "name", label: "Name A–Z" },
  { value: "price", label: "Price low → high" },
  { value: "stock", label: "Most in stock" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

export function StoreCatalog() {
  const nav = useStoreNav();
  const { add, count } = useStoreCart();
  const [items, setItems] = useState<StoreItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("name");
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

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "price") copy.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
    if (sort === "stock") copy.sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0));
    return copy;
  }, [items, sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, StoreItemDto[]>();
    for (const item of sorted) {
      const key = item.category || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [sorted]);

  function handleAdd(item: StoreItemDto) {
    add(
      {
        itemId: item.id,
        name: item.name,
        productNumber: item.productNumber,
        unit: item.unit,
        price: Number(item.price ?? 0),
        stock: Number(item.stock ?? 0),
        category: item.category,
      },
      1,
    );
    setJustAdded(item.id);
    setTimeout(() => setJustAdded(""), 1200);
  }

  return (
    <StoreShell
      view="catalog"
      title="Company Store"
      subtitle={region ? `${region} stock` : "Company-wide stock"}
      actions={
        <button
          onClick={() => nav("cart")}
          className="neu-btn inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
        >
          <ShoppingCart size={15} />
          Cart
          {count ? (
            <span className="rounded-full bg-indigo-100 px-1.5 text-[11px] font-bold leading-4 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              {count}
            </span>
          ) : null}
        </button>
      }
    >
      {/* Search, sort and category filters */}
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="neu-inset flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, product number or batch…"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-zinc-100"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
            aria-label="Sort products"
            className="neu-inset shrink-0 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-zinc-200"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort · {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <StoreChip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </StoreChip>
          {categories.map((c) => (
            <StoreChip
              key={c.value}
              active={category === c.value}
              onClick={() => setCategory(c.value)}
              count={grouped
                .filter(([key]) => key === c.value)
                .reduce((sum, [, group]) => sum + group.length, 0)}
            >
              {c.label}
            </StoreChip>
          ))}
        </div>
      </div>

      {loading ? (
        <StoreSkeleton rows={6} grid />
      ) : items.length === 0 ? (
        <StoreEmpty
          icon={PackageOpen}
          title="Nothing stocked here yet"
          message={
            search
              ? `No products match “${search}”. Try a different name, product number or batch.`
              : "No products are stocked in your region yet — check back later."
          }
        />
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
    </StoreShell>
  );
}

function ItemCard({ item, added, onAdd }: { item: StoreItemDto; added: boolean; onAdd: () => void }) {
  const stock = Number(item.stock ?? 0);
  const price = Number(item.price ?? 0);
  const out = stock <= 0;
  return (
    <article className="neu-card neu-card-hover flex flex-col rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <StoreCategoryIcon category={item.category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug text-slate-800 dark:text-zinc-100">
              {item.name}
            </h3>
            <StockBadge stock={stock} unit={item.unit} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-zinc-500">
            {item.productNumber}
            {item.batchNumber ? ` · Batch ${item.batchNumber}` : ""}
          </p>
        </div>
      </div>
      {item.description ? (
        <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">{item.description}</p>
      ) : (
        <div className="mt-2 flex-1" />
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
          {price > 0 ? `₹${price.toFixed(2)}` : "No price"}
          <span className="ml-1 text-[11px] font-normal text-slate-400 dark:text-zinc-500">
            / {item.unit}
          </span>
        </span>
        <button
          onClick={onAdd}
          disabled={out}
          title={out ? "This product is out of stock" : `Add ${item.name} to cart`}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 ${
            out
              ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
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
