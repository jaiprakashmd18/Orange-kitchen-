"use server";

import { adminAction, check } from "@/lib/admin-action";
import { createClient } from "@/lib/supabase/server";
import { parseCsv, parseFlag } from "@/lib/csv";
import { slugify } from "@/lib/validation";
import { HttpError } from "@/lib/auth";
import { queueAutoPhotos } from "@/lib/auto-photos-queue";
import type { MenuCategory } from "@/lib/types";

type Column = "category" | "subcategory" | "name" | "price" | "veg" | "description" | "image_url" | "published" | "available" | "popular";

/**
 * Bulk create/update dishes from CSV. Matches existing dishes by name
 * (slug), creates missing categories, never invents prices: rows without a
 * price are saved as drafts.
 */
export const importMenu = adminAction({ roles: ["admin", "staff"], audit: "menu.imported", revalidate: ["/admin/menu", "/menu", "/"] }, async (f) => {
  let text = String(f.get("csv") ?? "");
  const file = f.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1_000_000) throw new HttpError(400, "CSV file must be under 1 MB.");
    text = await file.text();
  }
  const rows = parseCsv(text);
  if (rows.length < 2) throw new HttpError(400, "Paste a CSV with a header row and at least one dish.");
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const idx = (c: Column) => header.indexOf(c);
  if (idx("category") < 0 || idx("name") < 0) throw new HttpError(400, "The header must include at least: category, name.");
  if (rows.length > 501) throw new HttpError(400, "Import at most 500 dishes at a time.");

  const supabase = await createClient();
  const { data: catRows } = await supabase.from("menu_categories").select("*");
  const cats = (catRows ?? []) as MenuCategory[];
  const slugs = new Set(cats.map((c) => c.slug));

  async function ensureCategory(name: string, parent: MenuCategory | null): Promise<MenuCategory> {
    const found = cats.find((c) => c.name.toLowerCase() === name.toLowerCase() && (c.parent_id ?? null) === (parent?.id ?? null));
    if (found) return found;
    let slug = slugify(parent ? name : name) || "section";
    if (slugs.has(slug)) slug = slugify(`${parent?.name ?? "menu"}-${name}`);
    for (let n = 2; slugs.has(slug); n++) slug = `${slugify(name)}-${n}`;
    const created = check(
      await supabase.from("menu_categories").insert({ name, slug, parent_id: parent?.id ?? null, sort_order: cats.length * 10 + 10 }).select("*").single(),
    ) as MenuCategory;
    cats.push(created);
    slugs.add(slug);
    return created;
  }

  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let drafts = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (c: Column) => (idx(c) >= 0 ? (row[idx(c)] ?? "").trim() : "");
    const line = r + 1;
    const name = get("name");
    const catName = get("category");
    if (!name || !catName) {
      errors.push(`Line ${line}: category and name are required.`);
      continue;
    }
    if (name.length > 120) {
      errors.push(`Line ${line}: name too long.`);
      continue;
    }
    const priceRaw = get("price").replace(/[₹,\s]/g, "");
    const price = priceRaw === "" ? null : Number(priceRaw);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000)) {
      errors.push(`Line ${line} (${name}): invalid price "${get("price")}".`);
      continue;
    }
    const image = get("image_url") || null;
    if (image && !/^https:\/\//.test(image)) {
      errors.push(`Line ${line} (${name}): image_url must start with https://`);
      continue;
    }
    const isVeg = parseFlag(get("veg"));
    const wantPublish = parseFlag(get("published"));
    const canPublish = price !== null && isVeg !== null;
    const publish = (wantPublish ?? true) && canPublish;
    if (!publish) drafts++;

    try {
      const top = await ensureCategory(catName, null);
      const sub = get("subcategory") ? await ensureCategory(get("subcategory"), top) : null;
      const fields = {
        name,
        category_id: (sub ?? top).id,
        price,
        is_veg: isVeg,
        is_published: publish,
        ...(get("description") ? { description: get("description").slice(0, 1000) } : {}),
        ...(image ? { image_url: image } : {}),
        ...(parseFlag(get("available")) !== null ? { is_available: parseFlag(get("available")) } : {}),
        ...(parseFlag(get("popular")) !== null ? { is_popular: parseFlag(get("popular")) } : {}),
      };
      const slug = slugify(name) || `dish-${line}`;
      const { data: existing } = await supabase.from("menu_items").select("id").eq("slug", slug).maybeSingle();
      if (existing) {
        check(await supabase.from("menu_items").update(fields).eq("id", existing.id));
        updated++;
      } else {
        check(await supabase.from("menu_items").insert({ ...fields, slug, sort_order: line }));
        created++;
      }
    } catch (e) {
      errors.push(`Line ${line} (${name}): ${(e as Error).message}`);
    }
  }

  if (created > 0) await queueAutoPhotos();
  const summary = `${created} added, ${updated} updated${drafts ? `, ${drafts} saved as drafts (missing price or veg/non-veg)` : ""}.`;
  if (errors.length) throw new HttpError(422, `${summary} ${errors.length} row(s) skipped: ${errors.slice(0, 8).join(" ")}${errors.length > 8 ? " …" : ""}`);
  return { message: `Import complete: ${summary}${created > 0 ? " Photos are being added automatically for new dishes." : ""}`, details: { created, updated, drafts } };
});
