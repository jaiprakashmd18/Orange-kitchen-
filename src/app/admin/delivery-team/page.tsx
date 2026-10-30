import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { getRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatPhone, telHref } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/order-status";
import { createRider, updateRider } from "../team-actions";
import type { DeliveryPersonnel, OrderStatus } from "@/lib/types";

export const metadata = { title: "Delivery team" };

export default async function DeliveryTeamPage() {
  const supabase = await createClient();
  const roles = await getRoles();
  const isAdmin = roles.includes("admin");
  const [{ data: riders }, { data: assignments }] = await Promise.all([
    supabase.from("delivery_personnel").select("*").order("is_active", { ascending: false }).order("full_name"),
    supabase
      .from("delivery_assignments")
      .select("id, personnel_id, status, is_current, assigned_at, delivered_at, orders(id, order_number, status)")
      .eq("mode", "own")
      .order("assigned_at", { ascending: false })
      .limit(200),
  ]);
  type A = { id: string; personnel_id: string; status: string; is_current: boolean; assigned_at: string; delivered_at: string | null; orders: { id: string; order_number: string; status: OrderStatus } };
  const list = (assignments ?? []) as unknown as A[];
  return (
    <div className="space-y-6">
      <PageHeader title="Delivery team" description="Orange Kitchen's own riders. They sign in at /delivery and only see orders assigned to them." />
      {isAdmin && (
        <section className="card p-5">
          <h2 className="mb-3 font-sans font-bold">Add rider</h2>
          <ActionForm action={createRider} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="lg:col-span-2"><span className="label">Full name</span><input name="full_name" required className="input" /></label>
            <label><span className="label">Mobile</span><input name="phone" required inputMode="tel" className="input" /></label>
            <label className="lg:col-span-2"><span className="label">Login email</span><input name="email" type="email" required className="input" /></label>
            <label><span className="label">Vehicle no.</span><input name="vehicle_number" className="input" maxLength={20} /></label>
            <label className="lg:col-span-2"><span className="label">Temporary password</span><input name="password" type="text" minLength={10} className="input" placeholder="Min 10 characters (new accounts)" autoComplete="off" /></label>
            <SubmitButton>Create rider account</SubmitButton>
          </ActionForm>
        </section>
      )}
      {((riders ?? []) as DeliveryPersonnel[]).map((r) => {
        const mine = list.filter((a) => a.personnel_id === r.id);
        const current = mine.filter((a) => a.is_current && !["delivered", "cancelled"].includes(a.status));
        return (
          <section key={r.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-sans text-lg font-bold">{r.full_name}</h2>
                <Badge tone={r.is_active ? (r.is_on_duty ? "success" : "neutral") : "danger"}>{r.is_active ? (r.is_on_duty ? "On duty" : "Off duty") : "Inactive"}</Badge>
              </div>
              <a href={telHref(r.phone)} className="btn-secondary btn-sm">Call {formatPhone(r.phone)}</a>
            </div>
            {isAdmin && (
              <ActionForm action={updateRider} className="mt-3 grid items-end gap-3 sm:grid-cols-5">
                <input type="hidden" name="id" value={r.id} />
                <label><span className="label">Name</span><input name="full_name" defaultValue={r.full_name} className="input" /></label>
                <label><span className="label">Mobile</span><input name="phone" defaultValue={r.phone} className="input" /></label>
                <label><span className="label">Vehicle</span><input name="vehicle_number" defaultValue={r.vehicle_number ?? ""} className="input" /></label>
                <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="is_active" defaultChecked={r.is_active} className="accent-brand-600" /> Active</label>
                <SubmitButton className="btn-secondary">Save</SubmitButton>
              </ActionForm>
            )}
            <div className="mt-4 text-sm">
              <p className="font-semibold">Current: {current.length ? current.map((a) => <Link key={a.id} href={`/admin/orders/${a.orders.id}`} className="link mr-2">#{a.orders.order_number}</Link>) : <span className="font-normal text-charcoal-500">none</span>}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-charcoal-500">Delivery history ({mine.length})</summary>
                <ul className="mt-2 space-y-1">
                  {mine.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 text-xs">
                      <Link href={`/admin/orders/${a.orders.id}`} className="link">#{a.orders.order_number}</Link>
                      <span>{STATUS_LABEL[a.orders.status]}</span>
                      <span className="text-charcoal-500">{formatDateTime(a.delivered_at ?? a.assigned_at)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </section>
        );
      })}
    </div>
  );
}
