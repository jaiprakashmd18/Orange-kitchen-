import type { Metadata } from "next";
import { getHours, getSettings } from "@/lib/data";
import { LocationSection } from "@/components/home/LocationSection";
import { ContactForm } from "./ContactForm";
import { Icon } from "@/components/ui/Icon";
import { formatPhone, telHref, whatsappHref } from "@/lib/format";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Contact Orange Kitchen, Shop 32, Pillaiyar Koil Street, Surapet Service Road, Chennai 600066. Call, WhatsApp or send us a message.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const [settings, { hours, holidays }] = await Promise.all([getSettings(), getHours()]);
  return (
    <>
      <section className="container-page grid gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="mt-3 text-5xl">We&apos;d love to hear from you</h1>
          <p className="mt-4 text-lg text-charcoal-500">Questions about an order, bulk orders or feedback — reach us any way you like.</p>
          <ul className="mt-8 space-y-4">
            {settings.phone && (
              <li>
                <a href={telHref(settings.phone)} className="card flex items-center gap-4 p-4 hover:ring-1 hover:ring-brand-500">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Icon name="phone" /></span>
                  <span><span className="block text-xs text-charcoal-500">Call</span><span className="font-bold">{formatPhone(settings.phone)}</span></span>
                </a>
              </li>
            )}
            {settings.whatsapp && (
              <li>
                <a href={whatsappHref(settings.whatsapp, "Hi Orange Kitchen!")} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-4 p-4 hover:ring-1 hover:ring-brand-500">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-50 text-leaf"><Icon name="whatsapp" /></span>
                  <span><span className="block text-xs text-charcoal-500">WhatsApp</span><span className="font-bold">{formatPhone(settings.whatsapp)}</span></span>
                </a>
              </li>
            )}
            {settings.email && (
              <li>
                <a href={`mailto:${settings.email}`} className="card flex items-center gap-4 p-4 hover:ring-1 hover:ring-brand-500">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Icon name="mail" /></span>
                  <span><span className="block text-xs text-charcoal-500">Email</span><span className="font-bold">{settings.email}</span></span>
                </a>
              </li>
            )}
          </ul>
        </div>
        <ContactForm />
      </section>
      <LocationSection settings={settings} hours={hours} holidays={holidays} id="map" />
    </>
  );
}
