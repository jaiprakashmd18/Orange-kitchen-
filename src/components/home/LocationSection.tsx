import { Icon } from "@/components/ui/Icon";
import { DAY_NAMES, formatClock, formatPhone, nowInIST, telHref, whatsappHref } from "@/lib/format";
import { fullAddress, mapsLink } from "@/lib/data";
import { isOpenAt } from "@/lib/schedule";
import type { HolidayClosure, OperatingHour, RestaurantSettings } from "@/lib/types";

export function LocationSection({ settings, hours, holidays, id = "visit" }: { settings: RestaurantSettings; hours: OperatingHour[]; holidays: HolidayClosure[]; id?: string }) {
  const today = nowInIST().dayOfWeek;
  const open = hours.length > 0 ? isOpenAt(hours, holidays, new Date()) : null;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const embed =
    settings.google_maps_embed_url ??
    `https://www.google.com/maps?q=${encodeURIComponent(`${settings.name}, ${fullAddress(settings)}`)}&output=embed`;

  return (
    <section id={id} className="section bg-white" aria-labelledby={`${id}-title`}>
      <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="eyebrow">Visit &amp; contact</p>
          <h2 id={`${id}-title`} className="mt-2 text-4xl">Find us in Surapet</h2>
          <address className="mt-6 flex gap-3 not-italic text-lg leading-relaxed">
            <Icon name="pin" className="mt-1 h-5 w-5 shrink-0 text-brand-600" />
            <span>{fullAddress(settings)}</span>
          </address>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={mapsLink(settings)} target="_blank" rel="noopener noreferrer" className="btn-primary">
              <Icon name="navigation" className="h-4 w-4" /> Get directions
            </a>
            {settings.phone && (
              <a href={telHref(settings.phone)} className="btn-secondary">
                <Icon name="phone" className="h-4 w-4" /> {formatPhone(settings.phone)}
              </a>
            )}
            {settings.whatsapp && (
              <a href={whatsappHref(settings.whatsapp)} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <Icon name="whatsapp" className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>

          <div className="mt-10 rounded-2xl bg-cream p-6">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-sans text-base font-bold">
                <Icon name="clock" className="h-5 w-5 text-brand-600" /> Opening hours
              </h3>
              {open !== null && (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${open ? "bg-leaf-50 text-leaf" : "bg-chilli-50 text-chilli"}`}>
                  {open ? "Open now" : "Closed now"}
                </span>
              )}
            </div>
            {hours.length === 0 ? (
              <p className="mt-3 text-sm text-charcoal-500">Timings will be listed here soon. Please call us to check today&apos;s hours.</p>
            ) : (
              <dl className="mt-4 divide-y divide-charcoal/5 text-sm">
                {order.map((d) => {
                  const slots = hours.filter((h) => h.day_of_week === d);
                  return (
                    <div key={d} className={`flex justify-between gap-4 py-2 ${d === today ? "font-bold text-charcoal" : "text-charcoal-700"}`}>
                      <dt>{DAY_NAMES[d]}</dt>
                      <dd className="text-right">
                        {slots.length
                          ? slots.map((s) => `${s.label ? s.label + " " : ""}${formatClock(s.open_time)} – ${formatClock(s.close_time)}`).join(" · ")
                          : "Closed"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl shadow-card ring-1 ring-charcoal/5">
          <iframe
            title={`Map showing ${settings.name}`}
            src={embed}
            className="h-[360px] w-full sm:h-[480px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
