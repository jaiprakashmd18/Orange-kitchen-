import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrderDetail } from "@/lib/order-queries";
import { formatClock, formatDate, formatINR, formatPhone } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/order-status";
import { AutoPrint } from "./AutoPrint";
import { KotPrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Kitchen ticket", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Kitchen Order Ticket — sized for 58/80 mm thermal printers (also fine on A4). */
export default async function KotPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const { id } = await params;
  const { auto } = await searchParams;
  await requireRole(["admin", "staff"], `/kot/${id}`);
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, items, payment } = detail;
  const a = order.delivery_address;
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(order.paid_at ?? order.created_at));

  return (
    <main className="kot mx-auto bg-white p-3 font-mono text-[13px] leading-snug text-black">
      <style>{`
        @page { size: 80mm auto; margin: 3mm; }
        @media print { body { background: #fff !important; } .no-print { display: none !important; } }
        .kot { width: 76mm; }
        .kot hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
      `}</style>
      {auto === "1" && <AutoPrint />}
      <div className="no-print mb-3 flex gap-2 font-sans">
        <KotPrintButton />
        <a href={`/admin/orders/${order.id}`} className="btn-secondary btn-sm">Back to order</a>
      </div>

      <p className="text-center text-base font-bold">ORANGE KITCHEN</p>
      <p className="text-center text-xs">KITCHEN ORDER TICKET</p>
      <hr />
      <p className="text-center text-2xl font-bold">#{order.order_number.split("-").pop()}</p>
      <p className="text-center text-xs">{order.order_number}</p>
      <p className="mt-1 text-center text-lg font-bold">{order.fulfillment === "delivery" ? "🛵 DELIVERY" : "🛍 TAKEAWAY"}</p>
      {order.fulfillment === "takeaway" && order.pickup_time && (
        <p className="text-center font-bold">PICKUP {formatDate(order.pickup_date)} {formatClock(order.pickup_time)}</p>
      )}
      <p className="text-center text-xs">Paid · {time} · {STATUS_LABEL[order.status]}</p>
      <hr />

      <table className="w-full">
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="align-top">
              <td className="w-8 pr-1 text-lg font-bold">{i.quantity}×</td>
              <td className="pb-1">
                <span className="text-[15px] font-bold">{i.item_name}</span> <span className="text-xs">{i.is_veg ? "(V)" : "(NV)"}</span>
                {i.selected_options.map((o, n) => (
                  <span key={n} className="block text-xs">  - {o.group}: {o.choice}</span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs">Items: {items.reduce((n, i) => n + i.quantity, 0)}</p>

      {order.special_instructions && (
        <>
          <hr />
          <p className="font-bold">NOTE:</p>
          <p className="text-[15px] font-bold">{order.special_instructions}</p>
        </>
      )}
      <hr />
      <p className="font-bold">{order.customer_name}</p>
      <p>{formatPhone(order.customer_phone)}</p>
      {order.fulfillment === "delivery" && a && (
        <>
          <p className="mt-1">{[a.house, a.street, a.area, a.landmark, a.pincode].filter(Boolean).join(", ")}</p>
          {a.delivery_instructions && <p className="text-xs">Delivery note: {a.delivery_instructions}</p>}
        </>
      )}
      <hr />
      <p className="flex justify-between font-bold"><span>TOTAL</span><span>{formatINR(order.total_amount)}</span></p>
      <p className="text-xs">{payment?.status === "captured" ? `PAID ONLINE (${payment.provider === "upi" ? "UPI" : "Razorpay"}) — DO NOT COLLECT CASH` : "PAYMENT NOT CONFIRMED"}</p>
      <hr />
    </main>
  );
}
