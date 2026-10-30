import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, integrationStatus } from "@/lib/env";

export const metadata: Metadata = { title: "Setup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Shown only until Supabase is connected (there is no admin to protect it yet).
// Lists which environment variables are present — never their values.
const GROUPS: { title: string; required: boolean; keys: { name: string; help: string }[] }[] = [
  {
    title: "Supabase (required)",
    required: true,
    keys: [
      { name: "NEXT_PUBLIC_SUPABASE_URL", help: "Supabase → Project Settings → API → Project URL" },
      { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", help: "Supabase → Project Settings → API → anon public key" },
      { name: "SUPABASE_SERVICE_ROLE_KEY", help: "Supabase → Project Settings → API → service_role key (secret)" },
      { name: "SUPABASE_DB_URL", help: "Supabase → Connect → Session pooler connection string (with your DB password)" },
      { name: "SUPABASE_ACCESS_TOKEN", help: "supabase.com/dashboard/account/tokens — lets setup configure login emails & redirects" },
    ],
  },
  {
    title: "Admin login (required)",
    required: true,
    keys: [
      { name: "ADMIN_EMAIL", help: "Owner's email — becomes the first admin" },
      { name: "ADMIN_PASSWORD", help: "At least 10 characters; change it after first login" },
    ],
  },
  {
    title: "Razorpay (required for orders)",
    required: true,
    keys: [
      { name: "NEXT_PUBLIC_RAZORPAY_KEY_ID", help: "Razorpay → Account & Settings → API Keys (rzp_test_… first)" },
      { name: "RAZORPAY_KEY_SECRET", help: "Shown once when you generate the key" },
      { name: "RAZORPAY_WEBHOOK_SECRET", help: "Optional — Razorpay → Webhooks; payments are auto-reconciled without it" },
    ],
  },
  {
    title: "Notifications (optional)",
    required: false,
    keys: [
      { name: "RESEND_API_KEY", help: "resend.com → API Keys" },
      { name: "EMAIL_FROM", help: 'e.g. "Orange Kitchen <orders@yourdomain.in>" (verified domain)' },
      { name: "WHATSAPP_ACCESS_TOKEN", help: "Meta WhatsApp Cloud API permanent token" },
      { name: "WHATSAPP_PHONE_NUMBER_ID", help: "Meta → WhatsApp → API setup" },
      { name: "WHATSAPP_ORDER_TEMPLATE", help: "Approved template name ({{1}} order, {{2}} status, {{3}} link)" },
    ],
  },
];

export default function SetupPage() {
  const integ = integrationStatus();
  if (isSupabaseConfigured && integ.supabase) redirect("/admin");
  return (
    <main className="min-h-dvh bg-cream px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Orange Kitchen</p>
        <h1 className="mt-2 text-4xl">Finish setup by adding your keys</h1>
        <p className="mt-3 text-charcoal-700">
          Add these as <strong>Environment Variables</strong> in Vercel (Project → Settings → Environment Variables), or in <code>.env.local</code> when running locally, then
          <strong> redeploy</strong>. The database, admin account and login settings are set up automatically during the build.
        </p>
        <div className="mt-8 space-y-6">
          {GROUPS.map((g) => (
            <section key={g.title} className="card p-5">
              <h2 className="font-sans text-lg font-bold">{g.title}</h2>
              <ul className="mt-3 divide-y divide-charcoal/5">
                {g.keys.map((k) => {
                  const set = Boolean(process.env[k.name]);
                  return (
                    <li key={k.name} className="flex items-start gap-3 py-2.5 text-sm">
                      <span className={set ? "text-leaf" : g.required ? "text-chilli" : "text-charcoal-400"} aria-label={set ? "set" : "missing"}>{set ? "✓" : "○"}</span>
                      <span>
                        <code className="font-semibold">{k.name}</code>
                        <span className="block text-charcoal-500">{k.help}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-charcoal-500">Full guide: docs/SETUP.md in the repository.</p>
      </div>
    </main>
  );
}
