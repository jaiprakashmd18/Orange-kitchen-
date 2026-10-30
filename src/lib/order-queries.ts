import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryAssignment, Order, OrderItemRow, Payment, StatusHistory } from "@/lib/types";

/** Loads an order with RLS applied (customer, assigned rider or staff only). */
export async function getOrderDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) return null;
  const [items, history, payments, assignment, review] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
    supabase.from("payments").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase
      .from("delivery_assignments")
      .select("*, delivery_personnel(full_name, phone), delivery_providers(name, contact_phone)")
      .eq("order_id", id)
      .eq("is_current", true)
      .maybeSingle(),
    supabase.from("reviews").select("id, rating").eq("order_id", id).maybeSingle(),
  ]);
  return {
    order: order as Order,
    items: (items.data ?? []) as OrderItemRow[],
    history: (history.data ?? []) as StatusHistory[],
    payment: ((payments.data ?? [])[0] ?? null) as Payment | null,
    assignment: assignment.data as
      | (DeliveryAssignment & {
          delivery_personnel: { full_name: string; phone: string } | null;
          delivery_providers: { name: string; contact_phone: string | null } | null;
        })
      | null,
    review: review.data as { id: string; rating: number } | null,
  };
}
