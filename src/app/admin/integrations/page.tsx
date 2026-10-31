import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { getConfig, getIntegrationStatus, mask, type SecretKey } from "@/lib/config";
import { publicEnv } from "@/lib/env";
import { savePexels, saveEmail, saveRazorpay, saveSupabaseToken, saveWhatsApp, sendTestEmail } from "./actions";

export const metadata = { title: "Integrations" };
export const maxDuration = 60;

function Status({ on, label }: { on: boolean; label?: string }) {
  return <Badge tone={on ? "success" : "neutral"}>{on ? `● ${label ?? "Connected"}` : "Not connected"}</Badge>;
}

function Card({ title, status, children, help }: { title: string; status: React.ReactNode; children: React.ReactNode; help: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-lg font-bold">{title}</h2>
        {status}
      </div>
      <div className="mt-2 text-sm text-charcoal-500">{help}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function IntegrationsPage() {
  await requireRole(["admin"], "/admin/integrations");
  const [c, st] = await Promise.all([getConfig(), getIntegrationStatus()]);
  const locked = (k: SecretKey) => c.source[k] === "env";
  const field = (k: SecretKey, label: string, opts: { secret?: boolean; placeholder?: string; type?: string } = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        name={k}
        type={opts.type ?? (opts.secret ? "password" : "text")}
        autoComplete="off"
        className="input"
        disabled={locked(k)}
        defaultValue={opts.secret ? "" : c[k]}
        placeholder={locked(k) ? "Set in Vercel" : opts.secret && c[k] ? `Saved (${mask(c[k])}) — leave blank to keep` : opts.placeholder}
      />
    </label>
  );
  const Remove = ({ action, show }: { action: typeof saveRazorpay; show: boolean }) =>
    show ? (
      <ActionForm action={action} confirmMessage="Disconnect this integration?">
        <input type="hidden" name="remove" value="1" />
        <SubmitButton className="btn-ghost btn-sm text-chilli">Disconnect</SubmitButton>
      </ActionForm>
    ) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect services by pasting their keys. Every key is tested before saving and stored encrypted. Nothing to set up in Vercel."
      />

      <Card
        title="📧 Email — Gmail"
        status={<Status on={st.smtp} label={c.smtp_user || "Connected"} />}
        help={
          <ol className="list-decimal space-y-1 pl-5">
            <li>In your Google Account, turn on <strong>2-Step Verification</strong> (myaccount.google.com → Security).</li>
            <li>Open <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="link">myaccount.google.com/apppasswords</a>, name it “Orange Kitchen”, click Create.</li>
            <li>Paste your Gmail address and the 16-letter password below.</li>
          </ol>
        }
      >
        <ActionForm action={saveEmail} className="grid gap-3 sm:grid-cols-2">
          {field("smtp_user", "Gmail address", { placeholder: "orangekitchen@gmail.com", type: "email" })}
          {field("smtp_pass", "App Password (16 letters)", { secret: true, placeholder: "abcd efgh ijkl mnop" })}
          {field("smtp_sender_name", "Sender name", { placeholder: "Orange Kitchen" })}
          <details className="text-sm sm:col-span-2">
            <summary className="cursor-pointer text-charcoal-500">Not Gmail? Other email provider</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {field("smtp_host", "SMTP server", { placeholder: "smtp.gmail.com" })}
              {field("smtp_port", "Port", { placeholder: "465" })}
            </div>
          </details>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <SubmitButton pendingLabel="Testing…">Test &amp; save</SubmitButton>
          </div>
        </ActionForm>
        <div className="mt-3 flex flex-wrap gap-2">
          {st.smtp && (
            <ActionForm action={sendTestEmail}>
              <SubmitButton className="btn-secondary btn-sm">Send me a test email</SubmitButton>
            </ActionForm>
          )}
          <Remove action={saveEmail} show={c.source.smtp_user === "admin"} />
        </div>
      </Card>

      <Card
        title="🔐 Login emails & links — Supabase token"
        status={<Status on={st.supabaseToken} />}
        help={
          <>
            Makes sign-up and password-reset links open <strong>this website</strong>, and sends those emails from your Gmail. Create a token at{" "}
            <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer" className="link">supabase.com/dashboard/account/tokens</a> → “Generate new token”, then paste it.
          </>
        }
      >
        <ActionForm action={saveSupabaseToken} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">{field("supabase_access_token", "Supabase access token", { secret: true, placeholder: "sbp_..." })}</div>
          <SubmitButton pendingLabel="Connecting…">{st.supabaseToken ? "Re-apply settings" : "Connect"}</SubmitButton>
        </ActionForm>
        <div className="mt-2"><Remove action={saveSupabaseToken} show={c.source.supabase_access_token === "admin"} /></div>
      </Card>

      <Card
        title="💳 Razorpay — cards, UPI, net banking (optional)"
        status={<Status on={st.razorpay} label={st.razorpay ? `${st.razorpayMode.toUpperCase()} mode` : undefined} />}
        help={
          <>
            Automatic payment confirmation. Get keys at <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="link">Razorpay → Account &amp; Settings → API Keys</a>.
            Start with <strong>Test mode</strong> keys. Not needed if you only use UPI to your own UPI ID (Settings).
          </>
        }
      >
        <ActionForm action={saveRazorpay} className="grid gap-3 sm:grid-cols-2">
          {field("razorpay_key_id", "Key ID", { placeholder: "rzp_test_..." })}
          {field("razorpay_key_secret", "Key Secret", { secret: true })}
          <div className="sm:col-span-2">
            {field("razorpay_webhook_secret", "Webhook secret (optional)", { secret: true })}
            <p className="hint">Webhook URL for Razorpay: <code>{publicEnv.siteUrl}/api/webhooks/razorpay</code></p>
          </div>
          <div className="sm:col-span-2"><SubmitButton pendingLabel="Checking keys…">Test &amp; save</SubmitButton></div>
        </ActionForm>
        <div className="mt-2"><Remove action={saveRazorpay} show={c.source.razorpay_key_id === "admin"} /></div>
      </Card>

      <Card
        title="💬 WhatsApp order updates (optional)"
        status={<Status on={st.whatsapp} />}
        help={<>Needs a Meta WhatsApp Business (Cloud API) account and an approved message template with 3 variables: order number, status, tracking link.</>}
      >
        <ActionForm action={saveWhatsApp} className="grid gap-3 sm:grid-cols-2">
          {field("whatsapp_access_token", "Access token", { secret: true })}
          {field("whatsapp_phone_number_id", "Phone number ID")}
          {field("whatsapp_order_template", "Template name", { placeholder: "order_update" })}
          {field("whatsapp_template_lang", "Template language", { placeholder: "en" })}
          <div className="sm:col-span-2"><SubmitButton pendingLabel="Checking…">Test &amp; save</SubmitButton></div>
        </ActionForm>
        <div className="mt-2"><Remove action={saveWhatsApp} show={c.source.whatsapp_access_token === "admin"} /></div>
      </Card>

      <Card
        title="📷 Better dish photos — Pexels (optional)"
        status={<Status on={st.pexels} />}
        help={<>Free key from <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" className="link">pexels.com/api</a>. Without it, automatic photos come from Wikimedia Commons.</>}
      >
        <ActionForm action={savePexels} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">{field("pexels_api_key", "Pexels API key", { secret: true })}</div>
          <SubmitButton pendingLabel="Checking…">Test &amp; save</SubmitButton>
        </ActionForm>
        <div className="mt-2"><Remove action={savePexels} show={c.source.pexels_api_key === "admin"} /></div>
      </Card>
    </div>
  );
}
