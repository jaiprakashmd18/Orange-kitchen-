import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { VegMark } from "@/components/ui/VegMark";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/format";
import { normalizeItem } from "@/lib/data";
import { quickToggle } from "./actions";
import type { MenuCategory } from "@/lib/types";

export const metadata = { title: "Menu" };

function Toggle({ id, field, value, on, off }: { id: string; field: string; value: boolean; on: string; off: string }) {
  return (
    <ActionForm action={quickToggle}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!value)} />
      <SubmitButton className={`btn btn-sm min-h-8 px-3 ${value ? "bg-leaf-50 text-leaf" : "bg-charcoal/5 text-charcoal-500"}`}>{value ? on : off}</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminMenu({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: cats }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("*").order("sort_order").order("name"),
    supabase.from("menu_items").select("*").order("sort_order").order("name"),
  ]);
  const categories = (cats ?? []) as MenuCategory[];
  const all = (items ?? []).map(normalizeItem);
  const drafts = all.filter((i) => !i.is_published).length;
  const catName = (id: string) => {
    const c = categories.find((x) => x.id === id);
    const p = c?.parent_id ? categories.find((x) => x.id === c.parent_id) : null;
    return p ? `${p.name} › ${c!.name}` : c?.name ?? "—";
  };
  const ordered = [...all].sort((a, b) => catName(a.category_id).localeCompare(catName(b.category_id)) || a.sort_order - b.sort_order);

  return (
    <div>
      <PageHeader
        title="Dishes"
        description={`${all.length} dishes · ${drafts} not published${drafts ? " (add price & veg/non-veg to publish)" : ""}`}
        actions={<><Link href="/admin/categories" className="btn-secondary">Categories</Link><Link href="/admin/menu/new" className="btn-primary">+ Add dish</Link></>}
      />
      {sp.deleted && <p className="mb-4 text-sm text-leaf">Dish deleted.</p>}
      {all.length === 0 ? (
        <EmptyState title="No dishes yet" description="Add your first dish from the uploaded menu." action={{ href: "/admin/menu/new", label: "Add dish" }} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Dish</th><th>Category</th><th className="text-right">Price</th><th>Published</th><th>Today</th><th>Popular</th></tr></thead>
            <tbody>
              {ordered.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/admin/menu/${i.id}`} className="flex items-center gap-2 font-semibold hover:text-brand-700">
                      {i.is_veg !== null ? <VegMark veg={i.is_veg} /> : <Badge tone="warning">veg?</Badge>} {i.name}
                    </Link>
                    {i.is_special && <Badge tone="info" className="mt-1">Special</Badge>}
                    {!i.image_url && <span className="ml-1 text-xs text-charcoal-400">no photo</span>}
                  </td>
                  <td className="text-sm text-charcoal-500">{catName(i.category_id)}</td>
                  <td className="text-right">{i.price === null ? <Badge tone="warning">No price</Badge> : formatINR(i.price)}</td>
                  <td><Toggle id={i.id} field="is_published" value={i.is_published} on="Live" off="Draft" /></td>
                  <td><Toggle id={i.id} field="is_available" value={i.is_available} on="Available" off="Sold out" /></td>
                  <td><Toggle id={i.id} field="is_popular" value={i.is_popular} on="Popular" off="—" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
