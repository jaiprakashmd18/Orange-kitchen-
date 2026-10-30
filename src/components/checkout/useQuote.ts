"use client";

import { useEffect, useState } from "react";
import type { CartLine } from "@/components/cart/CartProvider";
import type { Quote } from "@/lib/pricing";

export interface QuoteResponse {
  quote: Quote;
  delivery_pending: boolean;
  blockers: string[];
  area: { name: string; estimated_minutes: number } | null;
  tax_label: string;
  prices_include_tax: boolean;
}

/** Fetches the authoritative server quote whenever inputs change (debounced). */
export function useQuote(input: {
  lines: CartLine[];
  fulfillment: "delivery" | "takeaway";
  address_id?: string | null;
  pickup_slot_id?: string | null;
  pickup_date?: string | null;
  coupon_code?: string | null;
  enabled?: boolean;
}) {
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify({
    items: input.lines.map((l) => [l.menu_item_id, l.quantity, l.selected_options]),
    f: input.fulfillment,
    a: input.address_id,
    s: input.pickup_slot_id,
    d: input.pickup_date,
    c: input.coupon_code,
  });

  useEffect(() => {
    if (input.enabled === false || input.lines.length === 0) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            items: input.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity, selected_options: l.selected_options })),
            fulfillment: input.fulfillment,
            address_id: input.address_id || undefined,
            pickup_slot_id: input.pickup_slot_id || undefined,
            pickup_date: input.pickup_date || undefined,
            coupon_code: input.coupon_code || undefined,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "Could not calculate your total.");
          setData(null);
        } else {
          setError(null);
          setData(body);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Network error while calculating your total.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, input.enabled]);

  return { data, error, loading };
}
