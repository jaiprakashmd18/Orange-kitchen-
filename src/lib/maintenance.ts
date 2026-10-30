import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrationStatus } from "@/lib/env";
import { fetchOrderPayments, fetchRefund } from "@/lib/razorpay";
import { settlePayment } from "@/lib/payments";

// Background upkeep that keeps the system correct even when the Razorpay
// webhook or the Vercel cron is not configured:
//  - confirms payments whose browser callback was lost (polls Razorpay)
//  - records failed attempts
//  - finalises pending refunds
//  - expires orders whose payment window has passed
// It is triggered by the cron route, by admin page loads and by customers
// viewing an unpaid order, and is throttled through the DB rate limiter.

async function allowed(key: string, perSeconds: number) {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", { p_key: key, p_max: 1, p_window_seconds: perSeconds });
  return !error && data === true;
}

/** Re-checks one Razorpay order with Razorpay; settles it if a payment succeeded. */
export async function reconcileRazorpayOrder(providerOrderId: string) {
  const db = createAdminClient();
  await db.from("payments").update({ last_reconciled_at: new Date().toISOString() }).eq("provider_order_id", providerOrderId);
  const attempts = await fetchOrderPayments(providerOrderId);
  const good = attempts.find((p) => p.status === "captured" || p.status === "authorized");
  if (good) {
    await settlePayment(providerOrderId, good.id, "webhook", good);
    return "confirmed" as const;
  }
  const failed = attempts.filter((p) => p.status === "failed").pop();
  if (failed) {
    await db.rpc("record_payment_failure", { p_provider_order_id: providerOrderId, p_provider_payment_id: failed.id, p_reason: failed.error_description ?? "Payment failed" });
    return "failed" as const;
  }
  return "pending" as const;
}

/** Customer-facing: quickly re-check an unpaid order (throttled per order). */
export async function reconcileOrder(orderId: string) {
  if (!integrationStatus().razorpay) return;
  if (!(await allowed(`reconcile-order:${orderId}`, 10))) return;
  const { data: pays } = await createAdminClient()
    .from("payments")
    .select("provider_order_id, status")
    .eq("order_id", orderId)
    .in("status", ["created", "authorized", "failed"]);
  for (const p of pays ?? []) {
    try {
      await reconcileRazorpayOrder(p.provider_order_id);
    } catch (e) {
      console.error("[reconcile order]", e);
    }
  }
}

export async function runMaintenance(opts: { force?: boolean } = {}) {
  if (!opts.force && !(await allowed("maintenance", 60))) return { skipped: true };
  const db = createAdminClient();
  const result = { confirmed: 0, failed: 0, refunds: 0, expired: 0 };

  if (integrationStatus().razorpay) {
    // Payments still open for orders created in the last 48h (oldest check first).
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data: open } = await db
      .from("payments")
      .select("provider_order_id, last_reconciled_at, orders!inner(status)")
      .in("status", ["created", "authorized", "failed"])
      .in("orders.status", ["pending_payment", "payment_failed", "expired"])
      .gte("created_at", since)
      .or(`last_reconciled_at.is.null,last_reconciled_at.lt.${new Date(Date.now() - 90_000).toISOString()}`)
      .order("last_reconciled_at", { ascending: true, nullsFirst: true })
      .limit(15);
    for (const p of open ?? []) {
      try {
        const r = await reconcileRazorpayOrder(p.provider_order_id);
        if (r === "confirmed") result.confirmed++;
        if (r === "failed") result.failed++;
      } catch (e) {
        console.error("[maintenance] reconcile", e);
      }
    }

    const { data: refunds } = await db
      .from("payments")
      .select("id, amount, provider_payment_id, refund_id")
      .eq("status", "refund_pending")
      .not("refund_id", "is", null)
      .limit(15);
    for (const r of refunds ?? []) {
      try {
        const refund = await fetchRefund(r.provider_payment_id, r.refund_id);
        if (refund.status === "processed") {
          await db.from("payments").update({ status: "refunded", refunded_amount: refund.amount / 100, refunded_at: new Date().toISOString() }).eq("id", r.id);
          result.refunds++;
        } else if (refund.status === "failed") {
          await db.from("payments").update({ status: "captured", failure_reason: "Refund failed — retry from admin" }).eq("id", r.id);
        }
      } catch (e) {
        console.error("[maintenance] refund", e);
      }
    }
  }

  // Expire last, after any late payments were confirmed above.
  const { data: expired } = await db.rpc("expire_unpaid_orders");
  result.expired = Number(expired ?? 0);
  return result;
}
