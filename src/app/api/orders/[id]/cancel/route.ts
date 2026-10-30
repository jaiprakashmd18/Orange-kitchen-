import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertUser, HttpError } from "@/lib/auth";
import { transitionOrder } from "@/lib/orders";
import { handleRouteError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

/** Customer cancellation — allowed only before the restaurant accepts. Refund is automatic. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await assertUser();
    const { id } = await params;
    const { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(await req.json().catch(() => ({})));
    const { data: order } = await createAdminClient().from("orders").select("id, status, customer_id").eq("id", id).maybeSingle();
    if (!order || order.customer_id !== user.id) throw new HttpError(404, "Order not found.");
    if (order.status !== "payment_confirmed") {
      throw new HttpError(409, "This order has already been accepted by the restaurant and can no longer be cancelled online. Please call us.", "NOT_CANCELLABLE");
    }
    const status = await transitionOrder(id, "cancelled", { id: user.id, role: "customer" }, reason || "Cancelled by customer");
    return NextResponse.json({ status });
  } catch (err) {
    return handleRouteError(err, "orders:cancel");
  }
}
