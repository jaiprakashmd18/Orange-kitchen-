import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatINR } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Payments & receipts", robots: { index: false } };

const TONE = { captured: "success", refunded: "neutral", refund_pending: "warning", failed: "danger", created: "warning", authorized: "info", partially_refunded: "neutral" } as const;
const LABEL = { captured: "Paid", refunded: "Refunded", refund_pending: "Refund initiated", failed: "Failed", created: "Not completed", authorized: "Authorised", partially_refunded: "Partially refunded" } as const;

export default async function PaymentsPage() {
  const user = await requireUser("/account/payments");
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, status, method, provider_payment_id, created_at, captured_at, refunded_amount, orders!inner(id, order_number, customer_id)")
    .eq("orders.customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  type Row = { id: string; amount: number; status: keyof typeof LABEL; method: string | null; provider_payment_id: string | null; created_at: string; captured_at: string | null; orders: { id: string; order_number: string } };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <h1 className="mb-6 text-4xl">Payments &amp; receipts</h1>
      {rows.length === 0 ? (
        <EmptyState icon="🧾" title="No payments yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Date</th><th>Order</th><th>Method</th><th>Status</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{formatDateTime(p.captured_at ?? p.created_at)}</td>
                  <td><Link href={`/orders/${p.orders.id}`} className="link">#{p.orders.order_number}</Link></td>
                  <td className="uppercase">{p.method ?? "—"}</td>
                  <td><Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge></td>
                  <td className="text-right font-semibold">{formatINR(p.amount)}</td>
                  <td>{["captured", "refunded", "refund_pending"].includes(p.status) && <Link href={`/orders/${p.orders.id}/receipt`} className="link whitespace-nowrap text-sm">Receipt</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
