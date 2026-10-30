import Link from "next/link";
import { PageHeader, StatCard } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";
import { presetRanges, salesSummary, topItems } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { integrationStatus } from "@/lib/env";
import { formatDateTime, formatINR } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";
import { getRoles } from "@/lib/auth";
import type { Order } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const r = presetRanges();
  const supabase = await createClient();
  const [today, month, all, best, recent, setup, roles] = await Promise.all([
    salesSummary(r.today.from, r.today.to),
    salesSummary(r.month.from, r.month.to),
    salesSummary(r.allTime.from, r.allTime.to),
    topItems(r.last30.from, r.last30.to, 5),
    supabase.from("orders").select("id, order_number, status, fulfillment, total_amount, customer_name, created_at").neq("status", "expired").order("created_at", { ascending: false }).limit(10),
    Promise.all([
      supabase.from("operating_hours").select("id", { count: "exact", head: true }),
      supabase.from("serviceable_areas").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("pickup_slots").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("is_published", true),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("is_published", false),
      supabase.from("restaurant_settings").select("accepting_orders, logo_url, whatsapp, email").eq("id", 1).single(),
    ]),
    getRoles(),
  ]);
  const [hours, areas, slots, published, drafts, settings] = setup;
  const integ = integrationStatus();
  const checklist = [
    { ok: integ.supabase, label: "Supabase service key configured" },
    { ok: integ.razorpay, label: `Razorpay keys configured (${integ.razorpayMode} mode)` },
    { ok: integ.razorpayWebhook, label: "Razorpay webhook secret configured" },
    { ok: (published.count ?? 0) > 0, label: `Menu published (${published.count ?? 0} dishes live, ${drafts.count ?? 0} drafts need prices)`, href: "/admin/menu" },
    { ok: Boolean(settings.data?.logo_url), label: "Logo uploaded", href: "/admin/settings" },
    { ok: (hours.count ?? 0) > 0, label: "Opening hours set", href: "/admin/hours" },
    { ok: (areas.count ?? 0) > 0, label: "Delivery areas & fees set", href: "/admin/delivery-areas" },
    { ok: (slots.count ?? 0) > 0, label: "Pickup slots set", href: "/admin/pickup-slots" },
    { ok: Boolean(settings.data?.email && settings.data?.whatsapp), label: "Email & WhatsApp contact added", href: "/admin/settings" },
    { ok: integ.email, label: "Email notifications (Resend) configured" },
    { ok: integ.whatsapp, label: "WhatsApp notifications configured (optional)" },
    { ok: integ.cron, label: "Cron secret configured (expires unpaid orders)" },
    { ok: Boolean(settings.data?.accepting_orders), label: "Accepting online orders", href: "/admin/settings" },
  ];
  const pendingSetup = checklist.filter((c) => !c.ok);
  const totalFulfilled = month.delivery_orders + month.takeaway_orders || 1;

  return (
    <div className="space-y-8">
      <RealtimeRefresher tables="orders" />
      <PageHeader title="Dashboard" description="Live overview of Orange Kitchen orders and sales (IST)." actions={<Link href="/admin/orders?status=payment_confirmed" className="btn-primary">New orders</Link>} />

      {pendingSetup.length > 0 && roles.includes("admin") && (
        <section className="card border-amber-200 bg-amber-50/60 p-5">
          <h2 className="font-sans font-bold">Launch checklist ({checklist.length - pendingSetup.length}/{checklist.length} done)</h2>
          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label} className={c.ok ? "text-leaf" : "text-amber-900"}>
                {c.ok ? "✓" : "○"} {c.href && !c.ok ? <Link href={c.href} className="underline">{c.label}</Link> : c.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's orders" value={today.orders_count} hint={`${today.pending_orders} in progress`} />
        <StatCard label="Today's revenue" value={formatINR(today.revenue)} />
        <StatCard label="Monthly revenue" value={formatINR(month.revenue)} hint={`${month.orders_count} paid orders`} />
        <StatCard label="Avg order value (month)" value={formatINR(month.avg_order_value)} />
        <StatCard label="Total orders" value={all.orders_count} />
        <StatCard label="Pending orders" value={all.pending_orders} />
        <StatCard label="Completed orders" value={all.completed_orders} />
        <StatCard label="Cancelled / rejected" value={all.cancelled_orders} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-charcoal/5 p-5">
            <h2 className="font-sans font-bold">Recent orders</h2>
            <Link href="/admin/orders" className="link text-sm">All orders</Link>
          </div>
          {(recent.data ?? []).length === 0 ? (
            <p className="p-5 text-sm text-charcoal-500">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <tbody>
                  {((recent.data ?? []) as Order[]).map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/${o.id}`} className="font-semibold hover:text-brand-700">#{o.order_number}</Link><span className="block text-xs text-charcoal-500">{o.customer_name}</span></td>
                      <td><Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                      <td className="text-xs text-charcoal-500">{o.fulfillment === "delivery" ? "Delivery" : "Takeaway"}<br />{formatDateTime(o.created_at)}</td>
                      <td className="text-right font-semibold">{formatINR(o.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-sans font-bold">Delivery vs takeaway (this month)</h2>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-charcoal/5" aria-hidden>
              <div className="bg-brand-500" style={{ width: `${(month.delivery_orders / totalFulfilled) * 100}%` }} />
              <div className="bg-charcoal-500" style={{ width: `${(month.takeaway_orders / totalFulfilled) * 100}%` }} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" />Delivery</dt><dd className="font-semibold">{month.delivery_orders} · {formatINR(month.delivery_revenue)}</dd></div>
              <div><dt className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-charcoal-500" />Takeaway</dt><dd className="font-semibold">{month.takeaway_orders} · {formatINR(month.takeaway_revenue)}</dd></div>
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="font-sans font-bold">Best-selling dishes (30 days)</h2>
            {best.length === 0 ? (
              <p className="mt-3 text-sm text-charcoal-500">No sales yet.</p>
            ) : (
              <ol className="mt-3 space-y-2 text-sm">
                {best.map((b, i) => (
                  <li key={b.menu_item_id ?? i} className="flex justify-between gap-3">
                    <span><span className="mr-2 text-charcoal-400">{i + 1}.</span>{b.item_name}</span>
                    <span className="font-semibold tabular-nums">{b.quantity} sold</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
