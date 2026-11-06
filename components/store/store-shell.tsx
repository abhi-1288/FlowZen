"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  BookOpen,
  Boxes,
  CheckSquare,
  ClipboardList,
  Cpu,
  Files,
  Headphones,
  Paperclip,
  Pencil,
  Package,
  ScrollText,
  ShoppingCart,
  Store as StoreIcon,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useStoreCart } from "@/components/store/cart-context";
import { categoryLabel } from "@/lib/store-constants";
import type { StoreView } from "@/components/store/store-nav";

/**
 * Shared chrome for every store sub-view. One header, one accent, one way to
 * move between store sections — replacing the six bespoke headers that each
 * used to pick their own colour and their own (missing) navigation.
 *
 * The live state (current view, warehouse permission, approval badges) is
 * provided by the profile hub, which owns the store's routing state.
 */
type StoreChromeValue = {
  view: StoreView;
  setView: (view: StoreView) => void;
  canManage: boolean;
  approvalsCount: number;
  deliveryCount: number;
};

export const StoreChromeContext = createContext<StoreChromeValue | null>(null);

export function useStoreChrome(): StoreChromeValue {
  return (
    useContext(StoreChromeContext) ?? {
      view: "catalog",
      setView: () => {},
      canManage: false,
      approvalsCount: 0,
      deliveryCount: 0,
    }
  );
}

type NavItem = {
  view: StoreView;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

function useStoreNavItems(): NavItem[] {
  const { canManage, approvalsCount, deliveryCount } = useStoreChrome();
  const { count: cartCount } = useStoreCart();
  const base: NavItem[] = [
    { view: "catalog", label: "Browse", icon: StoreIcon },
    { view: "cart", label: "Cart", icon: ShoppingCart, badge: cartCount },
    { view: "orders", label: "My Orders", icon: Package },
    { view: "approvals", label: "Approvals", icon: CheckSquare, badge: approvalsCount },
  ];
  const warehouseOnly: NavItem[] = [
    { view: "manage", label: "Inventory", icon: Boxes },
    { view: "delivery", label: "Delivery", icon: Truck, badge: deliveryCount },
  ];
  return canManage ? [...base, ...warehouseOnly] : base;
}

const VIEW_ICONS: Record<StoreView, LucideIcon> = {
  catalog: StoreIcon,
  cart: ShoppingCart,
  orders: Package,
  approvals: CheckSquare,
  manage: Boxes,
  delivery: Truck,
};

export function StoreShell({
  view,
  title,
  subtitle,
  actions,
  children,
}: {
  /** The sub-view rendering this shell — highlights its pill in the nav. */
  view: StoreView;
  title: string;
  subtitle?: ReactNode;
  /** Contextual actions on the right of the header (refresh, cart, add…). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { setView } = useStoreChrome();
  const items = useStoreNavItems();
  const HeaderIcon = VIEW_ICONS[view] ?? Package;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 md:px-8">
      <header className="neu-card mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl py-4 pl-4 pr-4 md:pl-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <HeaderIcon size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-100">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-zinc-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      <nav
        aria-label="Store sections"
        className="neu-card mb-4 flex gap-1 overflow-x-auto rounded-2xl p-1.5"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.view === view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              <Icon size={15} />
              {item.label}
              {item.badge ? (
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-bold leading-4 ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

/* ── Shared small parts ──────────────────────────────────────────────────── */

export function StoreChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Optional live count rendered as a small badge inside the chip. */
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
      {count !== undefined && count > 0 ? (
        <span
          className={`rounded-full px-1.5 text-[10px] font-bold leading-4 ${
            active
              ? "bg-white/20 text-white"
              : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function StoreAlert({
  tone = "rose",
  children,
}: {
  tone?: "rose" | "amber" | "sky";
  children: ReactNode;
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  } as const;
  return (
    <p className={`mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function StoreEmpty({
  icon: Icon,
  title,
  message,
  children,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  /** Optional CTA rendered under the message ("Browse products" etc.). */
  children?: ReactNode;
}) {
  return (
    <div className="neu-card grid place-items-center gap-2.5 rounded-2xl px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{title}</p>
      {message ? (
        <p className="max-w-sm text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          {message}
        </p>
      ) : null}
      {children ? <div className="mt-1.5">{children}</div> : null}
    </div>
  );
}

/**
 * Loading placeholder that mirrors the usual list/grid layout so a refresh
 * doesn't jump the page height around.
 */
export function StoreSkeleton({ rows = 3, grid = false }: { rows?: number; grid?: boolean }) {
  const blocks = Array.from({ length: rows });
  if (grid) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((_, i) => (
          <div key={i} className="neu-card h-36 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {blocks.map((_, i) => (
        <div key={i} className="neu-card h-24 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}

/* ── Category iconography (no image assets exist for products) ───────────── */

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; tile: string }> = {
  stationery: { icon: Pencil, tile: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" },
  paper: { icon: Files, tile: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" },
  books: { icon: BookOpen, tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
  letterhead: { icon: ScrollText, tile: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" },
  electronics: { icon: Cpu, tile: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
  accessories: { icon: Headphones, tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  "office-supplies": { icon: Paperclip, tile: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300" },
  other: { icon: ClipboardList, tile: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

export function StoreCategoryIcon({ category, size = 17 }: { category: string; size?: number }) {
  const entry = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
  const Icon = entry.icon;
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-lg ${entry.tile}`}
      style={{ width: size + 13, height: size + 13 }}
      title={categoryLabel(category)}
    >
      <Icon size={size} />
    </span>
  );
}

/** Soft stock pill with the same green/amber/red language everywhere. */
export function StockBadge({ stock, unit }: { stock: number; unit?: string }) {
  const value = Number(stock ?? 0);
  const out = value <= 0;
  const low = !out && value <= 5;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        out
          ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
          : low
            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          out ? "bg-rose-500" : low ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />
      {out ? "Out of stock" : `${value}${unit ? ` ${unit}` : ""}`}
    </span>
  );
}
