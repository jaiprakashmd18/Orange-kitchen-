import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adapterFor } from "@/lib/delivery/providers";
import { transitionOrder } from "@/lib/orders";
import type { DeliveryProvider, OrderStatus } from "@/lib/types";

// Status callbacks from third-party delivery providers.
// URL: /api/webhooks/delivery/<provider code>

const ORDER_STATUS_FOR: Record<string, OrderStatus | null> = {
  assigned: null,
  picked_up: "picked_up",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: null,
  failed: null,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: code } = await params;
  const db = createAdminClient();
  const { data: provider } = await db.from("delivery_providers").select("*").eq("code", code).eq("is_active", true).maybeSingle();
  if (!provider) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const adapter = adapterFor(provider as DeliveryProvider);
  if (!adapter.parseWebhook) return NextResponse.json({ error: "provider has no webhook support" }, { status: 400 });
  const raw = await req.text();
  const events = adapter.parseWebhook(provider as DeliveryProvider, raw, req.headers);
  if (events === null) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  for (const ev of events) {
    const { data: assignment } = await db
      .from("delivery_assignments")
      .select("id, order_id, status")
      .eq("provider_id", provider.id)
      .eq("external_reference", ev.reference)
      .eq("is_current", true)
      .maybeSingle();
    if (!assignment) continue;

    const { error: dupErr } = await db.from("delivery_events").insert({
      assignment_id: assignment.id,
      order_id: assignment.order_id,
      source: "provider_webhook",
      event_type: ev.status,
      external_event_id: ev.eventId,
      payload: JSON.parse(raw),
    });
    if (dupErr?.code === "23505") continue; // already processed

    await db
      .from("delivery_assignments")
      .update({
        status: ev.status === "failed" ? "failed" : ev.status,
        external_rider_name: ev.riderName ?? undefined,
        external_rider_phone: ev.riderPhone ?? undefined,
        external_tracking_url: ev.trackingUrl ?? undefined,
      })
      .eq("id", assignment.id);

    const target = ORDER_STATUS_FOR[ev.status];
    if (target) {
      try {
        // Walk forward through intermediate stages if the provider skipped one.
        const chain: OrderStatus[] = ["picked_up", "out_for_delivery", "delivered"];
        const { data: order } = await db.from("orders").select("status").eq("id", assignment.order_id).single();
        let idx = chain.indexOf(order!.status as OrderStatus);
        const goal = chain.indexOf(target);
        if (order!.status === "delivery_assigned") idx = -1;
        for (let i = idx + 1; i <= goal; i++) {
          await transitionOrder(assignment.order_id, chain[i], { id: null, role: `provider:${code}` });
        }
      } catch (e) {
        console.error("[delivery webhook] transition failed", e);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
