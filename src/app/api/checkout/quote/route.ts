import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { buildQuote } from "@/lib/orders";
import { cartLineSchema, pincodeSchema } from "@/lib/validation";
import { clientIp, handleRouteError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const quoteSchema = z.object({
  items: z.array(cartLineSchema).min(1).max(50),
  fulfillment: z.enum(["delivery", "takeaway"]),
  address_id: z.string().uuid().optional(),
  pincode: pincodeSchema.optional(),
  pickup_slot_id: z.string().uuid().optional(),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  coupon_code: z.string().trim().max(30).optional().nullable(),
});

/** Authoritative price preview computed from database prices. */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    await rateLimit(`quote:${user?.id ?? clientIp(req)}`, 60, 60);
    const body = quoteSchema.parse(await req.json());

    let pincode = body.pincode;
    if (body.address_id && user) {
      const supabase = await createClient();
      const { data } = await supabase.from("customer_addresses").select("pincode").eq("id", body.address_id).maybeSingle();
      pincode = data?.pincode ?? pincode;
    }

    const result = await buildQuote({
      items: body.items,
      fulfillment: body.fulfillment,
      userId: user?.id ?? null,
      address: pincode ? { pincode } : null,
      pickup: body.pickup_slot_id && body.pickup_date ? { slot_id: body.pickup_slot_id, date: body.pickup_date } : null,
      coupon_code: body.coupon_code || null,
      strict: false,
    });
    return NextResponse.json({
      quote: result.quote,
      delivery_pending: result.deliveryPending,
      blockers: result.blockers,
      area: result.area ? { name: result.area.name, estimated_minutes: result.area.estimated_minutes } : null,
      tax_label: result.settings.tax_label,
      prices_include_tax: result.settings.prices_include_tax,
    });
  } catch (err) {
    return handleRouteError(err, "quote");
  }
}
