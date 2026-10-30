import { NextResponse, type NextRequest } from "next/server";
import { findServiceableArea } from "@/lib/orders";
import { pincodeSchema } from "@/lib/validation";
import { clientIp, handleRouteError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    await rateLimit(`svc:${clientIp(req)}`, 60, 60);
    const pincode = pincodeSchema.parse(req.nextUrl.searchParams.get("pincode") ?? "");
    const area = await findServiceableArea(pincode);
    return NextResponse.json(
      area
        ? { serviceable: true, area: area.name, delivery_fee: area.delivery_fee, free_delivery_above: area.free_delivery_above, min_order_amount: area.min_order_amount, estimated_minutes: area.estimated_minutes }
        : { serviceable: false },
    );
  } catch (err) {
    return handleRouteError(err, "serviceability");
  }
}
