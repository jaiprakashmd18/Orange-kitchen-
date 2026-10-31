import { NextResponse, type NextRequest } from "next/server";
import { assertUser, HttpError } from "@/lib/auth";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { settlePayment } from "@/lib/payments";
import { verifyPaymentSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Called by the browser after Razorpay Checkout reports success.
 * The browser's word is never trusted: we verify the HMAC signature AND
 * re-fetch the payment from Razorpay before confirming the order.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await assertUser();
    await rateLimit(`verify:${user.id}`, 30, 600);
    const body = verifyPaymentSchema.parse(await req.json());

    const { data: payment } = await createAdminClient()
      .from("payments")
      .select("order_id, orders!inner(customer_id)")
      .eq("provider_order_id", body.razorpay_order_id)
      .maybeSingle();
    const owner = (payment?.orders as unknown as { customer_id: string } | null)?.customer_id;
    if (!payment || owner !== user.id) throw new HttpError(404, "Payment not found.");

    if (!(await verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature))) {
      throw new HttpError(400, "Payment signature could not be verified.", "BAD_SIGNATURE");
    }
    const result = await settlePayment(body.razorpay_order_id, body.razorpay_payment_id, "signature");
    return NextResponse.json({ order_id: result.orderId, confirmed: result.confirmed, status: result.status });
  } catch (err) {
    return handleRouteError(err, "payments:verify");
  }
}
