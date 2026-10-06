"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
  itemId: string;
  name: string;
  productNumber: string;
  unit: string;
  price: number;
  stock: number;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "flowzen.store.cart.v1";

const CartContext = createContext<CartContextValue | null>(null);

function readStored(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line: any) => line && typeof line.itemId === "string" && Number(line.quantity) > 0,
    );
  } catch {
    return [];
  }
}

export function StoreCartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage unavailable (private mode) — the cart simply won't persist.
    }
  }, [lines, ready]);

  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === line.itemId);
      if (existing) {
        return prev.map((l) =>
          l.itemId === line.itemId
            ? { ...l, quantity: Math.min(l.quantity + quantity, Math.max(l.stock, 1)) }
            : l,
        );
      }
      return [...prev, { ...line, quantity: Math.min(quantity, Math.max(line.stock, 1)) }];
    });
  }, []);

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, quantity: Math.max(0, quantity) } : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const remove = useCallback((itemId: string) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useStoreCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useStoreCart must be used inside StoreCartProvider");
  return ctx;
}
