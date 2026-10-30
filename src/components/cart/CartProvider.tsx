"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SelectedOptions } from "@/lib/types";

// Client cart. Guests: persisted in localStorage. Signed-in customers: also
// synchronised to the server cart (carts / cart_items) so it follows them
// across devices. Prices shown here are previews only — the server
// recalculates everything from the database at checkout.

export interface CartLine {
  key: string;
  menu_item_id: string;
  name: string;
  image_url: string | null;
  is_veg: boolean;
  unit_price: number;
  quantity: number;
  max_per_order: number;
  selected_options: SelectedOptions;
  options_summary: string;
}

interface CartState {
  lines: CartLine[];
  special_instructions: string;
  coupon_code: string;
}

interface CartContextValue extends CartState {
  ready: boolean;
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "key" | "quantity">, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setInstructions: (v: string) => void;
  setCoupon: (v: string) => void;
  lastAdded: { name: string; at: number } | null;
}

const STORAGE_KEY = "ok-cart-v1";
const EMPTY: CartState = { lines: [], special_instructions: "", coupon_code: "" };
const CartContext = createContext<CartContextValue | null>(null);

export function lineKey(menuItemId: string, selected: SelectedOptions) {
  const opts = Object.keys(selected)
    .sort()
    .map((g) => `${g}:${[...selected[g]].sort().join(",")}`)
    .join("|");
  return `${menuItemId}#${opts}`;
}

function mergeLines(a: CartLine[], b: CartLine[]) {
  const map = new Map<string, CartLine>();
  for (const l of [...a, ...b]) {
    const existing = map.get(l.key);
    map.set(l.key, existing ? { ...l, quantity: Math.min(Math.max(existing.quantity, l.quantity), l.max_per_order) } : l);
  }
  return [...map.values()];
}

export function CartProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [lastAdded, setLastAdded] = useState<CartContextValue["lastAdded"]>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSync = useRef(true);

  // Load local cart, then merge with server cart for signed-in users.
  useEffect(() => {
    let local: CartState = EMPTY;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) local = { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      /* storage unavailable */
    }
    if (!userId) {
      setState(local);
      setReady(true);
      return;
    }
    fetch("/api/cart", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((server: CartState | null) => {
        const merged: CartState = server
          ? {
              lines: mergeLines(server.lines, local.lines),
              special_instructions: local.special_instructions || server.special_instructions || "",
              coupon_code: local.coupon_code || server.coupon_code || "",
            }
          : local;
        skipNextSync.current = !(server && local.lines.length > 0);
        setState(merged);
      })
      .catch(() => setState(local))
      .finally(() => setReady(true));
  }, [userId]);

  // Persist locally + debounce server sync.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    if (!userId) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: state.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity, selected_options: l.selected_options })),
          special_instructions: state.special_instructions || null,
          coupon_code: state.coupon_code || null,
        }),
      }).catch(() => undefined);
    }, 600);
  }, [state, ready, userId]);

  const add = useCallback<CartContextValue["add"]>((line, quantity = 1) => {
    const key = lineKey(line.menu_item_id, line.selected_options);
    setState((s) => {
      const existing = s.lines.find((l) => l.key === key);
      const lines = existing
        ? s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(l.quantity + quantity, l.max_per_order) } : l))
        : [...s.lines, { ...line, key, quantity: Math.min(quantity, line.max_per_order) }];
      return { ...s, lines };
    });
    setLastAdded({ name: line.name, at: Date.now() });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setState((s) => ({
      ...s,
      lines:
        quantity <= 0
          ? s.lines.filter((l) => l.key !== key)
          : s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(quantity, l.max_per_order) } : l)),
    }));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      ready,
      count: state.lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: Math.round(state.lines.reduce((n, l) => n + l.unit_price * 100 * l.quantity, 0)) / 100,
      add,
      setQuantity,
      remove: (key) => setQuantity(key, 0),
      clear: () => setState(EMPTY),
      setInstructions: (v) => setState((s) => ({ ...s, special_instructions: v.slice(0, 500) })),
      setCoupon: (v) => setState((s) => ({ ...s, coupon_code: v.trim().toUpperCase().slice(0, 30) })),
      lastAdded,
    }),
    [state, ready, add, setQuantity, lastAdded],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
