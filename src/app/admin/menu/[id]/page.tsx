import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { createClient } from "@/lib/supabase/server";
import { normalizeItem } from "@/lib/data";
import { ItemForm } from "../ItemForm";
import { createItem, deleteItem, updateItem } from "../actions";
import type { AvailabilityWindow, MenuCategory } from "@/lib/types";

export const metadata = { title: "Edit dish" };

export default async function EditItem({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: cats } = await supabase.from("menu_categories").select("*").order("sort_order");
  const categories = (cats ?? []) as MenuCategory[];

  if (id === "new") {
    return (
      <div>
        <PageHeader title="Add dish" description={<Link href="/admin/menu" className="link">← Back to dishes</Link>} />
        <ItemForm action={createItem} categories={categories} windows={[]} />
      </div>
    );
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ data: item }, { data: windows }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("id", id).maybeSingle(),
    supabase.from("menu_item_availability").select("*").eq("menu_item_id", id).order("day_of_week"),
  ]);
  if (!item) notFound();
  return (
    <div>
      <PageHeader
        title={item.name}
        description={<Link href="/admin/menu" className="link">← Back to dishes</Link>}
        actions={
          <ActionForm action={deleteItem} confirmMessage="Delete this dish permanently? Past orders keep their records.">
            <input type="hidden" name="id" value={id} />
            <SubmitButton className="btn-ghost text-chilli">Delete dish</SubmitButton>
          </ActionForm>
        }
      />
      {sp.saved && <p className="mb-4 text-sm text-leaf">Dish created.</p>}
      <ItemForm action={updateItem} item={normalizeItem(item)} categories={categories} windows={(windows ?? []) as AvailabilityWindow[]} />
    </div>
  );
}
