import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { integrationStatus } from "@/lib/env";
import { saveSettings } from "./actions";

export const metadata = { title: "Restaurant settings" };

function Field({ name, label, defaultValue, type = "text", hint, ...rest }: { name: string; label: string; defaultValue?: string | number | null; type?: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} className="input" {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
function Area({ name, label, defaultValue, rows = 3, hint }: { name: string; label: string; defaultValue?: string | null; rows?: number; hint?: string }) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? ""} className="input" />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-brand-600" /> {label}</label>;
}

export default async function SettingsPage() {
  await requireRole(["admin"], "/admin/settings");
  const s = await getSettings();
  const integ = integrationStatus();
  return (
    <div>
      <PageHeader title="Restaurant settings" description="Everything customers see about Orange Kitchen. Changes go live immediately." />
      <ActionForm action={saveSettings} className="grid gap-6 xl:grid-cols-2">
        <section className="card grid gap-4 p-5 xl:col-span-2">
          <h2 className="font-sans font-bold">Online ordering</h2>
          <div className="flex flex-wrap gap-6">
            <Check name="accepting_orders" label="Accepting online orders" defaultChecked={s.accepting_orders} />
            <Check name="delivery_enabled" label="Home delivery" defaultChecked={s.delivery_enabled} />
            <Check name="takeaway_enabled" label="Takeaway / pickup" defaultChecked={s.takeaway_enabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field name="min_order_amount" label="Minimum order (₹)" type="number" step="0.01" min={0} defaultValue={s.min_order_amount} />
            <Field name="packaging_charge" label="Packaging charge per order (₹)" type="number" step="0.01" min={0} defaultValue={s.packaging_charge} />
            <Field name="prep_time_minutes" label="Typical preparation time (min)" type="number" min={5} max={240} defaultValue={s.prep_time_minutes} />
            <Field name="payment_window_minutes" label="Payment window (min)" type="number" min={5} max={120} defaultValue={s.payment_window_minutes} hint="Unpaid orders expire after this." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field name="tax_rate_percent" label="Tax rate (%)" type="number" step="0.01" min={0} max={50} defaultValue={s.tax_rate_percent} hint="As advised by your accountant." />
            <Field name="tax_label" label="Tax label" defaultValue={s.tax_label} />
            <div className="flex items-end pb-3"><Check name="prices_include_tax" label="Menu prices include tax" defaultChecked={s.prices_include_tax} /></div>
            <div>
              <label htmlFor="delivery_mode_default" className="label">Default delivery method</label>
              <select id="delivery_mode_default" name="delivery_mode_default" defaultValue={s.delivery_mode_default} className="input">
                <option value="own">Own delivery team</option>
                <option value="third_party">Third-party partner</option>
              </select>
            </div>
          </div>
          <Area name="pickup_instructions" label="Pickup instructions (shown for takeaway)" defaultValue={s.pickup_instructions} rows={2} />
        </section>

        <section className="card grid gap-4 p-5">
          <h2 className="font-sans font-bold">Brand</h2>
          <ImageUpload name="logo_url" folder="brand" initial={s.logo_url} label="Orange Kitchen logo (upload the official logo file)" />
          <Field name="name" label="Restaurant name" defaultValue={s.name} required />
          <Field name="tagline" label="Tagline" defaultValue={s.tagline} />
          <Field name="announcement" label="Announcement bar (optional)" defaultValue={s.announcement} maxLength={200} />
          <Check name="auto_dish_photos" label="Automatically add representative photos to dishes without one" defaultChecked={s.auto_dish_photos ?? true} />
          <Area name="about_story" label="Our story (About page)" defaultValue={s.about_story} rows={6} hint="Written by the restaurant. Separate paragraphs with a blank line. Leave empty to hide." />
          <Area name="gallery_urls" label="Restaurant photo URLs (one per line)" defaultValue={s.gallery_urls.join("\n")} rows={3} hint="Upload photos via a dish/category image field or Supabase Storage, then paste the links here." />
        </section>

        <section className="card grid gap-4 p-5">
          <h2 className="font-sans font-bold">Contact &amp; location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="phone" label="Phone" defaultValue={s.phone} />
            <Field name="whatsapp" label="WhatsApp number" defaultValue={s.whatsapp} />
          </div>
          <Field name="email" label="Email" type="email" defaultValue={s.email} />
          <Field name="address_line1" label="Address line 1" defaultValue={s.address_line1} />
          <Field name="address_line2" label="Address line 2" defaultValue={s.address_line2} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="city" label="City" defaultValue={s.city} />
            <Field name="state" label="State" defaultValue={s.state} />
            <Field name="pincode" label="Pincode" defaultValue={s.pincode} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="latitude" label="Latitude" type="number" step="0.000001" defaultValue={s.latitude} />
            <Field name="longitude" label="Longitude" type="number" step="0.000001" defaultValue={s.longitude} />
          </div>
          <Field name="google_maps_url" label="Google Maps link" defaultValue={s.google_maps_url} hint="Google Maps → your restaurant → Share → Copy link." />
          <Field name="google_maps_embed_url" label="Google Maps map on website" defaultValue={s.google_maps_embed_url} hint="Google Maps → Share → Embed a map → Copy HTML, and paste the whole code here." />
        </section>

        <section className="card grid gap-4 p-5">
          <h2 className="font-sans font-bold">Social media &amp; delivery apps</h2>
          {(["instagram", "facebook", "youtube", "x", "google", "zomato", "swiggy"] as const).map((k) => (
            <Field
              key={k}
              name={`social_${k}`}
              label={k === "google" ? "Google Business profile" : k === "zomato" ? "Zomato restaurant page" : k === "swiggy" ? "Swiggy restaurant page" : k[0].toUpperCase() + k.slice(1)}
              defaultValue={s.social_links[k]}
              placeholder="https://"
            />
          ))}
        </section>

        <section className="card grid gap-4 p-5">
          <h2 className="font-sans font-bold">Legal &amp; policies</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="gstin" label="GSTIN" defaultValue={s.gstin} />
            <Field name="fssai_license" label="FSSAI licence no." defaultValue={s.fssai_license} />
          </div>
          <Area name="cancellation_policy" label="Cancellation policy" defaultValue={s.cancellation_policy} rows={4} />
          <Area name="refund_policy" label="Refund policy" defaultValue={s.refund_policy} rows={4} />
        </section>

        <section className="card grid gap-4 border-2 border-brand-200 p-5 xl:col-span-2">
          <div>
            <h2 className="font-sans font-bold">UPI payments — GPay, PhonePe, Paytm (direct to your UPI ID)</h2>
            <p className="mt-1 text-sm text-charcoal-500">
              Customers pay straight to your UPI ID using a QR code or the GPay/UPI button, then enter their 12-digit transaction ID. You confirm it in
              <strong> Admin → Orders → “UPI to verify”</strong> after checking your UPI app. No gateway fees. Tip: use a GPay for Business / merchant UPI ID —
              personal IDs can hit daily limits.
            </p>
          </div>
          <Check name="upi_enabled" label="Accept UPI payments to my UPI ID" defaultChecked={s.upi_enabled} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="upi_id" label="Your UPI ID" defaultValue={s.upi_id} placeholder="orangekitchen@okaxis" />
            <Field name="upi_payee_name" label="Name shown in the UPI app" defaultValue={s.upi_payee_name} placeholder="Orange Kitchen" />
          </div>
        </section>

        <section className="card p-5 xl:col-span-2">
          <h2 className="font-sans font-bold">Payment &amp; integrations</h2>
          <p className="mt-1 text-sm text-charcoal-500">Secrets are configured as environment variables on the server (never stored in the database). Current status:</p>
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            <li>{s.upi_enabled && s.upi_id ? "✓" : "✗"} Direct UPI {s.upi_enabled && s.upi_id ? `— ${s.upi_id}` : "(set above)"}</li>
            <li>{integ.razorpay ? "✓" : "✗"} Razorpay (cards / netbanking, optional) {integ.razorpay && <>— <strong>{integ.razorpayMode.toUpperCase()} mode</strong></>}</li>
            <li>{integ.razorpayWebhook ? "✓" : "✗"} Razorpay webhook secret</li>
            <li>{integ.email ? "✓" : "✗"} Order email notifications {integ.smtp ? "(SMTP / Gmail)" : integ.email ? "(Resend)" : "(set SMTP_* or Resend)"}</li>
            <li>{integ.whatsapp ? "✓" : "✗"} WhatsApp Cloud API</li>
            <li>{integ.cron ? "✓" : "✗"} Scheduled jobs (CRON_SECRET)</li>
          </ul>
        </section>

        <div className="xl:col-span-2"><SubmitButton className="btn-primary px-8">Save settings</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
