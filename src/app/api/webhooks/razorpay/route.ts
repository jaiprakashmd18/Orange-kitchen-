import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature, type RazorpayPayment } from "@/lib/razorpay";
import { settlePayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

// Razorpay webhook. Configure in Dashboard → Settings → Webhooks with:
// payment.authorized, payment.captured, payment.failed, order.paid,
// refund.processed, refund.failed.

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const db = createAdminClient();

  let valid = false;
  try {
    valid = verifyWebhookSignature(raw, signature);
  } catch (e) {
    console.error("[webhook] secret missing", e);
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  let payload: {
    event: string;
    payload?: {
      payment?: { entity: RazorpayPayment };
      order?: { entity: { id: string } };
      refund?: { entity: { id: string; payment_id: string; amount: number; status: string } };
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const eventId = req.headers.get("x-razorpay-event-id") ?? `${payload.event}:${payload.payload?.payment?.entity?.id ?? payload.payload?.refund?.entity?.id ?? "?"}`;

  if (!valid) {
    // Logged under a random id so a forged request can never "pre-claim" a
    // genuine event id and cause the real event to be skipped as a duplicate.
    await db.from("payment_webhook_events").insert({
      event_id: `invalid:${crypto.randomUUID()}`,
      event_type: String(payload.event ?? "unknown").slice(0, 60),
      payload: { redacted: true },
      signature_valid: false,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Each genuine event is processed once; redeliveries are acknowledged.
  const { data: inserted, error: insErr } = await db
    .from("payment_webhook_events")
    .insert({ event_id: eventId, event_type: payload.event ?? "unknown", payload, signature_valid: true })
    .select("id")
    .maybeSingle();
  if (insErr?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });

  try {
    const payment = payload.payload?.payment?.entity;
    switch (payload.event) {
      case "payment.authorized":
      case "payment.captured":
      case "order.paid":
        if (payment) await settlePayment(payment.order_id, payment.id, "webhook");
        break;
      case "payment.failed":
        if (payment)
          await db.rpc("record_payment_failure", {
            p_provider_order_id: payment.order_id,
            p_provider_payment_id: payment.id,
            p_reason: payment.error_description ?? "Payment failed",
          });
        break;
      case "refund.processed":
      case "refund.failed": {
        const refund = payload.payload?.refund?.entity;
        if (refund) {
          const processed = payload.event === "refund.processed";
          await db
            .from("payments")
            .update(
              processed
                ? { status: "refunded", refund_id: refund.id, refunded_amount: refund.amount / 100, refunded_at: new Date().toISOString() }
                : { status: "captured", failure_reason: "Refund failed — retry from admin" },
            )
            .eq("provider_payment_id", refund.payment_id);
        }
        break;
      }
    }
    if (inserted) await db.from("payment_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", inserted.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook] processing failed", e);
    if (inserted) {
      // Allow Razorpay's retry to reprocess this event.
      await db.from("payment_webhook_events").delete().eq("id", inserted.id);
    }
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
