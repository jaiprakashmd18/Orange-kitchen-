import { requireRole } from "@/lib/auth";
import { myAssignments } from "@/lib/rider-queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { STATUS_LABEL } from "@/lib/order-status";
import { formatDateTime, formatINR } from "@/lib/format";

export const metadata = { title: "History" };

export default async function RiderHistory() {
  const { user } = await requireRole(["delivery"], "/delivery/history");
  const list = await myAssignments(user.id, "history");
  const delivered = list.filter((x) => x.orders.status === "delivered");
  return (
    <div>
      <h1 className="mb-1 font-sans text-2xl font-bold">Delivery history</h1>
      <p className="mb-4 text-sm text-charcoal-500">{delivered.length} delivered</p>
      {list.length === 0 ? <EmptyState icon="📦" title="No past deliveries" /> : (
        <ul className="card divide-y divide-charcoal/5">
          {list.map(({ id, delivered_at, assigned_at, orders: o }) => (
            <li key={id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span><strong>#{o.order_number}</strong><span className="block text-xs text-charcoal-500">{o.delivery_address?.area} · {formatDateTime(delivered_at ?? assigned_at)}</span></span>
              <span className="text-right">{STATUS_LABEL[o.status]}<span className="block text-xs text-charcoal-500">{formatINR(o.total_amount)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
