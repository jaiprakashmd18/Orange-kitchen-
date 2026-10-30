import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantRole, revokeRole } from "../team-actions";

export const metadata = { title: "Staff access" };

export default async function StaffPage() {
  const { user } = await requireRole(["admin"], "/admin/staff");
  const { data } = await createAdminClient().from("user_roles").select("user_id, role, created_at").in("role", ["admin", "staff"]).order("created_at");
  const ids = [...new Set((data ?? []).map((r) => r.user_id))];
  const { data: profiles } = ids.length ? await createAdminClient().from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const who = (id: string) => (profiles ?? []).find((p) => p.id === id);
  return (
    <div className="space-y-6">
      <PageHeader title="Staff access" description="Admins manage everything. Staff can run orders, the menu and the delivery team, but not settings, coupons or reports." />
      <section className="card p-5">
        <ActionForm action={grantRole} resetOnSuccess className="flex flex-wrap items-end gap-3">
          <label className="flex-1"><span className="label">Email of an existing account</span><input name="email" type="email" required className="input" /></label>
          <label><span className="label">Role</span><select name="role" className="input"><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
          <SubmitButton>Grant access</SubmitButton>
        </ActionForm>
      </section>
      <section className="card divide-y divide-charcoal/5">
        {(data ?? []).map((r) => (
          <ActionForm key={`${r.user_id}-${r.role}`} action={revokeRole} className="flex items-center justify-between gap-3 p-4" confirmMessage="Remove this access?">
            <input type="hidden" name="user_id" value={r.user_id} />
            <input type="hidden" name="role" value={r.role} />
            <span>
              <span className="font-semibold">{who(r.user_id)?.full_name ?? "—"}</span> <span className="text-sm text-charcoal-500">{who(r.user_id)?.email}</span>
              <Badge tone={r.role === "admin" ? "info" : "neutral"} className="ml-2">{r.role}</Badge>
            </span>
            {!(r.user_id === user.id && r.role === "admin") && <SubmitButton className="btn-ghost btn-sm text-chilli">Remove</SubmitButton>}
          </ActionForm>
        ))}
      </section>
    </div>
  );
}
