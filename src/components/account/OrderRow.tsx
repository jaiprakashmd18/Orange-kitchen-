import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ReorderButton } from "./ReorderButton";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";
import { formatDateTime, formatINR } from "@/lib/format";
import type { Order } from "@/lib/types";

export function OrderRow({ order, itemsSummary }: { order: Pick<Order, "id" | "order_number" | "status" | "fulfillment" | "total_amount" | "created_at">; itemsSummary: string }) {
  return (
    <li className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/orders/${order.id}`} className="font-bold hover:text-brand-700">#{order.order_number}</Link>
          <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
          <span className="text-xs text-charcoal-500">{order.fulfillment === "delivery" ? "Delivery" : "Takeaway"}</span>
        </div>
        <p className="mt-1 truncate text-sm text-charcoal-500">{itemsSummary}</p>
        <p className="text-xs text-charcoal-400">{formatDateTime(order.created_at)}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold">{formatINR(order.total_amount)}</span>
        <Link href={`/orders/${order.id}`} className="btn-secondary btn-sm">{["delivered", "collected", "cancelled", "rejected", "expired"].includes(order.status) ? "Details" : "Track"}</Link>
        {["delivered", "collected"].includes(order.status) && <ReorderButton orderId={order.id} />}
      </div>
    </li>
  );
}
