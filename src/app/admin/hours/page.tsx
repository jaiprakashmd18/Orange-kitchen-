import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DAY_NAMES, formatClock, formatDate } from "@/lib/format";
import { addHoliday, addHours, deleteHoliday, deleteHours } from "../settings/actions";
import type { HolidayClosure, OperatingHour } from "@/lib/types";

export const metadata = { title: "Hours & holidays" };

function DayPicker() {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <label key={d} className="flex items-center gap-1.5 rounded-full border border-charcoal/15 px-3 py-1.5 text-sm">
          <input type="checkbox" name="days" value={d} className="accent-brand-600" /> {DAY_NAMES[d].slice(0, 3)}
        </label>
      ))}
    </div>
  );
}

export default async function HoursPage() {
  await requireRole(["admin"], "/admin/hours");
  const supabase = await createClient();
  const [{ data: hours }, { data: holidays }] = await Promise.all([
    supabase.from("operating_hours").select("*").order("day_of_week").order("open_time"),
    supabase.from("holiday_closures").select("*").order("closed_on", { ascending: false }).limit(60),
  ]);
  const h = (hours ?? []) as OperatingHour[];
  return (
    <div className="space-y-6">
      <PageHeader title="Opening hours & holidays" description="Delivery orders are accepted only during these hours. Add several windows per day for breakfast/lunch/dinner." />
      <section className="card p-5">
        <h2 className="mb-3 font-sans font-bold">Add opening hours</h2>
        <ActionForm action={addHours} className="space-y-3" resetOnSuccess>
          <DayPicker />
          <div className="flex flex-wrap items-end gap-3">
            <label><span className="label">Opens</span><input type="time" name="open_time" required className="input" /></label>
            <label><span className="label">Closes</span><input type="time" name="close_time" required className="input" /></label>
            <label><span className="label">Label (optional)</span><input name="label" maxLength={40} className="input" placeholder="Breakfast" /></label>
            <SubmitButton>Add</SubmitButton>
          </div>
        </ActionForm>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-sans font-bold">Weekly schedule</h2>
        {h.length === 0 ? <p className="text-sm text-charcoal-500">No hours set — customers see “call us for timings” and delivery is allowed whenever ordering is switched on.</p> : (
          <ul className="divide-y divide-charcoal/5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <li key={d} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-28 font-semibold">{DAY_NAMES[d]}</span>
                {h.filter((x) => x.day_of_week === d).map((x) => (
                  <ActionForm key={x.id} action={deleteHours} className="inline-flex">
                    <input type="hidden" name="id" value={x.id} />
                    <span className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-sm">
                      {x.label && <strong>{x.label}</strong>} {formatClock(x.open_time)} – {formatClock(x.close_time)}
                      <SubmitButton className="text-charcoal-400 hover:text-chilli">✕</SubmitButton>
                    </span>
                  </ActionForm>
                ))}
                {!h.some((x) => x.day_of_week === d) && <span className="text-sm text-charcoal-400">Closed</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-sans font-bold">Holiday closures</h2>
        <ActionForm action={addHoliday} className="flex flex-wrap items-end gap-3" resetOnSuccess>
          <label><span className="label">Date</span><input type="date" name="closed_on" required className="input" /></label>
          <label className="flex-1"><span className="label">Reason (optional)</span><input name="reason" maxLength={160} className="input" placeholder="Pongal holiday" /></label>
          <SubmitButton>Add closure</SubmitButton>
        </ActionForm>
        <ul className="mt-4 space-y-2">
          {((holidays ?? []) as HolidayClosure[]).map((x) => (
            <li key={x.id}>
              <ActionForm action={deleteHoliday} className="flex items-center justify-between rounded-xl bg-cream px-4 py-2 text-sm">
                <input type="hidden" name="id" value={x.id} />
                <span><strong>{formatDate(x.closed_on)}</strong> {x.reason && `· ${x.reason}`}</span>
                <SubmitButton className="btn-ghost btn-sm text-chilli">Remove</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
