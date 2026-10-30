import { PageHeader } from "@/components/admin/PageHeader";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requireRole(["admin"], "/admin/audit");
  const supabase = await createClient();
  const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
  const ids = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const email = (id: string | null) => (id ? (people ?? []).find((p) => p.id === id)?.email ?? id.slice(0, 8) : "system");
  return (
    <div>
      <PageHeader title="Audit log" description="Every administrative change and payment event (latest 300)." />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</td>
                <td className="text-xs">{email(r.actor_id)}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="font-mono text-xs">{r.entity}{r.entity_id ? `:${String(r.entity_id).slice(0, 12)}` : ""}</td>
                <td className="max-w-md truncate font-mono text-xs text-charcoal-500">{r.details ? JSON.stringify(r.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
