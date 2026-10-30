// Centralised, validated access to environment variables.
// Server-only secrets must never be imported into client components.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Explicit URL wins; on Vercel the production domain is detected automatically.
  siteUrl: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, ""),
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
};

export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
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
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappTemplateName: process.env.WHATSAPP_ORDER_TEMPLATE ?? "",
  whatsappTemplateLang: process.env.WHATSAPP_TEMPLATE_LANG ?? "en",
};

export const integrationStatus = () => ({
  supabase: isSupabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  razorpay: Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  razorpayWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  razorpayMode: (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "").startsWith("rzp_live_") ? "live" : "test",
  email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  whatsapp: Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ORDER_TEMPLATE,
  ),
  cron: Boolean(process.env.CRON_SECRET),
});
