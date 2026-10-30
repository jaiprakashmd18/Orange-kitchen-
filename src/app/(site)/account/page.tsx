import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listMyOrders } from "@/lib/account-queries";
import { OrderRow } from "@/components/account/OrderRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountOverview({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireUser("/account");
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: profile }, active, recent] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
    listMyOrders(user.id, { active: true, limit: 10 }),
    listMyOrders(user.id, { active: false, limit: 5 }),
  ]);
  const first = profile?.full_name?.split(" ")[0];
  return (
    <div className="space-y-8">
      <RealtimeRefresher tables="orders" />
      {sp.password === "updated" && <p className="rounded-xl bg-leaf-50 px-4 py-3 text-sm text-leaf" role="status">Your password has been updated.</p>}
      <header>
        <h1 className="text-4xl">Vanakkam{first ? `, ${first}` : ""}!</h1>
        <p className="mt-1 text-charcoal-500">{user.email}</p>
        {(!profile?.full_name || !profile?.phone) && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Please <Link href="/account/settings" className="font-semibold underline">add your name and mobile number</Link> so we can deliver your orders.
          </p>
        )}
      </header>
      <section aria-labelledby="active">
        <h2 id="active" className="mb-3 font-sans text-lg font-bold">Active orders</h2>
        {active.length ? <ul className="space-y-3">{active.map((o) => <OrderRow key={o.id} order={o} itemsSummary={o.summary} />)}</ul> : <p className="text-sm text-charcoal-500">No active orders right now.</p>}
      </section>
      <section aria-labelledby="recent">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent" className="font-sans text-lg font-bold">Recent orders</h2>
          <Link href="/account/orders?tab=history" className="link text-sm">View all</Link>
        </div>
        {recent.length ? (
          <ul className="space-y-3">{recent.map((o) => <OrderRow key={o.id} order={o} itemsSummary={o.summary} />)}</ul>
        ) : active.length === 0 ? (
          <EmptyState title="No orders yet" description="Your first Orange Kitchen order is just a few taps away." action={{ href: "/menu", label: "Order now" }} />
        ) : null}
      </section>
    </div>
  );
}
