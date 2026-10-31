import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, serviceRoleKey } from "@/lib/env";
import { open, seal } from "@/lib/crypto-box";

// Runtime integration settings. Each value comes from an environment
// variable if set (wins), otherwise from the encrypted app_secrets table that
// the owner fills in at Admin → Integrations. Cached briefly per instance.

export const SECRET_KEYS = {
  razorpay_key_id: "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  razorpay_key_secret: "RAZORPAY_KEY_SECRET",
  razorpay_webhook_secret: "RAZORPAY_WEBHOOK_SECRET",
  smtp_host: "SMTP_HOST",
  smtp_port: "SMTP_PORT",
  smtp_user: "SMTP_USER",
  smtp_pass: "SMTP_PASS",
  smtp_sender_email: "SMTP_SENDER_EMAIL",
  smtp_sender_name: "SMTP_SENDER_NAME",
  resend_api_key: "RESEND_API_KEY",
  email_from: "EMAIL_FROM",
  whatsapp_access_token: "WHATSAPP_ACCESS_TOKEN",
  whatsapp_phone_number_id: "WHATSAPP_PHONE_NUMBER_ID",
  whatsapp_order_template: "WHATSAPP_ORDER_TEMPLATE",
  whatsapp_template_lang: "WHATSAPP_TEMPLATE_LANG",
  pexels_api_key: "PEXELS_API_KEY",
  pixabay_api_key: "PIXABAY_API_KEY",
  supabase_access_token: "SUPABASE_ACCESS_TOKEN",
} as const;

export type SecretKey = keyof typeof SECRET_KEYS;
export type Config = Record<SecretKey, string> & { source: Partial<Record<SecretKey, "env" | "admin">> };

let cache: { at: number; value: Config } | null = null;
const TTL = 30_000;

export function invalidateConfig() {
  cache = null;
}

export async function getConfig(): Promise<Config> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const stored: Partial<Record<SecretKey, string>> = {};
  if (isSupabaseConfigured && serviceRoleKey()) {
    try {
      const { data } = await createAdminClient().from("app_secrets").select("key, value_encrypted");
      for (const row of data ?? []) {
        if (row.key in SECRET_KEYS) {
          const v = open(row.value_encrypted);
          if (v !== null) stored[row.key as SecretKey] = v;
        }
      }
    } catch {
      /* table not created yet */
    }
  }
  const value = { source: {} } as Config;
  for (const k of Object.keys(SECRET_KEYS) as SecretKey[]) {
    const env = process.env[SECRET_KEYS[k]];
    if (env) {
      value[k] = env;
      value.source[k] = "env";
    } else if (stored[k]) {
      value[k] = stored[k]!;
      value.source[k] = "admin";
    } else value[k] = "";
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Saves values (empty string = delete). Env-provided keys cannot be overridden here. */
export async function saveSecrets(values: Partial<Record<SecretKey, string>>, userId: string | null) {
  const db = createAdminClient();
  for (const [k, v] of Object.entries(values) as [SecretKey, string | undefined][]) {
    if (v === undefined || process.env[SECRET_KEYS[k]]) continue;
    if (v === "") {
      const { error } = await db.from("app_secrets").delete().eq("key", k);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("app_secrets").upsert({ key: k, value_encrypted: seal(v), updated_by: userId, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
  }
  invalidateConfig();
}

export async function getIntegrationStatus() {
  const c = await getConfig();
  const smtp = Boolean(c.smtp_host && c.smtp_user && c.smtp_pass);
  return {
    supabase: isSupabaseConfigured && Boolean(serviceRoleKey()),
    razorpay: Boolean(c.razorpay_key_id && c.razorpay_key_secret),
    razorpayWebhook: Boolean(c.razorpay_webhook_secret),
    razorpayMode: c.razorpay_key_id.startsWith("rzp_live_") ? ("live" as const) : ("test" as const),
    smtp,
    email: smtp || Boolean(c.resend_api_key && c.email_from),
    whatsapp: Boolean(c.whatsapp_access_token && c.whatsapp_phone_number_id && c.whatsapp_order_template),
    pexels: Boolean(c.pexels_api_key),
    pixabay: Boolean(c.pixabay_api_key),
    supabaseToken: Boolean(c.supabase_access_token),
    cron: Boolean(process.env.CRON_SECRET),
  };
}

export const mask = (v: string) => (!v ? "" : v.length <= 8 ? "••••" : `${v.slice(0, 4)}••••${v.slice(-4)}`);
