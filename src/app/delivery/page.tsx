import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { myAssignments } from "@/lib/rider-queries";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";
import { formatINR, formatTime } from "@/lib/format";

export default async function RiderHome() {
  const { user } = await requireRole(["delivery"], "/delivery");
  const list = await myAssignments(user.id, "active");
  return (
    <div>
      <RealtimeRefresher tables="delivery_assignments,orders" />
      <h1 className="mb-4 font-sans text-2xl font-bold">Assigned orders</h1>
      {list.length === 0 ? (
        <EmptyState icon="🛵" title="No deliveries assigned" description="New assignments appear here automatically." />
      ) : (
        <ul className="space-y-3">
          {list.map(({ id, orders: o }) => (
            <li key={id}>
              <Link href={`/delivery/${o.id}`} className="card block p-4 active:scale-[0.99]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">#{o.order_number}</span>
                  <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold">{o.delivery_address?.full_name}</p>
                <p className="text-sm text-charcoal-500">{[o.delivery_address?.house, o.delivery_address?.street, o.delivery_address?.area, o.delivery_address?.pincode].filter(Boolean).join(", ")}</p>
                <p className="mt-2 text-xs text-charcoal-500">Order value {formatINR(o.total_amount)} · prepaid{o.estimated_delivery_at && ` · ETA ${formatTime(o.estimated_delivery_at)}`}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
