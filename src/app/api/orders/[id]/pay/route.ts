import { NextResponse, type NextRequest } from "next/server";
import { assertUser } from "@/lib/auth";
import { resumePayment } from "@/lib/orders";
import { handleRouteError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** Retry payment for an unpaid order. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await assertUser();
    await rateLimit(`pay:${user.id}`, 20, 600);
    const { id } = await params;
    return NextResponse.json(await resumePayment(user.id, id));
  } catch (err) {
    return handleRouteError(err, "orders:pay");
  }
}
