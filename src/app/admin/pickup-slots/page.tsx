import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DAY_NAMES, formatClock } from "@/lib/format";
import { generateSlots, updateSlot } from "../settings/actions";
import type { PickupSlot } from "@/lib/types";

export const metadata = { title: "Pickup slots" };

export default async function SlotsPage() {
  await requireRole(["admin"], "/admin/pickup-slots");
  const supabase = await createClient();
  const { data } = await supabase.from("pickup_slots").select("*").order("day_of_week").order("start_time");
  const slots = (data ?? []) as PickupSlot[];
  return (
    <div className="space-y-6">
      <PageHeader title="Takeaway pickup slots" description="Customers choose one of these times for today or tomorrow. Each slot has a maximum number of orders." />
      <section className="card p-5">
        <h2 className="mb-3 font-sans font-bold">Create slots</h2>
        <ActionForm action={generateSlots} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <label key={d} className="flex items-center gap-1.5 rounded-full border border-charcoal/15 px-3 py-1.5 text-sm"><input type="checkbox" name="days" value={d} className="accent-brand-600" /> {DAY_NAMES[d].slice(0, 3)}</label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label><span className="label">From</span><input type="time" name="start" required className="input" /></label>
            <label><span className="label">Until</span><input type="time" name="end" required className="input" /></label>
            <label><span className="label">Slot length (min)</span><input type="number" name="interval" defaultValue={30} min={10} max={240} className="input w-28" /></label>
            <label><span className="label">Orders per slot</span><input type="number" name="max_orders" defaultValue={10} min={1} max={500} className="input w-28" /></label>
            <SubmitButton>Create slots</SubmitButton>
          </div>
        </ActionForm>
      </section>
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const day = slots.filter((s) => s.day_of_week === d);
        if (!day.length) return null;
        return (
          <section key={d} className="card p-5">
            <h2 className="mb-3 font-sans font-bold">{DAY_NAMES[d]}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {day.map((s) => (
                <ActionForm key={s.id} action={updateSlot} className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm ${s.is_active ? "border-charcoal/10" : "border-dashed border-charcoal/20 opacity-60"}`}>
                  <input type="hidden" name="id" value={s.id} />
                  <span className="w-36 font-semibold">{formatClock(s.start_time)}–{formatClock(s.end_time)}</span>
                  <input type="number" name="max_orders" defaultValue={s.max_orders} min={1} max={500} className="input w-20 py-1.5" aria-label="Max orders" />
                  <label className="flex items-center gap-1"><input type="checkbox" name="is_active" defaultChecked={s.is_active} className="accent-brand-600" /> On</label>
                  <SubmitButton className="btn-ghost btn-sm">Save</SubmitButton>
                  <button name="delete" value="1" className="btn-ghost btn-sm text-chilli">✕</button>
                </ActionForm>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
