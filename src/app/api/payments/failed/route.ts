import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertUser, HttpError } from "@/lib/auth";
import { fetchPayment } from "@/lib/razorpay";
import { handleRouteError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Browser reports a failed attempt. We only record it after confirming the
 * failure with Razorpay, so a client cannot mark arbitrary payments failed.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await assertUser();
    const body = z.object({ razorpay_order_id: z.string().min(5).max(64), razorpay_payment_id: z.string().min(5).max(64) }).parse(await req.json());
    const db = createAdminClient();
    const { data: payment } = await db
      .from("payments")
      .select("order_id, orders!inner(customer_id)")
      .eq("provider_order_id", body.razorpay_order_id)
      .maybeSingle();
    if (!payment || (payment.orders as unknown as { customer_id: string }).customer_id !== user.id) throw new HttpError(404, "Payment not found.");
    const rp = await fetchPayment(body.razorpay_payment_id);
    if (rp.order_id === body.razorpay_order_id && rp.status === "failed") {
      await db.rpc("record_payment_failure", {
        p_provider_order_id: body.razorpay_order_id,
        p_provider_payment_id: rp.id,
        p_reason: rp.error_description ?? "Payment failed",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "payments:failed");
  }
}
