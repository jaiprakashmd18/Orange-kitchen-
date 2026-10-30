import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteArea, saveArea } from "../settings/actions";
import type { ServiceableArea } from "@/lib/types";

export const metadata = { title: "Delivery areas" };

function AreaFields({ a }: { a?: ServiceableArea }) {
  return (
    <div className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-8">
      {a && <input type="hidden" name="id" value={a.id} />}
      <label className="lg:col-span-2"><span className="label">Area name</span><input name="name" defaultValue={a?.name} className="input" placeholder="Surapet" required /></label>
      <label><span className="label">Pincode</span><input name="pincode" defaultValue={a?.pincode} className="input" inputMode="numeric" maxLength={6} required /></label>
      <label><span className="label">Fee ₹</span><input name="delivery_fee" type="number" step="0.01" min={0} defaultValue={a?.delivery_fee} className="input" required /></label>
      <label><span className="label">Free above ₹</span><input name="free_delivery_above" type="number" step="0.01" min={0} defaultValue={a?.free_delivery_above ?? ""} className="input" /></label>
      <label><span className="label">Min order ₹</span><input name="min_order_amount" type="number" step="0.01" min={0} defaultValue={a?.min_order_amount ?? 0} className="input" /></label>
      <label><span className="label">ETA (min)</span><input name="estimated_minutes" type="number" min={5} max={240} defaultValue={a?.estimated_minutes ?? 45} className="input" /></label>
      <div className="flex items-center gap-3 pb-2">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="is_active" defaultChecked={a?.is_active ?? true} className="accent-brand-600" /> Active</label>
        <SubmitButton className="btn-primary btn-sm">{a ? "Save" : "Add"}</SubmitButton>
      </div>
    </div>
  );
}

export default async function AreasPage() {
  await requireRole(["admin"], "/admin/delivery-areas");
  const supabase = await createClient();
  const { data } = await supabase.from("serviceable_areas").select("*").order("pincode").order("name");
  const areas = (data ?? []) as ServiceableArea[];
  return (
    <div className="space-y-6">
      <PageHeader title="Delivery areas & charges" description="Customers can choose home delivery only for these pincodes. Takeaway never has a delivery fee." />
      <section className="card p-5">
        <h2 className="mb-3 font-sans font-bold">Add area</h2>
        <ActionForm action={saveArea} resetOnSuccess><AreaFields /></ActionForm>
      </section>
      {areas.length === 0 ? <p className="text-sm text-charcoal-500">No delivery areas yet — home delivery will be unavailable until you add one.</p> : areas.map((a) => (
        <section key={a.id} className="card p-5">
          <ActionForm action={saveArea}><AreaFields a={a} /></ActionForm>
          <ActionForm action={deleteArea} confirmMessage="Delete this area?" className="mt-1"><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-ghost btn-sm text-chilli">Delete</SubmitButton></ActionForm>
        </section>
      ))}
    </div>
  );
}
