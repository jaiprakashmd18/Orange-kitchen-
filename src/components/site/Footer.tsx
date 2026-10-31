import Link from "next/link";
import { Logo } from "./Logo";
import { Icon } from "@/components/ui/Icon";
import { DAY_NAMES, formatClock, formatPhone, telHref, whatsappHref } from "@/lib/format";
import { fullAddress, mapsLink } from "@/lib/data";
import type { OperatingHour, RestaurantSettings } from "@/lib/types";

const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", x: "X", google: "Google", zomato: "Zomato", swiggy: "Swiggy" };

export function Footer({ settings, hours }: { settings: RestaurantSettings; hours: OperatingHour[] }) {
  const socials = Object.entries(settings.social_links ?? {}).filter(([, url]) => Boolean(url));
  const days = [1, 2, 3, 4, 5, 6, 0];
  return (
    <footer className="mt-16 bg-charcoal pb-28 text-white/80 md:pb-0">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo logoUrl={settings.logo_url} name={settings.name} light />
          <p className="mt-4 font-display text-lg text-brand-300">{settings.tagline}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/60">Homely taste · Everyday delights</p>
          {socials.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-3">
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold hover:border-brand-400 hover:text-white">
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-sans text-sm font-bold uppercase tracking-widest text-white">Visit us</h2>
          <address className="mt-4 not-italic leading-relaxed">{fullAddress(settings)}</address>
          <a href={mapsLink(settings)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-300 hover:text-brand-200">
            <Icon name="pin" className="h-4 w-4" /> Get directions
          </a>
        </div>

        <div>
          <h2 className="font-sans text-sm font-bold uppercase tracking-widest text-white">Contact</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {settings.phone && (
              <li>
                <a href={telHref(settings.phone)} className="inline-flex items-center gap-2 hover:text-white">
                  <Icon name="phone" className="h-4 w-4" /> {formatPhone(settings.phone)}
                </a>
              </li>
            )}
            {settings.whatsapp && (
              <li>
                <a href={whatsappHref(settings.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white">
                  <Icon name="whatsapp" className="h-4 w-4" /> WhatsApp us
                </a>
              </li>
            )}
            {settings.email && (
              <li>
                <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-2 hover:text-white">
                  <Icon name="mail" className="h-4 w-4" /> {settings.email}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-sm font-bold uppercase tracking-widest text-white">Opening hours</h2>
          {hours.length === 0 ? (
            <p className="mt-4 text-sm">Please call us for today&apos;s timings.</p>
          ) : (
            <ul className="mt-4 space-y-1.5 text-sm">
              {days.map((d) => {
                const slots = hours.filter((h) => h.day_of_week === d);
                return (
                  <li key={d} className="flex justify-between gap-3">
                    <span>{DAY_NAMES[d].slice(0, 3)}</span>
                    <span className="text-right text-white">
                      {slots.length ? slots.map((s) => `${formatClock(s.open_time)}–${formatClock(s.close_time)}`).join(", ") : "Closed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings.name}, Chennai. All prices in INR.
            {settings.fssai_license && <> · FSSAI Lic. {settings.fssai_license}</>}
            {settings.gstin && <> · GSTIN {settings.gstin}</>}
          </p>
          <nav className="flex flex-wrap gap-4" aria-label="Legal">
            <Link href="/policies#cancellation" className="hover:text-white">Cancellation &amp; Refunds</Link>
            <Link href="/policies#terms" className="hover:text-white">Terms</Link>
            <Link href="/policies#privacy" className="hover:text-white">Privacy</Link>
            <Link href="/credits" className="hover:text-white">Photo credits</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
