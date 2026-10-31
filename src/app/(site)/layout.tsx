import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCartBar } from "@/components/site/MobileCartBar";
import { getSettings, getHours, fullAddress } from "@/lib/data";
import { getRoles, getSessionUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { DAY_NAMES } from "@/lib/format";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, { hours }, user, roles] = await Promise.all([getSettings(), getHours(), getSessionUser(), getRoles()]);

  // Restaurant / LocalBusiness structured data for local search.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${publicEnv.siteUrl}/#restaurant`,
    name: settings.name,
    slogan: settings.tagline,
    url: publicEnv.siteUrl,
    logo: settings.logo_url ?? `${publicEnv.siteUrl}/brand/logo-256.png`,
    image: [settings.logo_url ?? `${publicEnv.siteUrl}/brand/logo-256.png`, `${publicEnv.siteUrl}/brand/og.jpg`],
    telephone: settings.phone ?? undefined,
    email: settings.email ?? undefined,
    servesCuisine: ["South Indian", "Seafood", "Vegetarian"],
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "UPI, Credit Card, Debit Card, Net Banking",
    hasMenu: `${publicEnv.siteUrl}/menu`,
    acceptsReservations: false,
    address: {
      "@type": "PostalAddress",
      streetAddress: [settings.address_line1, settings.address_line2].filter(Boolean).join(", "),
      addressLocality: settings.city ?? "Chennai",
      addressRegion: settings.state ?? "Tamil Nadu",
      postalCode: settings.pincode ?? undefined,
      addressCountry: "IN",
    },
    ...(settings.latitude && settings.longitude
      ? { geo: { "@type": "GeoCoordinates", latitude: settings.latitude, longitude: settings.longitude } }
      : {}),
    ...(hours.length
      ? {
          openingHoursSpecification: hours.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: `https://schema.org/${DAY_NAMES[h.day_of_week]}`,
            opens: h.open_time.slice(0, 5),
            closes: h.close_time.slice(0, 5),
          })),
        }
      : {}),
    sameAs: Object.values(settings.social_links ?? {}).filter(Boolean),
    description: `${settings.name} — ${fullAddress(settings)}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Header logoUrl={settings.logo_url} name={settings.name} announcement={settings.announcement} signedIn={Boolean(user)} roles={roles} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer settings={settings} hours={hours} />
      <MobileCartBar />
    </>
  );
}
