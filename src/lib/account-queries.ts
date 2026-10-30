import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import type { Order } from "@/lib/types";

export type OrderListItem = Pick<Order, "id" | "order_number" | "status" | "fulfillment" | "total_amount" | "created_at"> & { summary: string };

export async function listMyOrders(userId: string, opts: { active?: boolean; limit?: number } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id, order_number, status, fulfillment, total_amount, created_at, order_items(item_name, quantity)")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.active === true) q = q.in("status", [...ACTIVE_STATUSES, "pending_payment", "payment_failed"]);
  if (opts.active === false) q = q.not("status", "in", `(${[...ACTIVE_STATUSES, "pending_payment", "payment_failed"].join(",")})`);
  const { data } = await q;
  return (data ?? []).map((o) => ({
    ...(o as unknown as OrderListItem),
    summary: ((o.order_items ?? []) as { item_name: string; quantity: number }[]).map((i) => `${i.item_name} × ${i.quantity}`).join(", "),
  }));
}
