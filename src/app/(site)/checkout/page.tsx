import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings, fullAddress, mapsLink } from "@/lib/data";
import { availablePaymentMethods } from "@/lib/payment-methods";
import { CheckoutForm } from "./CheckoutForm";
import type { Address } from "@/lib/types";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const supabase = await createClient();
  const [{ data: addresses }, { data: profile }, settings] = await Promise.all([
    supabase.from("customer_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
    getSettings(),
  ]);
  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="mb-8 text-4xl">Checkout</h1>
      <CheckoutForm
        addresses={(addresses ?? []) as Address[]}
        profile={{ full_name: profile?.full_name ?? null, phone: profile?.phone ?? null }}
        restaurant={{
          name: settings.name,
          logo_url: settings.logo_url,
          address: fullAddress(settings),
          maps: mapsLink(settings),
          delivery_enabled: settings.delivery_enabled,
          takeaway_enabled: settings.takeaway_enabled,
          lat: settings.latitude != null ? Number(settings.latitude) : null,
          lng: settings.longitude != null ? Number(settings.longitude) : null,
        }}
        emailVerified={Boolean(user.email_confirmed_at || user.phone_confirmed_at)}
        paymentMethods={await availablePaymentMethods(settings)}
      />
    </div>
  );
}
