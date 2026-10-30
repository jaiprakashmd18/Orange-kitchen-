import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrderDetail } from "@/lib/order-queries";
import { getSettings, fullAddress, mapsLink } from "@/lib/data";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { RealtimeRefresher } from "@/components/orders/RealtimeRefresher";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";
import { formatINR, formatPhone, telHref, whatsappHref } from "@/lib/format";
import { riderAdvance } from "../actions";

const STEP: Record<string, { to: string; label: string }> = {
  delivery_assigned: { to: "picked_up", label: "Picked up from restaurant" },
  picked_up: { to: "out_for_delivery", label: "Start delivery (out for delivery)" },
  out_for_delivery: { to: "delivered", label: "Mark as delivered" },
};

export default async function RiderOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireRole(["delivery"], `/delivery/${id}`);
  const detail = await getOrderDetail(id); // RLS: only visible if assigned to this rider
  if (!detail) notFound();
  const { order, items, payment, assignment } = detail;
  const supabase = await createClient();
  const { data: me } = await supabase.from("delivery_personnel").select("id").eq("user_id", user.id).maybeSingle();
  if (!assignment || assignment.personnel_id !== me?.id) notFound();
  const settings = await getSettings();
  const a = order.delivery_address!;
  const dest = [a.house, a.street, a.area, a.landmark, a.city, a.pincode].filter(Boolean).join(", ");
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  const step = STEP[order.status];
  const paid = payment?.status === "captured";

  return (
    <div className="space-y-4">
      <RealtimeRefresher orderId={order.id} />
      <Link href="/delivery" className="text-sm text-charcoal-500">← Assigned orders</Link>
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-2xl font-bold">#{order.order_number}</h1>
        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
      </div>

      <section className={`rounded-2xl p-4 text-sm font-semibold ${paid ? "bg-leaf-50 text-leaf" : "bg-chilli-50 text-chilli"}`}>
        {paid ? `✓ Prepaid online · ${formatINR(order.total_amount)} — do NOT collect cash` : "⚠ Payment not verified — contact the restaurant before delivering"}
      </section>

      {step ? (
        <ActionForm action={riderAdvance} confirmMessage={step.to === "delivered" ? "Confirm the order was handed to the customer?" : undefined}>
          <input type="hidden" name="order_id" value={order.id} />
          <input type="hidden" name="to" value={step.to} />
          <SubmitButton className="btn-primary w-full py-4 text-base">{step.label}</SubmitButton>
        </ActionForm>
      ) : ["accepted", "preparing", "ready"].includes(order.status) ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">The kitchen is preparing this order. You can pick it up once it&apos;s marked ready.</p>
      ) : null}

      <section className="card p-4">
        <h2 className="font-sans font-bold">Customer</h2>
        <p className="mt-1 text-lg font-semibold">{a.full_name}</p>
        <p className="text-sm">{dest}</p>
        {a.delivery_instructions && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Instructions: {a.delivery_instructions}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a href={telHref(a.phone)} className="btn-secondary"><Icon name="phone" className="h-4 w-4" /> Call</a>
          <a href={whatsappHref(a.phone, `Hi, I'm delivering your Orange Kitchen order ${order.order_number}.`)} target="_blank" rel="noopener noreferrer" className="btn-secondary">WhatsApp</a>
          <a href={nav} target="_blank" rel="noopener noreferrer" className="btn-primary"><Icon name="navigation" className="h-4 w-4" /> Navigate</a>
        </div>
        <p className="mt-2 text-xs text-charcoal-500">{formatPhone(a.phone)}</p>
      </section>

      <section className="card p-4">
        <h2 className="font-sans font-bold">Items ({items.reduce((n, i) => n + i.quantity, 0)})</h2>
        <ul className="mt-2 text-sm">{items.map((i) => <li key={i.id}>{i.quantity} × {i.item_name}{i.selected_options.length > 0 && <span className="text-charcoal-500"> ({i.selected_options.map((o) => o.choice).join(", ")})</span>}</li>)}</ul>
      </section>

      <section className="card p-4 text-sm">
        <h2 className="font-sans font-bold">Pickup from</h2>
        <p className="mt-1">{fullAddress(settings)}</p>
        <a href={mapsLink(settings)} target="_blank" rel="noopener noreferrer" className="link">Restaurant directions</a>
        {settings.phone && <p className="mt-2">Restaurant: <a href={telHref(settings.phone)} className="link">{formatPhone(settings.phone)}</a></p>}
      </section>
    </div>
  );
}
