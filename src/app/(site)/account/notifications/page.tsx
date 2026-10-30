import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkReadButton } from "./MarkReadButton";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";
import type { NotificationRow } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage() {
  const user = await requireUser("/account/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).eq("channel", "in_app").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as NotificationRow[];
  const unread = rows.some((r) => !r.read_at);
  return (
    <div>
      <RealtimeRefresher tables="notifications" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl">Notifications</h1>
        {unread && <MarkReadButton />}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications" description="Order updates will appear here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id} className={`card flex gap-3 p-4 ${n.read_at ? "opacity-70" : ""}`}>
              {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
              <div className="flex-1">
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-charcoal-700">{n.body}</p>
                <p className="mt-1 text-xs text-charcoal-400">
                  {formatDateTime(n.created_at)}
                  {n.order_id && <> · <Link href={`/orders/${n.order_id}`} className="link">View order</Link></>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
