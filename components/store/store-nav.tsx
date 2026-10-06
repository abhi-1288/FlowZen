import { createContext, useContext } from "react";

export type StoreView = "catalog" | "cart" | "orders" | "approvals" | "manage";

export const STORE_VIEWS: StoreView[] = ["catalog", "cart", "orders", "approvals", "manage"];

export function isStoreView(value: string): value is StoreView {
  return (STORE_VIEWS as string[]).includes(value);
}

export function storePath(view: StoreView) {
  return view === "catalog" ? "/profile/store" : `/profile/store/${view}`;
}

/**
 * In-hub navigation for the store sub-views. The profile hub swaps tabs with
 * `history.pushState` instead of a real router navigation so the shell never
 * remounts — store pages need the same mechanism, hence this context.
 */
export const StoreNavContext = createContext<(view: StoreView) => void>(() => {});

export function useStoreNav() {
  return useContext(StoreNavContext);
}
