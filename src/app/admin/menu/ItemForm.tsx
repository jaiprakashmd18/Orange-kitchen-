import { ActionForm, SubmitButton, type FormAction } from "@/components/admin/ActionForm";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { OptionsEditor } from "@/components/admin/OptionsEditor";
import { WindowsEditor } from "@/components/admin/WindowsEditor";
import type { AvailabilityWindow, MenuCategory, MenuItem } from "@/lib/types";

export function ItemForm({ action, item, categories, windows }: { action: FormAction; item?: MenuItem; categories: MenuCategory[]; windows: AvailabilityWindow[] }) {
  const tops = categories.filter((c) => !c.parent_id);
  return (
    <ActionForm action={action} className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="space-y-6">
        <section className="card grid gap-4 p-5">
          <div>
            <label htmlFor="name" className="label">Dish name</label>
            <input id="name" name="name" required maxLength={120} defaultValue={item?.name} className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category_id" className="label">Category</label>
              <select id="category_id" name="category_id" required defaultValue={item?.category_id ?? ""} className="input">
                <option value="" disabled>Choose…</option>
                {tops.map((t) => (
                  <optgroup key={t.id} label={t.name}>
                    <option value={t.id}>{t.name}</option>
                    {categories.filter((c) => c.parent_id === t.id).map((c) => <option key={c.id} value={c.id}>{t.name} › {c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="price" className="label">Price (₹)</label>
              <input id="price" name="price" type="number" min={0} step="0.01" defaultValue={item?.price ?? ""} className="input" placeholder="From the restaurant's menu" />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="label">Description</label>
            <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={item?.description ?? ""} className="input" />
          </div>
          <fieldset>
            <legend className="label">Type</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="is_veg" value="true" defaultChecked={item?.is_veg === true} className="accent-leaf" /> Veg</label>
              <label className="flex items-center gap-2"><input type="radio" name="is_veg" value="false" defaultChecked={item?.is_veg === false} className="accent-chilli" /> Non-veg</label>
              <label className="flex items-center gap-2"><input type="radio" name="is_veg" value="" defaultChecked={item ? item.is_veg === null : true} /> Not set</label>
            </div>
          </fieldset>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-sans font-bold">Customisation options</h2>
          <OptionsEditor name="options" initial={item?.options ?? []} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-sans font-bold">Daily availability</h2>
          <WindowsEditor name="windows" initial={windows} />
        </section>
      </div>
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <ImageUpload name="image_url" folder="menu" initial={item?.image_url} label="Food photo" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_published" defaultChecked={item?.is_published ?? false} className="accent-brand-600" /> Published (visible on menu)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_available" defaultChecked={item?.is_available ?? true} className="accent-brand-600" /> Available today (untick = sold out)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_popular" defaultChecked={item?.is_popular ?? false} className="accent-brand-600" /> Show in “Popular dishes”</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="max_per_order" className="label">Max per order</label>
              <input id="max_per_order" name="max_per_order" type="number" min={1} max={100} defaultValue={item?.max_per_order ?? 20} className="input" />
            </div>
            <div>
              <label htmlFor="sort_order" className="label">Sort order</label>
              <input id="sort_order" name="sort_order" type="number" defaultValue={item?.sort_order ?? 0} className="input" />
            </div>
          </div>
        </section>
        <section className="card space-y-3 p-5">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_special" defaultChecked={item?.is_special ?? false} className="accent-brand-600" /> Today&apos;s special</label>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="sf" className="label">From</label><input id="sf" type="date" name="special_from" defaultValue={item?.special_from ?? ""} className="input" /></div>
            <div><label htmlFor="su" className="label">Until</label><input id="su" type="date" name="special_until" defaultValue={item?.special_until ?? ""} className="input" /></div>
          </div>
          <p className="hint">Leave dates empty to show it as a special every day.</p>
        </section>
        <SubmitButton className="btn-primary w-full">Save dish</SubmitButton>
      </div>
    </ActionForm>
  );
}
