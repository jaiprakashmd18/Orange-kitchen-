import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { moderateReview } from "../team-actions";
import type { Review } from "@/lib/types";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("reviews").select("*, orders(order_number)").order("is_approved").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as (Review & { orders: { order_number: string } })[];
  return (
    <div className="space-y-4">
      <PageHeader title="Customer reviews" description="Only reviews from completed orders can be submitted. Approved reviews appear on the homepage." />
      {rows.length === 0 ? <EmptyState icon="⭐" title="No reviews yet" /> : rows.map((r) => (
        <ActionForm key={r.id} action={moderateReview} className="card flex flex-wrap items-start justify-between gap-4 p-5">
          <input type="hidden" name="id" value={r.id} />
          <div className="max-w-2xl">
            <p className="font-semibold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} <span className="text-sm font-normal text-charcoal-500">· {r.display_name || "Customer"} · <Link href={`/admin/orders/${r.order_id}`} className="link">#{r.orders?.order_number}</Link> · {formatDateTime(r.created_at)}</span></p>
            {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" name="is_approved" defaultChecked={r.is_approved} className="accent-brand-600" /> Approved</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" name="is_featured" defaultChecked={r.is_featured} className="accent-brand-600" /> Featured</label>
            <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>
            <button name="delete" value="1" className="btn-ghost btn-sm text-chilli">Delete</button>
          </div>
        </ActionForm>
      ))}
    </div>
  );
}
