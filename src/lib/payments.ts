import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { capturePayment, fetchPayment, type RazorpayPayment } from "@/lib/razorpay";
import { dispatchOrderNotifications } from "@/lib/notifications/dispatch";
import { toPaise } from "@/lib/pricing";

/**
 * Authoritative payment settlement: always re-fetches the payment from
 * Razorpay, checks it belongs to the expected Razorpay order and amount,
 * captures if only authorized, then confirms in the DB (idempotent).
 */
export async function settlePayment(providerOrderId: string, paymentId: string, via: "signature" | "webhook", known?: RazorpayPayment) {
  const db = createAdminClient();
  const { data: payment } = await db.from("payments").select("id, order_id, amount, status").eq("provider_order_id", providerOrderId).maybeSingle();
  if (!payment) throw new Error(`Unknown Razorpay order ${providerOrderId}`);

  let rp = known ?? (await fetchPayment(paymentId));
  if (rp.order_id !== providerOrderId) throw new Error("Payment does not belong to this order");
  if (rp.amount !== toPaise(payment.amount) || rp.currency !== "INR") throw new Error("Payment amount mismatch");

  if (rp.status === "authorized") rp = await capturePayment(rp.id, rp.amount);
  if (rp.status !== "captured") {
    return { confirmed: false, status: rp.status, orderId: payment.order_id as string };
  }

  const { error } = await db.rpc("confirm_payment", {
    p_provider_order_id: providerOrderId,
    p_provider_payment_id: rp.id,
    p_amount: Number(payment.amount),
    p_method: rp.method ?? null,
    p_via: via,
  });
  if (error) throw new Error(`confirm_payment failed: ${error.message}`);

  if (payment.status !== "captured") after(() => dispatchOrderNotifications(payment.order_id, "payment_confirmed"));
  return { confirmed: true, status: rp.status, orderId: payment.order_id as string };
}
