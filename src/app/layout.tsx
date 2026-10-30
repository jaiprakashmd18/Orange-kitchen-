import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import { ServiceWorkerRegister } from "@/components/site/ServiceWorkerRegister";
import { getSessionUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "Orange Kitchen — South Indian Restaurant & Food Delivery in Surapet, Chennai",
    template: "%s · Orange Kitchen, Surapet Chennai",
  },
  description:
    "Orange Kitchen, Surapet, Chennai — freshly prepared South Indian vegetarian and non-vegetarian food. Order online for home delivery or takeaway.",
  applicationName: "Orange Kitchen",
  keywords: [
    "Orange Kitchen Chennai",
    "Orange Kitchen Surapet",
    "Restaurant in Surapet",
    "Food delivery in Surapet",
    "South Indian restaurant Chennai",
    "Breakfast near Surapet",
    "Seafood restaurant in Chennai",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Orange Kitchen",
    title: "Orange Kitchen — Good Food. Great Taste. Delivered Fresh.",
    description: "Freshly prepared South Indian favourites in Surapet, Chennai. Order online for delivery or takeaway.",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Orange Kitchen", statusBarStyle: "default" },
  formatDetection: { telephone: true },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Every page depends on the signed-in session (header, cart sync), so render per request.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#F26B1D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en-IN" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        <CartProvider userId={user?.id ?? null}>{children}</CartProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
