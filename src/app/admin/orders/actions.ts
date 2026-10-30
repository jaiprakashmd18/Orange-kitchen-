"use server";

import { z } from "zod";
import { adminAction, check, optStr, str, num } from "@/lib/admin-action";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundOrder, transitionOrder } from "@/lib/orders";
import { adapterFor, providerStatus, trackingUrlFor } from "@/lib/delivery/providers";
import { getSettings, fullAddress } from "@/lib/data";
import { HttpError } from "@/lib/auth";
import type { DeliveryProvider, Order, OrderStatus } from "@/lib/types";

const STAFF = { roles: ["admin", "staff"] as ("admin" | "staff")[] };
const statusSchema = z.enum(["accepted", "preparing", "ready", "collected", "picked_up", "out_for_delivery", "delivered", "rejected", "cancelled"]);

export const updateOrderStatus = adminAction({ ...STAFF, audit: "order.status_changed", revalidate: ["/admin/orders"] }, async (f, ctx) => {
  const id = z.string().uuid().parse(str(f, "order_id"));
  const to = statusSchema.parse(str(f, "to")) as OrderStatus;
  const note = optStr(f, "note")?.slice(0, 300) ?? undefined;
  if ((to === "rejected" || to === "cancelled") && !note) throw new HttpError(400, "Please enter a reason — the customer will see it.");
  const final = await transitionOrder(id, to, { id: ctx.userId, role: ctx.roles.includes("admin") ? "admin" : "staff" }, note);
  return { message: `Order moved to ${final.replace(/_/g, " ")}.`, entityId: id, details: { to: final } };
});

async function loadDeliveryOrder(id: string) {
  const { data } = await createAdminClient().from("orders").select("*").eq("id", id).single();
  const order = data as Order | null;
  if (!order) throw new HttpError(404, "Order not found.");
  if (order.fulfillment !== "delivery") throw new HttpError(400, "Only delivery orders can be assigned.");
  if (!["accepted", "preparing", "ready", "delivery_assigned"].includes(order.status)) {
    throw new HttpError(409, "Assign delivery after accepting the order and before it is picked up.");
  }
  return order;
}

async function replaceAssignment(orderId: string, row: Record<string, unknown>) {
  const db = createAdminClient();
  // Retire the current assignment (reassignment) then insert the new one.
  const { data: prev } = await db.from("delivery_assignments").select("id").eq("order_id", orderId).eq("is_current", true).maybeSingle();
  if (prev) check(await db.from("delivery_assignments").update({ is_current: false, status: "cancelled" }).eq("id", prev.id));
  const inserted = check(await db.from("delivery_assignments").insert({ order_id: orderId, ...row }).select("id").single()) as { id: string };
  check(await db.from("delivery_events").insert({ assignment_id: inserted.id, order_id: orderId, source: "admin", event_type: prev ? "reassigned" : "assigned", actor_id: row.assigned_by }));
  await db.from("orders").update({ delivery_mode: row.mode }).eq("id", orderId);
  return { inserted, reassigned: Boolean(prev) };
}

export const assignOwnDelivery = adminAction({ ...STAFF, audit: "order.delivery_assigned", revalidate: ["/admin/orders", "/delivery"] }, async (f, ctx) => {
  const orderId = z.string().uuid().parse(str(f, "order_id"));
  const personnelId = z.string().uuid({ message: "Choose a delivery person" }).parse(str(f, "personnel_id"));
  const order = await loadDeliveryOrder(orderId);
  const { data: rider } = await createAdminClient().from("delivery_personnel").select("id, full_name, is_active").eq("id", personnelId).single();
  if (!rider?.is_active) throw new HttpError(400, "That delivery person is inactive.");
  const { reassigned } = await replaceAssignment(orderId, { mode: "own", personnel_id: personnelId, assigned_by: ctx.userId });
  if (order.status === "ready") await transitionOrder(orderId, "delivery_assigned", { id: ctx.userId, role: "staff" }, `Assigned to ${rider.full_name}`);
  return { message: `${reassigned ? "Reassigned" : "Assigned"} to ${rider.full_name}.`, entityId: orderId, details: { personnelId } };
});

export const assignThirdParty = adminAction({ ...STAFF, audit: "order.delivery_assigned_third_party", revalidate: ["/admin/orders"] }, async (f, ctx) => {
  const orderId = z.string().uuid().parse(str(f, "order_id"));
  const providerId = z.string().uuid({ message: "Choose a delivery partner" }).parse(str(f, "provider_id"));
  const useApi = str(f, "use_api") === "1";
  const order = await loadDeliveryOrder(orderId);
  const { data: p } = await createAdminClient().from("delivery_providers").select("*").eq("id", providerId).single();
  const provider = p as DeliveryProvider | null;
  if (!provider?.is_active) throw new HttpError(400, "That delivery partner is disabled.");

  let reference = optStr(f, "external_reference");
  let trackingUrl = optStr(f, "external_tracking_url");
  let fee = num(f, "quoted_fee");
  let riderName = optStr(f, "external_rider_name");
  let riderPhone = optStr(f, "external_rider_phone");

  if (useApi) {
    const status = providerStatus(provider);
    const adapter = adapterFor(provider);
    if (!status.apiActive || !adapter.create) throw new HttpError(400, `${provider.name} API is not active: ${status.reason}. Book manually and enter the reference.`);
    const s = await getSettings();
    const booked = await adapter.create(provider, order, { name: s.name, phone: s.phone ?? "", address: fullAddress(s), latitude: s.latitude, longitude: s.longitude });
    reference = booked.reference;
    trackingUrl = booked.trackingUrl;
    fee = booked.fee;
    riderName = booked.riderName ?? null;
    riderPhone = booked.riderPhone ?? null;
  } else if (!reference) {
    throw new HttpError(400, "Enter the partner's booking reference.");
  }
  trackingUrl ??= reference ? trackingUrlFor(provider, reference) : null;
  if (trackingUrl && !/^https:\/\//.test(trackingUrl)) throw new HttpError(400, "Tracking link must start with https://");

  await replaceAssignment(orderId, {
    mode: "third_party",
    provider_id: providerId,
    external_reference: reference,
    external_tracking_url: trackingUrl,
    external_rider_name: riderName,
    external_rider_phone: riderPhone,
    quoted_fee: fee,
    assigned_by: ctx.userId,
  });
  if (order.status === "ready") await transitionOrder(orderId, "delivery_assigned", { id: ctx.userId, role: "staff" }, `Booked with ${provider.name}`);
  return { message: `Booked with ${provider.name}${reference ? ` (ref ${reference})` : ""}.`, entityId: orderId, details: { providerId, reference, viaApi: useApi } };
});

export const retryRefund = adminAction({ roles: ["admin"], audit: "order.refund_retried", revalidate: ["/admin/orders"] }, async (f, ctx) => {
  const orderId = z.string().uuid().parse(str(f, "order_id"));
  const refund = await refundOrder(orderId, ctx.userId);
  return { message: refund ? `Refund ${refund.id} ${refund.status}.` : "No captured payment to refund.", entityId: orderId };
});
