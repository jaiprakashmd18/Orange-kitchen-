import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrderDetail } from "@/lib/order-queries";
import { getSettings, fullAddress } from "@/lib/data";
import { formatDateTime, formatINR, formatPhone } from "@/lib/format";
import { PrintButton } from "@/components/orders/PrintButton";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/orders/${id}/receipt`);
  const [detail, s] = await Promise.all([getOrderDetail(id), getSettings()]);
  if (!detail || !detail.payment || !["captured", "refunded", "refund_pending", "partially_refunded"].includes(detail.payment.status)) notFound();
  const { order, items, payment } = detail;
  return (
    <div className="container-page max-w-2xl py-10">
      <div className="no-print mb-6 flex justify-end"><PrintButton /></div>
      <article className="card p-8 print:shadow-none print:ring-0">
        <header className="flex flex-wrap justify-between gap-4 border-b border-charcoal/10 pb-6">
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logo_url ?? "/brand/logo-256.png"} alt="" className="h-16 w-16 object-contain" />
              <p className="font-display text-2xl font-bold"><span className="text-brand-600">ORANGE</span> KITCHEN</p>
            </div>
            <p className="mt-1 text-xs text-charcoal-500">{fullAddress(s)}</p>
            {s.phone && <p className="text-xs text-charcoal-500">{formatPhone(s.phone)}</p>}
            {s.gstin && <p className="text-xs text-charcoal-500">GSTIN: {s.gstin}</p>}
            {s.fssai_license && <p className="text-xs text-charcoal-500">FSSAI: {s.fssai_license}</p>}
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">Payment receipt</p>
            <p>#{order.order_number}</p>
            <p className="text-charcoal-500">{formatDateTime(payment!.captured_at ?? order.paid_at ?? order.created_at)}</p>
          </div>
        </header>
        <p className="mt-6 text-sm">Billed to: <strong>{order.customer_name}</strong> · {formatPhone(order.customer_phone)}{order.customer_email && ` · ${order.customer_email}`}</p>
        <table className="table-base mt-6">
          <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.item_name}{i.selected_options.length > 0 && <span className="block text-xs text-charcoal-500">{i.selected_options.map((o) => o.choice).join(", ")}</span>}</td>
                <td className="text-right">{i.quantity}</td>
                <td className="text-right">{formatINR(i.unit_price)}</td>
                <td className="text-right">{formatINR(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
          {order.discount_amount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {formatINR(order.discount_amount)}</dd></div>}
          {order.packaging_charge > 0 && <div className="flex justify-between"><dt>Packaging</dt><dd>{formatINR(order.packaging_charge)}</dd></div>}
          {order.delivery_fee > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.delivery_fee)}</dd></div>}
          {order.tax_amount > 0 && <div className="flex justify-between"><dt>{s.tax_label}{s.prices_include_tax ? " (incl.)" : ""}</dt><dd>{formatINR(order.tax_amount)}</dd></div>}
          <div className="flex justify-between border-t border-charcoal/10 pt-2 text-base font-bold"><dt>Total paid</dt><dd>{formatINR(order.total_amount)}</dd></div>
        </dl>
        <p className="mt-6 text-xs text-charcoal-500">
          {payment!.provider === "upi" ? "Paid by UPI" : "Paid online via Razorpay"}{payment!.provider !== "upi" && payment!.method ? ` (${payment!.method})` : ""} · {payment!.provider === "upi" ? "UPI transaction ID" : "Payment ID"} {payment!.provider_payment_id}
          {payment!.status !== "captured" && ` · Refund status: ${payment!.status.replace("_", " ")}`}
        </p>
        <p className="mt-2 text-xs text-charcoal-500">This is a payment receipt for your online order{s.gstin ? "" : " and not a tax invoice"}.</p>
      </article>
    </div>
  );
}
