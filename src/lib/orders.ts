import "server-only";
import crypto from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeItem, normalizeSettings } from "@/lib/data";
import { HttpError } from "@/lib/auth";
import { computeQuote, priceLines, PricingError, toPaise, type CartLineInput, type Quote } from "@/lib/pricing";
import { isOpenAt, itemAvailableAt, upcomingPickupOptions, type PickupOption } from "@/lib/schedule";
import { istDateTime } from "@/lib/format";
import { createRazorpayOrder, refundPayment } from "@/lib/razorpay";
import { availablePaymentMethods } from "@/lib/payment-methods";
import { getConfig } from "@/lib/config";
import { dispatchOrderNotifications } from "@/lib/notifications/dispatch";
import type {
  Address,
  AvailabilityWindow,
  Coupon,
  Fulfillment,
  HolidayClosure,
  OperatingHour,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  PickupSlot,
  RestaurantSettings,
  ServiceableArea,
} from "@/lib/types";

const db = () => createAdminClient();

async function loadOrderingContext() {
  const [settings, hours, holidays, slots] = await Promise.all([
    db().from("restaurant_settings").select("*").eq("id", 1).single(),
    db().from("operating_hours").select("*"),
    db().from("holiday_closures").select("*"),
    db().from("pickup_slots").select("*").eq("is_active", true),
  ]);
  if (settings.error || !settings.data) throw new Error("Restaurant settings missing");
  return {
    settings: normalizeSettings(settings.data),
    hours: (hours.data ?? []) as OperatingHour[],
    holidays: (holidays.data ?? []) as HolidayClosure[],
    slots: (slots.data ?? []) as PickupSlot[],
  };
}

