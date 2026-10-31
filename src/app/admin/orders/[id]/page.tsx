import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { VegMark } from "@/components/ui/VegMark";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";
import { getOrderDetail } from "@/lib/order-queries";
import { createClient } from "@/lib/supabase/server";
import { getRoles } from "@/lib/auth";
import { STATUS_LABEL, STATUS_TONE, staffNextActions } from "@/lib/order-status";
import { formatClock, formatDate, formatDateTime, formatINR, formatPhone, telHref, whatsappHref } from "@/lib/format";
import { providerStatus } from "@/lib/delivery/providers";
import { assignOwnDelivery, assignThirdParty, markUpiRefunded, retryRefund, updateOrderStatus, verifyUpiPayment } from "../actions";
import type { DeliveryPersonnel, DeliveryProvider } from "@/lib/types";

export const metadata = { title: "Order detail" };

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, items, history, payment, assignment } = detail;
  const supabase = await createClient();
  const [{ data: riders }, { data: providers }, { data: events }, roles] = await Promise.all([
    supabase.from("delivery_personnel").select("*").eq("is_active", true).order("is_on_duty", { ascending: false }).order("full_name"),
    supabase.from("delivery_providers").select("*").eq("is_active", true).order("name"),
    supabase.from("delivery_events").select("*").eq("order_id", id).order("created_at"),
    getRoles(),
  ]);
  const actions = staffNextActions(order.fulfillment, order.status);
  const canAssign = order.fulfillment === "delivery" && ["accepted", "preparing", "ready", "delivery_assigned"].includes(order.status);
  const a = order.delivery_address;
  const refundable = ["cancelled", "rejected"].includes(order.status) && payment?.status === "captured";

  return (
    <div>
      <RealtimeRefresher orderId={order.id} />
      <PageHeader
        title={`Order #${order.order_number}`}
        description={<>Placed {formatDateTime(order.created_at)} · <Link href="/admin/orders" className="link">All orders</Link></>}
        actions={<><Badge tone={STATUS_TONE[order.status]} className="px-3 py-1 text-sm">{STATUS_LABEL[order.status]}</Badge><Badge className="px-3 py-1 text-sm">{order.fulfillment === "delivery" ? "Delivery" : "Takeaway"}</Badge></>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {payment?.provider === "upi" && payment.status === "verification_pending" && (
            <section className="card border-2 border-brand-400 p-5">
              <h2 className="font-sans font-bold">Verify UPI payment</h2>
              <p className="mt-1 text-sm text-charcoal-700">
                Open your UPI app (GPay Business / bank app) and look for <strong>{formatINR(payment.amount)}</strong> with transaction ID{" "}
                <strong className="font-mono">{payment.provider_payment_id}</strong>
                {payment.submitted_at && <> (submitted {formatDateTime(payment.submitted_at)})</>}.
              </p>
              <div className="mt-4 flex flex-wrap items-start gap-3">
                <ActionForm action={verifyUpiPayment}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="decision" value="received" />
                  <SubmitButton>✓ Payment received</SubmitButton>
                </ActionForm>
                <ActionForm action={verifyUpiPayment} className="flex flex-wrap items-start gap-2" confirmMessage="Mark this payment as NOT received? The customer will be asked to check their transaction ID.">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="decision" value="not_received" />
                  <input name="reason" maxLength={200} className="input w-64 py-2" placeholder="Reason (optional)" />
                  <SubmitButton className="btn-danger">Not received</SubmitButton>
                </ActionForm>
              </div>
            </section>
          )}
          {actions.length > 0 && (
            <section className="card p-5">
              <h2 className="font-sans font-bold">Next step</h2>
              <div className="mt-3 flex flex-wrap items-start gap-3">
                {actions.filter((x) => x.tone === "primary").map((x) => (
                  <ActionForm key={x.to} action={updateOrderStatus}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="to" value={x.to} />
                    <SubmitButton>{x.label}</SubmitButton>
                  </ActionForm>
                ))}
              </div>
              {actions.some((x) => x.tone === "danger") && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-chilli">Reject / cancel this order</summary>
                  {actions.filter((x) => x.tone === "danger").map((x) => (
                    <ActionForm key={x.to} action={updateOrderStatus} className="mt-3 flex flex-wrap items-end gap-2" confirmMessage="This will notify the customer and refund the full amount. Continue?">
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="to" value={x.to} />
                      <label className="flex-1">
                        <span className="label">Reason shown to customer</span>
                        <input name="note" required maxLength={300} className="input" placeholder="e.g. Item unavailable today" />
                      </label>
                      <SubmitButton className="btn-danger">{x.label}</SubmitButton>
                    </ActionForm>
                  ))}
                </details>
              )}
            </section>
          )}

          {order.fulfillment === "delivery" && (
            <section className="card p-5">
              <h2 className="font-sans font-bold">Delivery</h2>
              {assignment ? (
                <div className="mt-3 rounded-xl bg-cream p-4 text-sm">
                  {assignment.mode === "own" ? (
                    <p>Own delivery: <strong>{assignment.delivery_personnel?.full_name}</strong> · <a href={telHref(assignment.delivery_personnel?.phone)} className="link">{formatPhone(assignment.delivery_personnel?.phone)}</a></p>
                  ) : (
                    <p>
                      Partner: <strong>{assignment.delivery_providers?.name}</strong> · Ref {assignment.external_reference ?? "—"}
                      {assignment.external_rider_name && <> · Rider {assignment.external_rider_name} {assignment.external_rider_phone}</>}
                      {assignment.external_tracking_url && <> · <a href={assignment.external_tracking_url} target="_blank" rel="noopener noreferrer" className="link">Tracking</a></>}
                      {assignment.quoted_fee !== null && <> · Fee {formatINR(assignment.quoted_fee)}</>}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-charcoal-500">Assigned {formatDateTime(assignment.assigned_at)} · status {assignment.status.replace(/_/g, " ")}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-charcoal-500">Not assigned yet.</p>
              )}
              {canAssign && (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <ActionForm action={assignOwnDelivery} className="rounded-xl border border-charcoal/10 p-4">
                    <p className="mb-2 text-sm font-bold">{assignment ? "Reassign to" : "Assign"} Orange Kitchen rider</p>
                    <input type="hidden" name="order_id" value={order.id} />
                    {(riders ?? []).length === 0 ? (
                      <p className="text-sm text-charcoal-500">No active riders. <Link href="/admin/delivery-team" className="link">Add one</Link></p>
                    ) : (
                      <div className="flex gap-2">
                        <select name="personnel_id" className="input" required defaultValue="">
                          <option value="" disabled>Choose rider</option>
                          {((riders ?? []) as DeliveryPersonnel[]).map((r) => (
                            <option key={r.id} value={r.id}>{r.full_name}{r.is_on_duty ? " · on duty" : ""}</option>
                          ))}
                        </select>
                        <SubmitButton>Assign</SubmitButton>
                      </div>
                    )}
                  </ActionForm>
                  <ActionForm action={assignThirdParty} className="space-y-2 rounded-xl border border-charcoal/10 p-4">
                    <p className="text-sm font-bold">Use a third-party partner</p>
                    <input type="hidden" name="order_id" value={order.id} />
                    <select name="provider_id" className="input" required defaultValue="">
                      <option value="" disabled>Choose partner</option>
                      {((providers ?? []) as DeliveryProvider[]).map((p) => {
                        const st = providerStatus(p);
                        return <option key={p.id} value={p.id}>{p.name} — {st.apiActive ? "API active" : "manual"}</option>;
                      })}
                    </select>
                    <input name="external_reference" className="input" placeholder="Booking reference (manual)" maxLength={80} />
                    <input name="external_tracking_url" className="input" placeholder="Tracking link https://… (optional)" maxLength={300} />
                    <div className="grid grid-cols-3 gap-2">
                      <input name="external_rider_name" className="input" placeholder="Rider name" maxLength={80} />
                      <input name="external_rider_phone" className="input" placeholder="Rider phone" maxLength={15} />
                      <input name="quoted_fee" className="input" placeholder="Fee ₹" inputMode="decimal" />
                    </div>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="use_api" value="1" className="accent-brand-600" /> Book through the partner&apos;s API (only if API is active)</label>
                    <SubmitButton className="btn-secondary">Save partner booking</SubmitButton>
                  </ActionForm>
                </div>
              )}
              {(events ?? []).length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-charcoal-500">
                  {(events ?? []).map((e) => <li key={e.id}>{formatDateTime(e.created_at)} · {e.source} · {e.event_type}</li>)}
                </ul>
              )}
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-sans font-bold">Items</h2>
            <ul className="mt-3 divide-y divide-charcoal/5 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex gap-2 py-2">
                  <VegMark veg={i.is_veg} className="mt-0.5" />
                  <span className="flex-1 font-medium">{i.quantity} × {i.item_name}{i.selected_options.length > 0 && <span className="block text-xs text-charcoal-500">{i.selected_options.map((o) => `${o.group}: ${o.choice}`).join(" · ")}</span>}</span>
                  <span>{formatINR(i.line_total)}</span>
                </li>
              ))}
            </ul>
            {order.special_instructions && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><strong>Kitchen note:</strong> {order.special_instructions}</p>}
            <dl className="mt-3 space-y-1 border-t border-dashed border-charcoal/15 pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
              {order.discount_amount > 0 && <div className="flex justify-between"><dt>Discount ({order.coupon_code})</dt><dd>− {formatINR(order.discount_amount)}</dd></div>}
              {order.packaging_charge > 0 && <div className="flex justify-between"><dt>Packaging</dt><dd>{formatINR(order.packaging_charge)}</dd></div>}
              {order.delivery_fee > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.delivery_fee)}</dd></div>}
              {order.tax_amount > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{formatINR(order.tax_amount)}</dd></div>}
              <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatINR(order.total_amount)}</dd></div>
            </dl>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5 text-sm">
            <h2 className="font-sans font-bold">Customer</h2>
            <p className="mt-2 font-semibold">{order.customer_name}</p>
            <p>
              <a href={telHref(order.customer_phone)} className="link">{formatPhone(order.customer_phone)}</a>
              {" · "}<a href={whatsappHref(order.customer_phone, `Hi, this is Orange Kitchen about order ${order.order_number}`)} target="_blank" rel="noopener noreferrer" className="link">WhatsApp</a>
            </p>
            {order.customer_email && <p className="text-charcoal-500">{order.customer_email}</p>}
            {order.fulfillment === "delivery" && a ? (
              <address className="mt-3 not-italic">
                <span className="font-semibold">Deliver to:</span> {a.full_name}, {formatPhone(a.phone)}<br />
                {[a.house, a.street, a.area, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                {a.delivery_instructions && <span className="block text-charcoal-500">Note: {a.delivery_instructions}</span>}
              </address>
            ) : (
              <p className="mt-3"><span className="font-semibold">Pickup:</span> {formatDate(order.pickup_date)} at {formatClock(order.pickup_time)}</p>
            )}
          </section>

          <section className="card p-5 text-sm">
            <h2 className="font-sans font-bold">Payment</h2>
            {payment ? (
              <dl className="mt-2 space-y-1">
                <div className="flex justify-between"><dt>Status</dt><dd className="font-semibold uppercase">{payment.status.replace("_", " ")}</dd></div>
                <div className="flex justify-between"><dt>Amount</dt><dd>{formatINR(payment.amount)}</dd></div>
                <div className="flex justify-between"><dt>Method</dt><dd className="uppercase">{payment.method ?? "—"}</dd></div>
                <div className="flex justify-between gap-2"><dt>Via</dt><dd className="font-semibold">{payment.provider === "upi" ? "Direct UPI" : "Razorpay"}</dd></div>
                {payment.provider !== "upi" && <div className="flex justify-between gap-2"><dt>Razorpay order</dt><dd className="truncate font-mono text-xs">{payment.provider_order_id}</dd></div>}
                <div className="flex justify-between gap-2"><dt>{payment.provider === "upi" ? "UPI transaction ID" : "Payment ID"}</dt><dd className="truncate font-mono text-xs">{payment.provider_payment_id ?? "—"}</dd></div>
                {payment.refund_id && <div className="flex justify-between gap-2"><dt>Refund</dt><dd className="font-mono text-xs">{payment.refund_id}</dd></div>}
                {payment.failure_reason && <p className="text-chilli">{payment.failure_reason}</p>}
              </dl>
            ) : <p className="mt-2 text-charcoal-500">No payment record.</p>}
            {payment?.provider === "upi" && payment.status === "refund_pending" && roles.includes("admin") && (
              <ActionForm action={markUpiRefunded} className="mt-3 space-y-2">
                <p className="text-amber-900">Send {formatINR(payment.amount)} back to the customer from your UPI app, then record it here.</p>
                <input type="hidden" name="order_id" value={order.id} />
                <input name="refund_ref" maxLength={40} className="input py-2" placeholder="Refund transaction ID (optional)" />
                <SubmitButton className="btn-secondary btn-sm">Mark refunded</SubmitButton>
              </ActionForm>
            )}
            {refundable && payment?.provider !== "upi" && roles.includes("admin") && (
              <ActionForm action={retryRefund} className="mt-3" confirmMessage="Issue a full refund via Razorpay?">
                <input type="hidden" name="order_id" value={order.id} />
                <SubmitButton className="btn-danger btn-sm">Process refund</SubmitButton>
              </ActionForm>
            )}
          </section>

          <section className="card p-5 text-sm">
            <h2 className="font-sans font-bold">History</h2>
            <ol className="mt-3 space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-3">
                  <span><strong>{STATUS_LABEL[h.to_status]}</strong>{h.note && <span className="block text-xs text-charcoal-500">{h.note}</span>}</span>
                  <span className="whitespace-nowrap text-xs text-charcoal-500">{formatDateTime(h.created_at)}<span className="block text-right">{h.actor_role}</span></span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
