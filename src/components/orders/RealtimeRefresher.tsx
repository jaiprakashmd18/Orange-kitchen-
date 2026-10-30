"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase Realtime changes for one order (or all visible
 * orders when no id is given) and refreshes server data. RLS decides which
 * rows each subscriber receives.
 */
export function RealtimeRefresher({ orderId, tables = "orders,order_status_history,delivery_assignments" }: { orderId?: string; tables?: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase.channel(`rt-${orderId ?? "all"}-${Math.random().toString(36).slice(2)}`);
    for (const table of tables.split(",")) {
      const filter = orderId ? (table === "orders" ? `id=eq.${orderId}` : `order_id=eq.${orderId}`) : undefined;
      channel.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, refresh);
    }
    channel.subscribe();
    // Fallback refresh when returning to the tab (mobile browsers pause sockets)
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [orderId, router, tables]);
  return null;
}
