import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertUser, HttpError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRouteError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { UTR_PATTERN } from "@/lib/payment-methods";

/**
 * Customer submits the UPI transaction ID (UTR) after paying the
 * restaurant's UPI ID. The order is NOT confirmed here — staff verify the
 * amount + UTR in their UPI app and confirm it from the admin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await assertUser();
    await rateLimit(`upi-utr:${user.id}`, 10, 600);
    const { id } = await params;
    const { utr } = z.object({ utr: z.string().trim().transform((v) => v.replace(/\s/g, "")) }).parse(await req.json());
    if (!UTR_PATTERN.test(utr)) throw new HttpError(400, "Enter the 12-digit UPI transaction ID (UTR) shown in your payment app.", "BAD_UTR");

    const db = createAdminClient();
    const { data: order } = await db.from("orders").select("id, customer_id, status, updated_at").eq("id", id).maybeSingle();
    if (!order || order.customer_id !== user.id) throw new HttpError(404, "Order not found.");
    const recentlyExpired = order.status === "expired" && Date.now() - new Date(order.updated_at).getTime() < 24 * 3600_000;
    if (!["pending_payment", "payment_failed"].includes(order.status) && !recentlyExpired) {
      throw new HttpError(409, "This order no longer needs payment.", "NOT_PAYABLE");
    }

    const { data: payment } = await db.from("payments").select("id, status").eq("order_id", id).eq("provider", "upi").maybeSingle();
    if (!payment) throw new HttpError(409, "This order isn't set up for UPI payment.");
    if (!["created", "failed", "verification_pending"].includes(payment.status)) throw new HttpError(409, "This payment is already completed.");

    const { error } = await db
      .from("payments")
      .update({ status: "verification_pending", provider_payment_id: utr, submitted_at: new Date().toISOString(), method: "upi", failure_reason: null })
      .eq("id", payment.id);
    if (error?.code === "23505") throw new HttpError(409, "This transaction ID has already been used for another order. Please check the ID.", "UTR_USED");
    if (error) throw error;

    if (order.status === "payment_failed") {
      await db.rpc("transition_order_status", { p_order_id: id, p_to: "pending_payment", p_actor_id: user.id, p_actor_role: "customer", p_note: "UPI transaction ID submitted" });
    }
    await db.from("audit_logs").insert({ actor_id: user.id, action: "payment.upi_utr_submitted", entity: "order", entity_id: id, details: { utr } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "orders:upi");
  }
}
