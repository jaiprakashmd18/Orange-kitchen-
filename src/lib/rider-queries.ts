import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

/** Orders currently assigned to the signed-in rider (RLS restricts visibility). */
export async function myAssignments(userId: string, mode: "active" | "history") {
  const supabase = await createClient();
  const { data: me } = await supabase.from("delivery_personnel").select("id").eq("user_id", userId).maybeSingle();
  if (!me) return [];
  let q = supabase
    .from("delivery_assignments")
    .select("id, status, assigned_at, delivered_at, is_current, orders!inner(*)")
    .eq("personnel_id", me.id)
    .order("assigned_at", { ascending: false })
    .limit(mode === "active" ? 50 : 100);
  q = mode === "active" ? q.eq("is_current", true).in("orders.status", ["accepted", "preparing", "ready", "delivery_assigned", "picked_up", "out_for_delivery"]) : q.in("orders.status", ["delivered", "cancelled", "rejected"]);
  const { data } = await q;
  return (data ?? []) as unknown as { id: string; status: string; assigned_at: string; delivered_at: string | null; is_current: boolean; orders: Order }[];
}
