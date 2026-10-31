import { NextResponse, type NextRequest } from "next/server";
import { assertUser, HttpError } from "@/lib/auth";
import { placeOrder } from "@/lib/orders";
import { checkoutSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** Creates an order (pending payment) and its Razorpay order. */
export async function POST(req: NextRequest) {
  try {
    const user = await assertUser();
    if (!user.email_confirmed_at && !user.phone_confirmed_at) {
      throw new HttpError(403, "Please verify your email address before placing an order.", "UNVERIFIED");
    }
    await rateLimit(`order:${user.id}`, 10, 600);
    const body = checkoutSchema.parse(await req.json());
    if (!body.idempotency_key) throw new HttpError(400, "Missing idempotency key.");
    const session = await placeOrder({
      userId: user.id,
      email: user.email ?? null,
      items: body.items,
      fulfillment: body.fulfillment,
      address_id: body.address_id,
      pickup_slot_id: body.pickup_slot_id,
      pickup_date: body.pickup_date,
      coupon_code: body.coupon_code,
      special_instructions: body.special_instructions,
      idempotency_key: body.idempotency_key,
      payment_method: body.payment_method,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    return handleRouteError(err, "orders:create");
  }
}
