import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { providerStatus } from "@/lib/delivery/providers";
import { publicEnv } from "@/lib/env";
import { saveProvider } from "../team-actions";
import type { DeliveryProvider } from "@/lib/types";

export const metadata = { title: "Delivery partners" };

function Fields({ p }: { p?: DeliveryProvider }) {
  return (
    <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <label><span className="label">Partner name</span><input name="name" defaultValue={p?.name} required className="input" /></label>
      <label><span className="label">Code</span><input name="code" defaultValue={p?.code} required className="input" placeholder="porter" /></label>
      <label><span className="label">Integration</span><select name="adapter" defaultValue={p?.adapter ?? "manual"} className="input"><option value="manual">Manual tracking</option><option value="http_generic">HTTP API (generic contract)</option></select></label>
      <label><span className="label">Env var prefix</span><input name="env_prefix" defaultValue={p?.env_prefix ?? ""} className="input uppercase" placeholder="PORTER" /></label>
      <label className="lg:col-span-2"><span className="label">API base URL</span><input name="api_base_url" defaultValue={p?.api_base_url ?? ""} className="input" placeholder="https://" /></label>
      <label className="lg:col-span-2"><span className="label">Tracking URL template</span><input name="tracking_url_template" defaultValue={p?.tracking_url_template ?? ""} className="input" placeholder="https://partner.example/track/{ref}" /></label>
      <label><span className="label">Support phone</span><input name="contact_phone" defaultValue={p?.contact_phone ?? ""} className="input" /></label>
      <label className="lg:col-span-2"><span className="label">Notes</span><input name="notes" defaultValue={p?.notes ?? ""} className="input" /></label>
      <div className="flex items-center gap-3 pb-2">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="is_active" defaultChecked={p?.is_active ?? true} className="accent-brand-600" /> Active</label>
        <SubmitButton className="btn-primary btn-sm">{p ? "Save" : "Add partner"}</SubmitButton>
      </div>
    </div>
  );
}

export default async function ProvidersPage() {
  await requireRole(["admin"], "/admin/delivery-providers");
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_providers").select("*").order("name");
  return (
    <div className="space-y-6">
      <PageHeader title="Third-party delivery partners" description="API credentials are read from server environment variables (<PREFIX>_API_KEY, <PREFIX>_WEBHOOK_SECRET) and never stored in the database." />
      <section className="card p-5"><h2 className="mb-3 font-sans font-bold">Add partner</h2><ActionForm action={saveProvider} resetOnSuccess><Fields /></ActionForm></section>
      {((data ?? []) as DeliveryProvider[]).map((p) => {
        const st = providerStatus(p);
        return (
          <section key={p.id} className="card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="font-sans font-bold">{p.name}</h2>
              <Badge tone={st.apiActive ? "success" : p.adapter === "manual" ? "neutral" : "warning"}>{st.reason}</Badge>
            </div>
            {p.adapter === "http_generic" && <p className="mb-3 text-xs text-charcoal-500">Webhook URL for this partner: <code className="rounded bg-cream px-1">{publicEnv.siteUrl}/api/webhooks/delivery/{p.code}</code></p>}
            <ActionForm action={saveProvider}><Fields p={p} /></ActionForm>
          </section>
        );
      })}
    </div>
  );
}
