import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { getOrderDetail } from "@/lib/order-queries";
import { getSettings } from "@/lib/data";
import { formatINR, formatTime } from "@/lib/format";
import { upiPayLink } from "@/lib/payment-methods";
import { UtrForm } from "@/components/orders/UtrForm";
import { CopyButton } from "@/components/orders/CopyButton";
import { PendingPaymentPoller } from "@/components/orders/PendingPaymentPoller";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";

export const metadata: Metadata = { title: "Pay with UPI", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UpiPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}/pay`);
  const [detail, settings] = await Promise.all([getOrderDetail(id), getSettings()]);
  if (!detail || detail.order.customer_id !== user.id) notFound();
  const { order, payment } = detail;
  if (!payment || payment.provider !== "upi") redirect(`/orders/${id}`);
  if (!["pending_payment", "payment_failed", "expired"].includes(order.status) || payment.status === "captured") redirect(`/orders/${id}?placed=1`);
  if (!settings.upi_id) {
    return <div className="container-page py-16 text-center">UPI payments are not available right now. Please call the restaurant.</div>;
  }

  const amount = Number(order.total_amount);
  const payee = settings.upi_payee_name || settings.name;
  const link = upiPayLink({ upiId: settings.upi_id, payeeName: payee, amount, orderNumber: order.order_number });
  const gpayLink = upiPayLink({ upiId: settings.upi_id, payeeName: payee, amount, orderNumber: order.order_number }, "tez://upi/pay");
  const qr = await QRCode.toString(link, { type: "svg", margin: 1, width: 240, color: { dark: "#2C1408", light: "#FFFFFF" } });
  const waiting = payment.status === "verification_pending";

  return (
    <div className="container-page max-w-xl py-10 sm:py-14">
      <RealtimeRefresher orderId={order.id} />
      {waiting && <PendingPaymentPoller everyMs={8000} maxMs={30 * 60_000} />}
      <p className="text-sm text-charcoal-500">Order #{order.order_number}</p>
      <h1 className="text-4xl">Pay {formatINR(amount)} by UPI</h1>

      {waiting ? (
        <section className="card mt-6 p-6 text-center" role="status">
          <p className="text-4xl" aria-hidden>⏳</p>
          <h2 className="mt-3 text-2xl">Verifying your payment</h2>
          <p className="mt-2 text-sm text-charcoal-700">
            Transaction ID <strong className="font-mono">{payment.provider_payment_id}</strong> received. Orange Kitchen will confirm it shortly — this page updates automatically.
          </p>
          <Link href={`/orders/${order.id}`} className="btn-secondary mt-5">Track order</Link>
          <details className="mt-5 text-left text-sm">
            <summary className="cursor-pointer text-charcoal-500">Entered the wrong ID?</summary>
            <div className="mt-3"><UtrForm orderId={order.id} initial={payment.provider_payment_id} /></div>
          </details>
        </section>
      ) : (
        <>
          {order.status === "payment_failed" && payment.failure_reason && (
            <p className="mt-4 rounded-xl bg-chilli-50 px-4 py-3 text-sm text-chilli">{payment.failure_reason} Please check and submit the correct transaction ID.</p>
          )}
          <ol className="mt-6 space-y-6">
            <li className="card p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Step 1 · Pay</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:hidden">
                <a href={gpayLink} className="btn-primary py-3">Pay with Google Pay</a>
                <a href={link} className="btn-secondary py-3">Other UPI app</a>
              </div>
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="rounded-2xl bg-white p-3 ring-1 ring-charcoal/10" dangerouslySetInnerHTML={{ __html: qr }} aria-label="UPI QR code" role="img" />
                <p className="text-center text-xs text-charcoal-500">Scan with GPay, PhonePe, Paytm or any UPI app</p>
              </div>
              <dl className="mt-4 space-y-2 rounded-xl bg-cream p-4 text-sm">
                <div className="flex items-center justify-between gap-3"><dt>Pay to</dt><dd className="flex items-center gap-2 font-mono font-semibold">{settings.upi_id} <CopyButton value={settings.upi_id} /></dd></div>
                <div className="flex justify-between gap-3"><dt>Name</dt><dd className="font-semibold">{payee}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt>Amount</dt><dd className="flex items-center gap-2 font-semibold">{formatINR(amount)} <CopyButton value={amount.toFixed(2)} /></dd></div>
              </dl>
              <p className="mt-3 text-xs text-charcoal-500">Pay the exact amount. If paying manually, add note “{order.order_number}”.</p>
            </li>
            <li className="card p-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-700">Step 2 · Confirm</p>
              <UtrForm orderId={order.id} />
              <p className="mt-3 text-xs text-charcoal-500">
                Submit before {formatTime(order.payment_due_at)}. Your order goes to the kitchen once the restaurant verifies the payment.
              </p>
            </li>
          </ol>
        </>
      )}
    </div>
  );
}
