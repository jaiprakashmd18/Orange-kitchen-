import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, istDateTime, nowInIST } from "@/lib/format";

export interface SalesSummary {
  orders_count: number;
  revenue: number;
  avg_order_value: number;
  delivery_orders: number;
  delivery_revenue: number;
  takeaway_orders: number;
  takeaway_revenue: number;
  cancelled_orders: number;
  completed_orders: number;
  pending_orders: number;
}

const numify = <T extends object>(row: T) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v])) as T;

export async function salesSummary(from: Date, to: Date) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_sales_summary", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw error;
  return numify((data?.[0] ?? {}) as SalesSummary);
}

export async function salesByPeriod(from: Date, to: Date, bucket: "day" | "week" | "month") {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_sales_by_period", { p_from: from.toISOString(), p_to: to.toISOString(), p_bucket: bucket });
  if (error) throw error;
  return ((data ?? []) as { bucket: string; orders_count: number; revenue: number; delivery_revenue: number; takeaway_revenue: number }[]).map(numify);
}

export async function topItems(from: Date, to: Date, limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_top_items", { p_from: from.toISOString(), p_to: to.toISOString(), p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as { menu_item_id: string; item_name: string; quantity: number; revenue: number }[]).map(numify);
}

/** IST day boundaries */
export function istRange(fromDate: string, toDateInclusive: string) {
  return { from: istDateTime(fromDate, "00:00:00"), to: istDateTime(addDays(toDateInclusive, 1), "00:00:00") };
}

export function presetRanges() {
  const today = nowInIST().date;
  const monthStart = today.slice(0, 8) + "01";
  return {
    today: istRange(today, today),
    month: istRange(monthStart, today),
    last30: istRange(addDays(today, -29), today),
    allTime: { from: new Date("2020-01-01T00:00:00Z"), to: istDateTime(addDays(today, 1), "00:00:00") },
    todayStr: today,
    monthStartStr: monthStart,
  };
}
