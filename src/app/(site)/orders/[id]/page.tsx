import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrderDetail } from "@/lib/order-queries";
import { reconcileOrder } from "@/lib/maintenance";
import { getSettings, fullAddress, mapsLink } from "@/lib/data";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";
import { formatClock, formatDate, formatDateTime, formatINR, formatPhone, formatTime, telHref } from "@/lib/format";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";
import { PendingPaymentPoller } from "@/components/orders/PendingPaymentPoller";
import { CancelOrderButton, RetryPaymentButton } from "@/components/orders/OrderActions";
import { ReviewForm } from "@/components/orders/ReviewForm";
import { Badge } from "@/components/ui/Badge";
import { VegMark } from "@/components/ui/VegMark";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Track order", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<string, string> = {
  created: "Awaiting payment",
  authorized: "Authorised",
  captured: "Paid",
  failed: "Failed",
  refund_pending: "Refund initiated",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; payment?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/orders/${id}`);
  const settings = await getSettings();
  let detail = await getOrderDetail(id);
  if (!detail) notFound();
  // Unpaid order: ask Razorpay directly so a lost callback/webhook still confirms it.
  if (detail.order.customer_id === user.id && ["pending_payment", "payment_failed", "expired"].includes(detail.order.status)) {
    await reconcileOrder(detail.order.id).catch((e) => console.error("[reconcile]", e));
    detail = (await getOrderDetail(id)) ?? detail;
  }
  const { order, items, history, payment, assignment, review } = detail;
  const isOwner = order.customer_id === user.id;
  const unpaid = ["pending_payment", "payment_failed"].includes(order.status) && new Date(order.payment_due_at) > new Date();
  const a = order.delivery_address;

  return (
    <div className="container-page py-10 sm:py-14">
      <RealtimeRefresher orderId={order.id} />
      {isOwner && order.status === "pending_payment" && <PendingPaymentPoller />}
      {sp.placed && order.status === "pending_payment" && (
        <div className="mb-6 rounded-2xl bg-brand-50 px-5 py-4 text-sm text-brand-800" role="status">
          We&apos;re confirming your payment with the bank. This page will update automatically.
        </div>
      )}
      {sp.placed && order.status === "payment_confirmed" && (
        <div className="mb-6 rounded-2xl bg-leaf-50 px-5 py-4 text-sm text-leaf" role="status">
          🎉 Payment received! Your order has been sent to the Orange Kitchen team.
        </div>
      )}
      {sp.payment === "dismissed" && unpaid && (
        <div className="mb-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900" role="status">
          Payment was not completed. Your order is saved — complete payment below before {formatTime(order.payment_due_at)}.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-charcoal-500">Order</p>
          <h1 className="text-4xl">#{order.order_number}</h1>
          <p className="mt-1 text-sm text-charcoal-500">Placed {formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[order.status]} className="px-3 py-1 text-sm">{STATUS_LABEL[order.status]}</Badge>
          <Badge tone="neutral" className="px-3 py-1 text-sm">{order.fulfillment === "delivery" ? "Home delivery" : "Takeaway"}</Badge>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-6" aria-labelledby="progress">
            <h2 id="progress" className="font-sans text-lg font-bold">Order status</h2>
            {["rejected", "cancelled", "expired"].includes(order.status) ? (
              <div className="mt-4 rounded-2xl bg-chilli-50 p-4 text-sm text-chilli">
                <p className="font-bold">{STATUS_LABEL[order.status]}</p>
                {order.cancellation_reason && <p className="mt-1">{order.cancellation_reason}</p>}
                {payment && ["refund_pending", "refunded"].includes(payment.status) && (
                  <p className="mt-2 text-charcoal-700">Refund of {formatINR(payment.amount)}: {PAYMENT_LABEL[payment.status]}. It usually reaches your account in 5–7 business days.</p>
                )}
                {order.status === "expired" && <p className="mt-1 text-charcoal-700">No payment was taken. <Link href="/menu" className="link">Order again</Link></p>}
              </div>
            ) : (
              <>
                {(order.status === "payment_failed" || unpaid) && (
                  <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">{order.status === "payment_failed" ? "Your last payment attempt failed." : "Waiting for payment."}</p>
                    <p className="mt-1">The kitchen will start once payment is confirmed. Complete payment before {formatTime(order.payment_due_at)}.</p>
                    {isOwner && unpaid && <div className="mt-3"><RetryPaymentButton orderId={order.id} restaurantName={settings.name} logo={settings.logo_url} /></div>}
                  </div>
                )}
                <div className="mt-6">
                  <OrderTimeline fulfillment={order.fulfillment} status={order.status} history={history} createdAt={order.created_at} />
                </div>
                {order.status !== "delivered" && order.status !== "collected" && (order.estimated_delivery_at || order.estimated_ready_at) && (
                  <p className="mt-6 flex items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm">
                    <Icon name="clock" className="h-4 w-4 text-brand-600" />
                    {order.fulfillment === "delivery"
                      ? <>Estimated delivery around <strong>{formatTime(order.estimated_delivery_at ?? order.estimated_ready_at)}</strong></>
                      : <>Pickup slot <strong>{formatDate(order.pickup_date)} · {formatClock(order.pickup_time)}</strong></>}
                  </p>
                )}
              </>
            )}
            {isOwner && order.status === "payment_confirmed" && (
              <div className="mt-6 border-t border-charcoal/5 pt-4">
                <p className="mb-3 text-sm text-charcoal-500">You can cancel for a full refund until the restaurant accepts your order.</p>
                <CancelOrderButton orderId={order.id} />
              </div>
            )}
          </section>

          {order.fulfillment === "delivery" && assignment && (
            <section className="card p-6" aria-labelledby="partner">
              <h2 id="partner" className="font-sans text-lg font-bold">Delivery partner</h2>
              {assignment.mode === "own" && assignment.delivery_personnel ? (
                <div className="mt-3 flex items-center justify-between gap-4">
                  <p><span className="font-semibold">{assignment.delivery_personnel.full_name}</span> <span className="text-sm text-charcoal-500">· Orange Kitchen delivery</span></p>
                  {["delivery_assigned", "picked_up", "out_for_delivery"].includes(order.status) && (
                    <a className="btn-secondary btn-sm" href={telHref(assignment.delivery_personnel.phone)}><Icon name="phone" className="h-4 w-4" /> Call</a>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-sm">
                  <p><span className="font-semibold">{assignment.delivery_providers?.name ?? "Delivery partner"}</span>{assignment.external_rider_name && <> · {assignment.external_rider_name}</>}</p>
                  {assignment.external_tracking_url && (
                    <a href={assignment.external_tracking_url} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-flex items-center gap-1">Track with partner <Icon name="external" className="h-4 w-4" /></a>
                  )}
                </div>
              )}
            </section>
          )}

          {isOwner && ["delivered", "collected"].includes(order.status) && (
            <section className="card p-6" aria-labelledby="review">
              <h2 id="review" className="font-sans text-lg font-bold">Rate your order</h2>
              <div className="mt-3">{review ? <p className="text-sm text-charcoal-500">Thanks — you rated this order {review.rating}/5.</p> : <ReviewForm orderId={order.id} />}</div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-6" aria-labelledby="items">
            <h2 id="items" className="font-sans text-lg font-bold">Items</h2>
            <ul className="mt-3 divide-y divide-charcoal/5 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex gap-2 py-2">
                  <VegMark veg={i.is_veg} className="mt-0.5" />
                  <span className="flex-1">
                    {i.item_name} × {i.quantity}
                    {i.selected_options.length > 0 && <span className="block text-xs text-charcoal-500">{i.selected_options.map((o) => o.choice).join(", ")}</span>}
                  </span>
                  <span>{formatINR(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-dashed border-charcoal/15 pt-3 text-sm">
              <div className="flex justify-between"><dt>Item total</dt><dd>{formatINR(order.subtotal)}</dd></div>
              {order.discount_amount > 0 && <div className="flex justify-between text-leaf"><dt>Discount {order.coupon_code && `(${order.coupon_code})`}</dt><dd>− {formatINR(order.discount_amount)}</dd></div>}
              {order.packaging_charge > 0 && <div className="flex justify-between"><dt>Packaging</dt><dd>{formatINR(order.packaging_charge)}</dd></div>}
              {order.fulfillment === "delivery" && <div className="flex justify-between"><dt>Delivery fee</dt><dd>{Number(order.delivery_fee) === 0 ? "Free" : formatINR(order.delivery_fee)}</dd></div>}
              {order.tax_amount > 0 && <div className="flex justify-between"><dt>{settings.tax_label}</dt><dd>{formatINR(order.tax_amount)}</dd></div>}
              <div className="flex justify-between pt-1 text-base font-bold"><dt>Total</dt><dd>{formatINR(order.total_amount)}</dd></div>
            </dl>
            <p className="mt-3 text-sm">
              Payment: <strong>{payment ? PAYMENT_LABEL[payment.status] : "—"}</strong>
              {payment?.method && <span className="text-charcoal-500"> · {payment.method.toUpperCase()}</span>}
            </p>
            {payment?.status === "captured" || payment?.status === "refunded" ? (
              <Link href={`/orders/${order.id}/receipt`} className="link mt-2 inline-flex items-center gap-1 text-sm"><Icon name="download" className="h-4 w-4" /> Download receipt</Link>
            ) : null}
          </section>

          <section className="card p-6 text-sm" aria-labelledby="where">
            <h2 id="where" className="font-sans text-lg font-bold">{order.fulfillment === "delivery" ? "Delivering to" : "Pickup from"}</h2>
            {order.fulfillment === "delivery" && a ? (
              <address className="mt-2 not-italic text-charcoal-700">
                {a.full_name} · {formatPhone(a.phone)}<br />
                {[a.house, a.street, a.area, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                {a.delivery_instructions && <span className="mt-1 block text-charcoal-500">Note: {a.delivery_instructions}</span>}
              </address>
            ) : (
              <div className="mt-2 text-charcoal-700">
                <p>{fullAddress(settings)}</p>
                <a href={mapsLink(settings)} target="_blank" rel="noopener noreferrer" className="link mt-1 inline-block">Get directions</a>
                {settings.pickup_instructions && <p className="mt-2 text-charcoal-500">{settings.pickup_instructions}</p>}
              </div>
            )}
            {order.special_instructions && <p className="mt-3 text-charcoal-500">Kitchen note: {order.special_instructions}</p>}
            {settings.phone && <p className="mt-4">Need help? <a href={telHref(settings.phone)} className="link">{formatPhone(settings.phone)}</a></p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
