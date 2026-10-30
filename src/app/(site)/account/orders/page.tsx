import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { listMyOrders } from "@/lib/account-queries";
import { OrderRow } from "@/components/account/OrderRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function MyOrders({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("/account/orders");
  const tab = (await searchParams).tab === "history" ? "history" : "active";
  const orders = await listMyOrders(user.id, { active: tab === "active", limit: 100 });
  return (
    <div>
      <RealtimeRefresher tables="orders" />
      <h1 className="text-4xl">My orders</h1>
      <div className="mt-6 inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-charcoal/10">
        {(["active", "history"] as const).map((t) => (
          <Link key={t} href={`/account/orders?tab=${t}`} className={clsx("rounded-full px-5 py-2 text-sm font-semibold", tab === t ? "bg-charcoal text-white" : "text-charcoal-500")}>
            {t === "active" ? "Active orders" : "Order history"}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        {orders.length ? (
          <ul className="space-y-3">{orders.map((o) => <OrderRow key={o.id} order={o} itemsSummary={o.summary} />)}</ul>
        ) : (
          <EmptyState title={tab === "active" ? "No active orders" : "No past orders yet"} action={{ href: "/menu", label: "Browse the menu" }} />
        )}
      </div>
    </div>
  );
}
