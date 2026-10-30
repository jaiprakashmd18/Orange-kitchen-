import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveCoupon } from "../settings/actions";
import type { Coupon } from "@/lib/types";

export const metadata = { title: "Coupons" };

const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");

function CouponFields({ c, used }: { c?: Coupon; used?: number }) {
  return (
    <div className="grid items-end gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {c && <input type="hidden" name="id" value={c.id} />}
      <label><span className="label">Code</span><input name="code" defaultValue={c?.code} required className="input uppercase" maxLength={30} /></label>
      <label><span className="label">Type</span><select name="discount_type" defaultValue={c?.discount_type ?? "percent"} className="input"><option value="percent">% off</option><option value="flat">₹ off</option></select></label>
      <label><span className="label">Value</span><input name="discount_value" type="number" step="0.01" min={0} defaultValue={c?.discount_value} required className="input" /></label>
      <label><span className="label">Max discount ₹</span><input name="max_discount" type="number" step="0.01" min={0} defaultValue={c?.max_discount ?? ""} className="input" /></label>
      <label><span className="label">Min order ₹</span><input name="min_order_amount" type="number" step="0.01" min={0} defaultValue={c?.min_order_amount ?? 0} className="input" /></label>
      <label><span className="label">Applies to</span><select name="applies_to" defaultValue={c?.applies_to ?? ""} className="input"><option value="">All orders</option><option value="delivery">Delivery</option><option value="takeaway">Takeaway</option></select></label>
      <label><span className="label">Valid from</span><input type="date" name="valid_from" defaultValue={d(c?.valid_from ?? null)} className="input" /></label>
      <label><span className="label">Valid until</span><input type="date" name="valid_until" defaultValue={d(c?.valid_until ?? null)} className="input" /></label>
      <label><span className="label">Total uses</span><input name="usage_limit" type="number" min={1} defaultValue={c?.usage_limit ?? ""} className="input" placeholder="Unlimited" /></label>
      <label><span className="label">Uses per customer</span><input name="per_user_limit" type="number" min={1} defaultValue={c?.per_user_limit ?? 1} className="input" /></label>
      <label className="sm:col-span-2"><span className="label">Description</span><input name="description" defaultValue={c?.description ?? ""} className="input" maxLength={200} /></label>
      <div className="flex items-center gap-3 sm:col-span-4 lg:col-span-6">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} className="accent-brand-600" /> Active</label>
        {used !== undefined && <span className="text-xs text-charcoal-500">Used {used} time(s)</span>}
        <SubmitButton className="btn-primary btn-sm ml-auto">{c ? "Save" : "Create coupon"}</SubmitButton>
      </div>
    </div>
  );
}

export default async function CouponsPage() {
  await requireRole(["admin"], "/admin/coupons");
  const supabase = await createClient();
  const [{ data }, { data: redemptions }] = await Promise.all([
    supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    supabase.from("coupon_redemptions").select("coupon_id"),
  ]);
  const counts = new Map<string, number>();
  for (const r of redemptions ?? []) counts.set(r.coupon_id, (counts.get(r.coupon_id) ?? 0) + 1);
  return (
    <div className="space-y-6">
      <PageHeader title="Coupons" description="Discounts are validated on the server at checkout and recorded when payment succeeds." />
      <section className="card p-5"><h2 className="mb-3 font-sans font-bold">New coupon</h2><ActionForm action={saveCoupon} resetOnSuccess><CouponFields /></ActionForm></section>
      {((data ?? []) as Coupon[]).map((c) => (
        <section key={c.id} className="card p-5"><ActionForm action={saveCoupon}><CouponFields c={c} used={counts.get(c.id) ?? 0} /></ActionForm></section>
      ))}
    </div>
  );
}
