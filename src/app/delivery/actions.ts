"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertRole, HttpError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionOrder } from "@/lib/orders";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/admin/ActionForm";

// Rider actions. Ownership is verified server-side: a rider may only act on
// orders whose CURRENT assignment belongs to them.

async function currentRider(userId: string) {
  const { data } = await createAdminClient().from("delivery_personnel").select("id, is_active").eq("user_id", userId).maybeSingle();
  if (!data?.is_active) throw new HttpError(403, "Your rider account is inactive.");
  return data.id as string;
}

const NEXT: Record<string, "picked_up" | "out_for_delivery" | "delivered"> = {
  delivery_assigned: "picked_up",
  picked_up: "out_for_delivery",
  out_for_delivery: "delivered",
};

export async function riderAdvance(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { user } = await assertRole(["delivery"]);
    const orderId = z.string().uuid().parse(form.get("order_id"));
    const expected = z.enum(["picked_up", "out_for_delivery", "delivered"]).parse(form.get("to"));
    const riderId = await currentRider(user.id);
    const db = createAdminClient();
    const { data: a } = await db.from("delivery_assignments").select("id, orders!inner(status)").eq("order_id", orderId).eq("is_current", true).eq("personnel_id", riderId).maybeSingle();
    if (!a) throw new HttpError(404, "This order is not assigned to you.");
    const status = (a.orders as unknown as { status: string }).status;
    if (NEXT[status] !== expected) throw new HttpError(409, status === "ready" ? "Wait for the kitchen to hand over the order." : "This step was already done.");
    await transitionOrder(orderId, expected, { id: user.id, role: "delivery" });
    await db.from("delivery_events").insert({ assignment_id: a.id, order_id: orderId, source: "rider", event_type: expected, actor_id: user.id });
    await audit({ actorId: user.id, action: `delivery.${expected}`, entity: "order", entityId: orderId });
    revalidatePath("/delivery", "layout");
    return { ok: true, error: null, message: "Updated." };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    console.error("[rider]", e);
    return { ok: false, error: "Could not update. Please try again." };
  }
}

export async function toggleDuty(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { user } = await assertRole(["delivery"]);
    const riderId = await currentRider(user.id);
    await createAdminClient().from("delivery_personnel").update({ is_on_duty: form.get("value") === "true" }).eq("id", riderId);
    revalidatePath("/delivery", "layout");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof HttpError ? e.message : "Could not update." };
  }
}
