import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { createClient } from "@/lib/supabase/server";
import { deleteCategory, saveCategory } from "../menu/actions";
import type { MenuCategory } from "@/lib/types";

export const metadata = { title: "Categories" };

function CategoryFields({ c, parents }: { c?: MenuCategory; parents: MenuCategory[] }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
        <input name="name" required maxLength={80} defaultValue={c?.name} className="input" placeholder="Name" aria-label="Name" />
        <select name="parent_id" defaultValue={c?.parent_id ?? ""} className="input" aria-label="Parent">
          <option value="">Top-level category</option>
          {parents.filter((p) => p.id !== c?.id).map((p) => <option key={p.id} value={p.id}>Inside {p.name}</option>)}
        </select>
        <input name="sort_order" type="number" defaultValue={c?.sort_order ?? 0} className="input" aria-label="Sort order" />
      </div>
      <textarea name="description" rows={2} maxLength={500} defaultValue={c?.description ?? ""} className="input mt-3" placeholder="Short description (optional)" />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <ImageUpload name="image_url" folder="categories" initial={c?.image_url} label="Category image" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} className="accent-brand-600" /> Visible</label>
        <SubmitButton>{c ? "Save" : "Add category"}</SubmitButton>
      </div>
    </>
  );
}

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("menu_categories").select("*").order("sort_order").order("name");
  const cats = (data ?? []) as MenuCategory[];
  const parents = cats.filter((c) => !c.parent_id);
  const ordered = parents.flatMap((p) => [p, ...cats.filter((c) => c.parent_id === p.id)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="Top-level categories (Breakfast, Lunch…) and sub-sections (Dosa, Seafood…)." />
      <section className="card p-5">
        <h2 className="mb-3 font-sans font-bold">New category</h2>
        <ActionForm action={saveCategory} resetOnSuccess><CategoryFields parents={parents} /></ActionForm>
      </section>
      {ordered.map((c) => (
        <section key={c.id} className={`card p-5 ${c.parent_id ? "ml-6 border-l-4 border-l-brand-200" : ""}`}>
          <ActionForm action={saveCategory}><CategoryFields c={c} parents={parents} /></ActionForm>
          <ActionForm action={deleteCategory} className="mt-2" confirmMessage={`Delete ${c.name}?`}>
            <input type="hidden" name="id" value={c.id} />
            <SubmitButton className="btn-ghost btn-sm text-chilli">Delete</SubmitButton>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
