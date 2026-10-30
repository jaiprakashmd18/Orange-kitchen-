import { NextResponse, type NextRequest } from "next/server";
import { assertRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { handleRouteError } from "@/lib/http";
import { istRange } from "@/lib/reports";
import { formatDateTime, nowInIST } from "@/lib/format";
import { audit } from "@/lib/audit";

function csv(rows: (string | number | null | undefined)[][]) {
  // Quote every field and neutralise spreadsheet formula injection.
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const { user } = await assertRole(sp.get("type") === "menu" ? ["admin", "staff"] : ["admin"]);
    const today = nowInIST().date;
    const d = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today);
    const from = d(sp.get("from"));
    const to = d(sp.get("to"));
    const type = sp.get("type") ?? "orders";
    const range = istRange(from, to);
    const supabase = await createClient();
    let rows: (string | number | null)[][] = [];

    if (type === "orders") {
      const { data, error } = await supabase
        .from("orders")
        .select("order_number, created_at, status, fulfillment, customer_name, customer_phone, subtotal, discount_amount, coupon_code, packaging_charge, delivery_fee, tax_amount, total_amount, payments(status, method, provider_payment_id)")
        .gte("created_at", range.from.toISOString())
        .lt("created_at", range.to.toISOString())
        .order("created_at")
        .limit(10000);
      if (error) throw error;
      rows = [["Order", "Date (IST)", "Status", "Type", "Customer", "Phone", "Subtotal", "Discount", "Coupon", "Packaging", "Delivery fee", "Tax", "Total", "Payment status", "Method", "Payment ID"]];
      for (const o of data ?? []) {
        const p = (o.payments as { status: string; method: string | null; provider_payment_id: string | null }[])?.[0];
        rows.push([o.order_number, formatDateTime(o.created_at), o.status, o.fulfillment, o.customer_name, o.customer_phone, o.subtotal, o.discount_amount, o.coupon_code, o.packaging_charge, o.delivery_fee, o.tax_amount, o.total_amount, p?.status ?? "", p?.method ?? "", p?.provider_payment_id ?? ""]);
      }
    } else if (type === "payments") {
      const { data, error } = await supabase
        .from("payments")
        .select("created_at, captured_at, status, method, amount, refunded_amount, provider_order_id, provider_payment_id, refund_id, orders(order_number)")
        .gte("created_at", range.from.toISOString())
        .lt("created_at", range.to.toISOString())
        .order("created_at")
        .limit(10000);
      if (error) throw error;
      rows = [["Created (IST)", "Captured (IST)", "Order", "Status", "Method", "Amount", "Refunded", "Razorpay order", "Razorpay payment", "Refund ID"]];
      for (const p of data ?? []) {
        rows.push([formatDateTime(p.created_at), p.captured_at ? formatDateTime(p.captured_at) : "", (p.orders as unknown as { order_number: string })?.order_number ?? "", p.status, p.method, p.amount, p.refunded_amount, p.provider_order_id, p.provider_payment_id, p.refund_id]);
      }
    } else if (type === "items") {
      const { data, error } = await supabase.rpc("report_top_items", { p_from: range.from.toISOString(), p_to: range.to.toISOString(), p_limit: 100 });
      if (error) throw error;
      rows = [["Dish", "Quantity", "Revenue"]];
      for (const r of (data ?? []) as { item_name: string; quantity: number; revenue: number }[]) rows.push([r.item_name, r.quantity, r.revenue]);
    } else if (type === "menu") {
      const [{ data: cats }, { data: items, error }] = await Promise.all([
        supabase.from("menu_categories").select("id, name, parent_id"),
        supabase.from("menu_items").select("name, price, is_veg, description, image_url, is_published, is_available, is_popular, category_id, sort_order").order("sort_order"),
      ]);
      if (error) throw error;
      const byId = new Map((cats ?? []).map((c) => [c.id, c]));
      const yn = (b: boolean | null) => (b === null ? "" : b ? "yes" : "no");
      rows = [["category", "subcategory", "name", "price", "veg", "description", "image_url", "published", "available", "popular"]];
      for (const i of items ?? []) {
        const c = byId.get(i.category_id);
        const parent = c?.parent_id ? byId.get(c.parent_id) : null;
        rows.push([parent ? parent.name : c?.name ?? "", parent ? c?.name ?? "" : "", i.name, i.price, i.is_veg === null ? "" : i.is_veg ? "veg" : "non-veg", i.description, i.image_url, yn(i.is_published), yn(i.is_available), yn(i.is_popular)]);
      }
    } else {
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
    }

    await audit({ actorId: user.id, action: "report.exported", entity: "report", entityId: type, details: { from, to, rows: rows.length - 1 } });
    return new NextResponse(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": type === "menu" ? `attachment; filename="orange-kitchen-menu.csv"` : `attachment; filename="orange-kitchen-${type}-${from}-to-${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleRouteError(err, "reports:export");
  }
}
