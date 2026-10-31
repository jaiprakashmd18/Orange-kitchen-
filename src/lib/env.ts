// Centralised, validated access to environment variables.
// Server-only secrets must never be imported into client components.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // Classic "anon" key, or the newer "publishable" key name used by the Vercel ↔ Supabase integration.
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  // Explicit URL wins; on Vercel the production domain is detected automatically.
  siteUrl: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, ""),
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
};

/** Server-only: classic service_role key, or the newer "secret" key name. */
export function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

export const serverEnv = {
  get supabaseServiceRoleKey() {
    const key = serviceRoleKey();
    if (!key) throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
    return key;
  },
  get razorpayKeyId() {
    return required("NEXT_PUBLIC_RAZORPAY_KEY_ID");
  },
  get razorpayKeySecret() {
    return required("RAZORPAY_KEY_SECRET");
  },
  get razorpayWebhookSecret() {
    return required("RAZORPAY_WEBHOOK_SECRET");
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpSenderEmail: process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || "",
  smtpSenderName: process.env.SMTP_SENDER_NAME || "Orange Kitchen",
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappTemplateName: process.env.WHATSAPP_ORDER_TEMPLATE ?? "",
  whatsappTemplateLang: process.env.WHATSAPP_TEMPLATE_LANG ?? "en",
};

export const integrationStatus = () => ({
  supabase: isSupabaseConfigured && Boolean(serviceRoleKey()),
  razorpay: Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  razorpayWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  razorpayMode: (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "").startsWith("rzp_live_") ? "live" : "test",
  // Order emails: Resend, or the same SMTP account (e.g. Gmail) used for login emails.
  email: Boolean((process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)),
  smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  whatsapp: Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ORDER_TEMPLATE,
  ),
  cron: Boolean(process.env.CRON_SECRET),
});