export async function getPickupOptions(settings: RestaurantSettings, slots: PickupSlot[], holidays: HolidayClosure[]) {
  const today = new Date();
  const dates = [0, 1].map((d) => new Date(today.getTime() + d * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const usage = new Map<string, number>();
  for (const date of dates) {
    const { data } = await db().rpc("pickup_slot_usage", { p_date: date });
    for (const row of (data ?? []) as { slot_id: string; used: number }[]) usage.set(`${date}|${row.slot_id}`, row.used);
  }
  return upcomingPickupOptions({ slots, holidays, usage, leadMinutes: settings.prep_time_minutes, daysAhead: 1 });
}

export async function findServiceableArea(pincode: string) {
  const { data } = await db()
    .from("serviceable_areas")
    .select("*")
    .eq("pincode", pincode)
    .eq("is_active", true)
    .order("delivery_fee")
    .limit(1);
  const row = data?.[0];
  return row
    ? ({
        ...row,
        delivery_fee: Number(row.delivery_fee),
        free_delivery_above: row.free_delivery_above === null ? null : Number(row.free_delivery_above),
        min_order_amount: Number(row.min_order_amount),
      } as ServiceableArea)
    : null;
}

async function loadCoupon(code: string, userId: string | null) {
  const { data } = await db().from("coupons").select("*").eq("code", code).maybeSingle();
  if (!data) return { coupon: null, total: 0, mine: 0 };
  const coupon = {
    ...data,
    discount_value: Number(data.discount_value),
    max_discount: data.max_discount === null ? null : Number(data.max_discount),
    min_order_amount: Number(data.min_order_amount),
  } as Coupon;
  const [{ count: total }, { count: mine }] = await Promise.all([
    db().from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", coupon.id),
    userId
      ? db().from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", coupon.id).eq("user_id", userId)
      : Promise.resolve({ count: 0 }),
  ]);
  return { coupon, total: total ?? 0, mine: mine ?? 0 };
}

export interface QuoteRequest {
  items: CartLineInput[];
  fulfillment: Fulfillment;
  userId: string | null;
  address?: Pick<Address, "pincode"> | null;
  pickup?: { slot_id: string; date: string } | null;
  coupon_code?: string | null;
  /** strict = validate everything required to actually place the order */
  strict: boolean;
}

export interface QuoteResult {
  quote: Quote;
  settings: RestaurantSettings;
  area: ServiceableArea | null;
  pickup: PickupOption | null;
  fulfillmentAt: Date;
  /** delivery fee could not be computed because no address was supplied */
  deliveryPending: boolean;
  blockers: string[];
}

export async function buildQuote(req: QuoteRequest): Promise<QuoteResult> {
  const ctx = await loadOrderingContext();
  const { settings } = ctx;
  const blockers: string[] = [];

  if (!settings.accepting_orders) blockers.push("Orange Kitchen is not accepting online orders right now.");
  if (req.fulfillment === "delivery" && !settings.delivery_enabled) blockers.push("Home delivery is currently unavailable.");
  if (req.fulfillment === "takeaway" && !settings.takeaway_enabled) blockers.push("Takeaway is currently unavailable.");

  // When will the food be prepared? Delivery = now; takeaway = chosen slot.
  let fulfillmentAt = new Date();
  let pickup: PickupOption | null = null;
  if (req.fulfillment === "takeaway" && req.pickup) {
    const options = await getPickupOptions(settings, ctx.slots, ctx.holidays);
    pickup = options.find((o) => o.slot_id === req.pickup!.slot_id && o.date === req.pickup!.date) ?? null;
    if (!pickup) blockers.push("That pickup time is no longer available. Please choose another slot.");
    else fulfillmentAt = istDateTime(pickup.date, pickup.start_time);
  } else if (req.fulfillment === "takeaway" && req.strict) {
    blockers.push("Choose a pickup time.");
  }
  if (req.fulfillment === "delivery" && !isOpenAt(ctx.hours, ctx.holidays, fulfillmentAt)) {
    blockers.push("We are closed right now. Delivery orders can be placed during opening hours.");
  }

  const ids = [...new Set(req.items.map((i) => i.menu_item_id))];
  const [{ data: itemRows }, { data: windowRows }] = await Promise.all([
    db().from("menu_items").select("*").in("id", ids),
    db().from("menu_item_availability").select("*").in("menu_item_id", ids),
  ]);
  const items = new Map((itemRows ?? []).map((r) => [r.id as string, normalizeItem(r)]));
  const windows = (windowRows ?? []) as AvailabilityWindow[];
  const lines = priceLines(req.items, items, (item) => itemAvailableAt(item, windows, fulfillmentAt));

  let area: ServiceableArea | null = null;
  let deliveryPending = false;
  if (req.fulfillment === "delivery") {
    if (req.address) {
      area = await findServiceableArea(req.address.pincode);
      if (!area) throw new PricingError("NOT_SERVICEABLE", `Sorry, we do not deliver to pincode ${req.address.pincode} yet.`);
    } else {
      deliveryPending = true;
      if (req.strict) blockers.push("Choose a delivery address.");
    }
  }

  let couponCtx = null;
  if (req.coupon_code) {
    const c = await loadCoupon(req.coupon_code, req.userId);
    couponCtx = { coupon: c.coupon, timesUsedTotal: c.total, timesUsedByUser: c.mine, now: new Date(), fulfillment: req.fulfillment };
  }

  const quote = computeQuote({
    lines,
    settings,
    fulfillment: deliveryPending ? "takeaway" : req.fulfillment,
    area,
    coupon: couponCtx,
  });
  if (quote.subtotal < quote.min_order_amount) {
    blockers.push(`Minimum order value is ₹${quote.min_order_amount}.`);
  }
  if (req.strict && quote.coupon_error) blockers.push(quote.coupon_error);

  return { quote, settings, area, pickup, fulfillmentAt, deliveryPending, blockers };
}

// ---------------------------------------------------------------------------
// Order placement
// ---------------------------------------------------------------------------

export interface PlaceOrderInput {
  userId: string;
  email: string | null;
  items: CartLineInput[];
  fulfillment: Fulfillment;
  address_id?: string;
  pickup_slot_id?: string;
  pickup_date?: string;
  coupon_code?: string | null;
  special_instructions?: string | null;
  idempotency_key: string;
  payment_method: PaymentMethod;
}

export type PaymentSession =
  | {
      method: "razorpay";
      order_id: string;
      order_number: string;
      razorpay_order_id: string;
      amount_paise: number;
      key_id: string;
      prefill: { name: string; email: string; contact: string };
    }
  | { method: "upi"; order_id: string; order_number: string; pay_url: string };

async function sessionFor(order: Order, payment: Payment): Promise<PaymentSession> {
  if (payment.provider === "upi") {
    return { method: "upi", order_id: order.id, order_number: order.order_number, pay_url: `/orders/${order.id}/pay` };
  }
  return {
    method: "razorpay",
    order_id: order.id,
    order_number: order.order_number,
    razorpay_order_id: payment.provider_order_id,
    amount_paise: toPaise(payment.amount),
    key_id: (await getConfig()).razorpay_key_id,
    prefill: { name: order.customer_name, email: order.customer_email ?? "", contact: order.customer_phone },
  };
}

export async function placeOrder(input: PlaceOrderInput): Promise<PaymentSession> {
  // Duplicate submission (double click, network retry) -> return the same order.
  const existing = await db()
    .from("orders")
    .select("*")
    .eq("customer_id", input.userId)
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();
  if (existing.data) return resumePayment(input.userId, existing.data.id);

  const [{ data: profile }, addressRes] = await Promise.all([
    db().from("profiles").select("full_name, phone, email").eq("id", input.userId).single(),
    input.fulfillment === "delivery" && input.address_id
      ? db().from("customer_addresses").select("*").eq("id", input.address_id).eq("user_id", input.userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const address = addressRes.data as Address | null;
  if (input.fulfillment === "delivery" && !address) throw new HttpError(400, "Choose a valid delivery address.");

  const result = await buildQuote({
    items: input.items,
    fulfillment: input.fulfillment,
    userId: input.userId,
    address,
    pickup: input.fulfillment === "takeaway" ? { slot_id: input.pickup_slot_id!, date: input.pickup_date! } : null,
    coupon_code: input.coupon_code,
    strict: true,
  });
  if (result.blockers.length) throw new HttpError(422, result.blockers[0], "NOT_ORDERABLE");

  const { quote, settings, area, pickup } = result;
  if (!(await availablePaymentMethods(settings)).includes(input.payment_method)) {
    throw new HttpError(422, "That payment method is not available right now. Please choose another.", "PAYMENT_METHOD_UNAVAILABLE");
  }
  const name = address?.full_name ?? profile?.full_name ?? "";
  const phone = address?.phone ?? profile?.phone ?? "";
  if (!name || !phone) {
    throw new HttpError(422, "Add your name and mobile number in your profile before ordering.", "PROFILE_INCOMPLETE");
  }

  const now = Date.now();
  const estimatedReady =
    input.fulfillment === "takeaway" && pickup
      ? istDateTime(pickup.date, pickup.start_time)
      : new Date(now + settings.prep_time_minutes * 60_000);
  const estimatedDelivery = area ? new Date(estimatedReady.getTime() + area.estimated_minutes * 60_000) : null;

  const { data: order, error } = await db().rpc("create_order_with_items", {
    p_order: {
      customer_id: input.userId,
      idempotency_key: input.idempotency_key,
      fulfillment: input.fulfillment,
      subtotal: quote.subtotal,
      discount_amount: quote.discount_amount,
      delivery_fee: quote.delivery_fee,
      packaging_charge: quote.packaging_charge,
      tax_amount: quote.tax_amount,
      total_amount: quote.total_amount,
      coupon_id: quote.coupon?.id ?? null,
      coupon_code: quote.coupon?.code ?? null,
      special_instructions: input.special_instructions ?? null,
      delivery_address: address
        ? {
            label: address.label,
            full_name: address.full_name,
            phone: address.phone,
            house: address.house,
            street: address.street,
            area: address.area,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            delivery_instructions: address.delivery_instructions,
            latitude: address.latitude ?? null,
            longitude: address.longitude ?? null,
          }
        : null,
      serviceable_area_id: area?.id ?? null,
      delivery_mode: input.fulfillment === "delivery" ? settings.delivery_mode_default : null,
      pickup_slot_id: pickup?.slot_id ?? null,
      pickup_date: pickup?.date ?? null,
      pickup_time: pickup?.start_time ?? null,
      customer_name: name,
      customer_phone: phone,
      customer_email: input.email ?? profile?.email ?? null,
      estimated_ready_at: estimatedReady.toISOString(),
      estimated_delivery_at: estimatedDelivery?.toISOString() ?? null,
      payment_due_at: new Date(now + settings.payment_window_minutes * 60_000).toISOString(),
    },
    p_items: quote.lines,
  });
  if (error) {
    if (error.message.includes("SLOT_FULL") || error.message.includes("SLOT_UNAVAILABLE"))
      throw new HttpError(409, "That pickup slot just filled up. Please choose another time.", "SLOT_FULL");
    if (error.code === "23505") return resumePayment(input.userId, (await findByKey(input.userId, input.idempotency_key))!);
    throw error;
  }
  const created = order as Order;

  if (input.payment_method === "upi") {
    // Direct UPI to the restaurant's UPI ID: verified by staff after the
    // customer submits the transaction reference (UTR).
    const { data: payment, error: payErr } = await db()
      .from("payments")
      .insert({ order_id: created.id, provider: "upi", provider_order_id: `upi_${created.id}`, amount: created.total_amount, currency: "INR", method: "upi" })
      .select("*")
      .single();
    if (payErr) throw payErr;
    return sessionFor(created, payment as Payment);
  }

  try {
    const rzp = await createRazorpayOrder({
      amountPaise: toPaise(created.total_amount),
      receipt: created.order_number,
      notes: { order_id: created.id, order_number: created.order_number },
    });
    if (rzp.amount !== toPaise(created.total_amount)) throw new Error("Razorpay amount mismatch");
    const { data: payment, error: payErr } = await db()
      .from("payments")
      .insert({ order_id: created.id, provider_order_id: rzp.id, amount: created.total_amount, currency: "INR" })
      .select("*")
      .single();
    if (payErr) throw payErr;
    return sessionFor(created, payment as Payment);
  } catch (err) {
    await db().rpc("transition_order_status", {
      p_order_id: created.id,
      p_to: "expired",
      p_actor_role: "system",
      p_note: "Could not start payment",
    });
    console.error("[placeOrder] payment init failed", err);
    throw new HttpError(502, "We could not start the payment. Please try again in a moment.", "PAYMENT_INIT_FAILED");
  }
}

async function findByKey(userId: string, key: string) {
  const { data } = await db().from("orders").select("id").eq("customer_id", userId).eq("idempotency_key", key).maybeSingle();
  return data?.id as string | undefined;
}

/** Re-open checkout for an unpaid order (Razorpay orders accept multiple attempts). */
export async function resumePayment(userId: string, orderId: string): Promise<PaymentSession> {
  const { data: order } = await db().from("orders").select("*").eq("id", orderId).eq("customer_id", userId).maybeSingle();
  if (!order) throw new HttpError(404, "Order not found.");
  const o = order as Order;
  if (!["pending_payment", "payment_failed"].includes(o.status)) {
    throw new HttpError(409, "This order no longer needs payment.", "NOT_PAYABLE");
  }
  if (new Date(o.payment_due_at).getTime() < Date.now()) {
    throw new HttpError(409, "The payment window for this order has closed. Please place a new order.", "PAYMENT_WINDOW_CLOSED");
  }
  const { data: payment } = await db()
    .from("payments")
    .select("*")
    .eq("order_id", o.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!payment) throw new HttpError(409, "Payment session missing. Please place a new order.");
  if (o.status === "payment_failed") {
    await db().rpc("transition_order_status", { p_order_id: o.id, p_to: "pending_payment", p_actor_id: userId, p_actor_role: "customer", p_note: "Payment retried" });
  }
  return sessionFor(o, payment as Payment);
}

// ---------------------------------------------------------------------------
// Status transitions (authorization is the caller's job)
// ---------------------------------------------------------------------------

export async function transitionOrder(orderId: string, to: OrderStatus, actor: { id: string | null; role: string }, note?: string) {
  const { data, error } = await db().rpc("transition_order_status", {
    p_order_id: orderId,
    p_to: to,
    p_actor_id: actor.id,
    p_actor_role: actor.role,
    p_note: note ?? null,
  });
  if (error) {
    if (error.message.includes("ILLEGAL_TRANSITION")) throw new HttpError(409, "This order cannot move to that status from its current state.", "ILLEGAL_TRANSITION");
    if (error.message.includes("ORDER_NOT_FOUND")) throw new HttpError(404, "Order not found.");
    throw error;
  }
  const finalStatus = data as OrderStatus;
  after(() => dispatchOrderNotifications(orderId, finalStatus));
  if (to === "rejected" || to === "cancelled") {
    after(() => refundOrder(orderId, actor.id).catch((e) => console.error("[auto-refund]", e)));
  }
  return finalStatus;
}

/** Full refund for a cancelled/rejected order with a captured payment. Idempotent. */
export async function refundOrder(orderId: string, actorId: string | null) {
  const { data: order } = await db().from("orders").select("id, status, order_number").eq("id", orderId).single();
  if (!order) throw new HttpError(404, "Order not found.");
  if (!["cancelled", "rejected"].includes(order.status)) {
    throw new HttpError(409, "Only cancelled or rejected orders can be refunded.", "NOT_REFUNDABLE");
  }
  const { data: payment } = await db().from("payments").select("*").eq("order_id", orderId).eq("status", "captured").maybeSingle();
  if (!payment) return null; // nothing captured (already refunded or never paid)
  const p = payment as Payment;
  if (p.provider === "upi") {
    // Money is in the restaurant's own UPI account: refund is sent manually
    // from the UPI app, then marked done in Admin → order → "Mark refunded".
    await db().from("payments").update({ status: "refund_pending", failure_reason: "Send the refund from your UPI app, then mark it refunded." }).eq("id", p.id);
    await db().from("audit_logs").insert({ actor_id: actorId, action: "payment.refund_due_manual_upi", entity: "order", entity_id: orderId, details: { amount: p.amount, utr: p.provider_payment_id } });
    return { id: "manual-upi", status: "pending" as const };
  }
  const refund = await refundPayment(
    p.provider_payment_id!,
    toPaise(p.amount),
    { order_number: order.order_number },
    `refund-${p.id}`,
  );
  await db()
    .from("payments")
    .update({
      status: refund.status === "processed" ? "refunded" : "refund_pending",
      refund_id: refund.id,
      refunded_amount: refund.status === "processed" ? p.amount : 0,
      refunded_at: refund.status === "processed" ? new Date().toISOString() : null,
    })
    .eq("id", p.id);
  await db().from("audit_logs").insert({
    actor_id: actorId,
    action: "payment.refund_initiated",
    entity: "order",
    entity_id: orderId,
    details: { refund_id: refund.id, amount: p.amount, status: refund.status },
  });
  return refund;
}

export function newIdempotencyKey() {
  return crypto.randomUUID().replace(/-/g, "");
}
