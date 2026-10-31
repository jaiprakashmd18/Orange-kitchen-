import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatINR, istDateTime, addDays } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";
import type { Order, OrderStatus } from "@/lib/types";

export const metadata = { title: "Orders" };

const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];
const PAGE = 50;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page) || 1);

  let q = supabase
    .from("orders")
    .select(`id, order_number, status, fulfillment, total_amount, customer_name, customer_phone, created_at, pickup_date, pickup_time, ${sp.payment ? "payments!inner(status)" : "payments(status)"}`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.status === "active") q = q.in("status", ["payment_confirmed", "accepted", "preparing", "ready", "delivery_assigned", "picked_up", "out_for_delivery"]);
  else if (sp.status && STATUSES.includes(sp.status as OrderStatus)) q = q.eq("status", sp.status);
  else if (!sp.status) q = q.neq("status", "expired");
  if (sp.fulfillment === "delivery" || sp.fulfillment === "takeaway") q = q.eq("fulfillment", sp.fulfillment);
  if (sp.payment && /^[a-z_]+$/.test(sp.payment)) q = q.eq("payments.status", sp.payment);
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) q = q.gte("created_at", istDateTime(sp.from, "00:00").toISOString());
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) q = q.lt("created_at", istDateTime(addDays(sp.to, 1), "00:00").toISOString());
  if (sp.q) {
    const term = sp.q.replace(/[^\w\s+-]/g, "").slice(0, 40);
    if (term) q = q.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`);
  }
  const { data, count, error } = await q;
  type Row = Order & { payments: { status: string }[] };
  const rows = (data ?? []) as unknown as Row[];
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/orders?${p.toString()}`;
  };

  return (
    <div>
      <RealtimeRefresher tables="orders,payments" />
      <PageHeader title="Orders" description={`${count ?? 0} orders match`} />
      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Order no, name, phone" className="input lg:col-span-2" aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Order status">
          <option value="">All (excl. expired)</option>
          <option value="active">Active</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select name="fulfillment" defaultValue={sp.fulfillment ?? ""} className="input" aria-label="Fulfillment">
          <option value="">Delivery & takeaway</option>
          <option value="delivery">Delivery</option>
          <option value="takeaway">Takeaway</option>
        </select>
        <select name="payment" defaultValue={sp.payment ?? ""} className="input" aria-label="Payment status">
          <option value="">Any payment</option>
          {["created", "verification_pending", "captured", "failed", "refund_pending", "refunded"].map((p) => <option key={p} value={p}>{p.replace("_", " ")}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="date" name="from" defaultValue={sp.from} className="input" aria-label="From date" />
          <input type="date" name="to" defaultValue={sp.to} className="input" aria-label="To date" />
        </div>
        <div className="flex gap-2 lg:col-span-6">
          <button className="btn-primary btn-sm">Filter</button>
          <Link href="/admin/orders" className="btn-ghost btn-sm">Reset</Link>
          <Link href="/admin/orders?payment=verification_pending" className="btn-secondary btn-sm">UPI to verify</Link>
          <Link href="/admin/orders?status=payment_confirmed" className="btn-secondary btn-sm">Awaiting acceptance</Link>
          <Link href="/admin/orders?status=active" className="btn-secondary btn-sm">In progress</Link>
        </div>
      </form>
      {error && <p className="field-error mb-4">{error.message}</p>}
      {rows.length === 0 ? (
        <EmptyState title="No orders found" description="Try changing the filters." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={o.status === "payment_confirmed" ? "bg-brand-50/50" : ""}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-semibold hover:text-brand-700">#{o.order_number}</Link><span className="block text-xs text-charcoal-500">{formatDateTime(o.created_at)}</span></td>
                  <td>{o.customer_name}<span className="block text-xs text-charcoal-500">{o.customer_phone}</span></td>
                  <td>{o.fulfillment === "delivery" ? "Delivery" : <>Takeaway<span className="block text-xs text-charcoal-500">{o.pickup_date} {o.pickup_time?.slice(0, 5)}</span></>}</td>
                  <td><Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                  <td className="text-xs uppercase">{o.payments?.[0]?.status?.replace("_", " ") ?? "—"}</td>
                  <td className="text-right font-semibold">{formatINR(o.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(count ?? 0) > PAGE && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="btn-secondary btn-sm">← Newer</Link> : <span />}
          {page * PAGE < (count ?? 0) && <Link href={qs({ page: String(page + 1) })} className="btn-secondary btn-sm">Older →</Link>}
        </div>
      )}
    </div>
  );
}
