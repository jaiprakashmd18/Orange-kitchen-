"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { adminAction, bool, check, num, optStr, str } from "@/lib/admin-action";
import { createClient } from "@/lib/supabase/server";
import { optionGroupsSchema, slugify } from "@/lib/validation";
import { HttpError } from "@/lib/auth";
import { queueAutoPhotos } from "@/lib/auto-photos-queue";

const STAFF = { roles: ["admin", "staff"] as ("admin" | "staff")[] };

function parseItem(f: FormData) {
  const name = str(f, "name");
  if (name.length < 1 || name.length > 120) throw new HttpError(400, "Enter a dish name (max 120 characters).");
  const price = num(f, "price");
  if (price !== null && (price < 0 || price > 100000)) throw new HttpError(400, "Price looks wrong.");
  const veg = str(f, "is_veg");
  let options: unknown = [];
  try {
    options = JSON.parse(str(f, "options") || "[]");
  } catch {
    throw new HttpError(400, "Customisation options are invalid.");
  }
  const published = bool(f, "is_published");
  if (published && price === null) throw new HttpError(400, "Add a price before publishing this dish.");
  if (published && veg === "") throw new HttpError(400, "Choose Veg or Non-veg before publishing.");
  const imageUrl = optStr(f, "image_url");
  // Manual upload or removal resets the credit; an unchanged auto photo keeps its credit.
  const photoMeta = !imageUrl || str(f, "image_source") === "upload" ? { image_source: "upload", image_credit: null, image_credit_url: null } : {};
  const specialFrom = optStr(f, "special_from");
  const specialUntil = optStr(f, "special_until");
  return {
    name,
    category_id: z.string().uuid({ message: "Choose a category" }).parse(str(f, "category_id")),
    description: optStr(f, "description")?.slice(0, 1000) ?? null,
    price,
    image_url: imageUrl,
    ...photoMeta,
    is_veg: veg === "" ? null : veg === "true",
    is_published: published,
    is_available: bool(f, "is_available"),
    is_popular: bool(f, "is_popular"),
    is_special: bool(f, "is_special"),
    special_from: specialFrom,
    special_until: specialUntil,
    max_per_order: num(f, "max_per_order") ?? 20,
    sort_order: num(f, "sort_order") ?? 0,
    options: optionGroupsSchema.parse(options),
  };
}

const windowsSchema = z.array(z.object({ day_of_week: z.number().int().min(0).max(6), start_time: z.string().regex(/^\d{2}:\d{2}$/), end_time: z.string().regex(/^\d{2}:\d{2}$/) })).max(50);

async function saveWindows(itemId: string, raw: string) {
  const windows = windowsSchema.parse(JSON.parse(raw || "[]"));
  if (windows.some((w) => w.end_time <= w.start_time)) throw new HttpError(400, "Each availability window must end after it starts.");
  const supabase = await createClient();
  check(await supabase.from("menu_item_availability").delete().eq("menu_item_id", itemId));
  if (windows.length) check(await supabase.from("menu_item_availability").insert(windows.map((w) => ({ ...w, menu_item_id: itemId }))));
}

export const createItem = adminAction({ ...STAFF, audit: "menu_item.created", revalidate: ["/admin/menu", "/menu", "/"] }, async (f) => {
  const item = parseItem(f);
  const supabase = await createClient();
  const base = slugify(item.name) || "dish";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data } = await supabase.from("menu_items").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }
  const created = check(await supabase.from("menu_items").insert({ ...item, slug }).select("id").single()) as { id: string };
  await saveWindows(created.id, str(f, "windows"));
  if (!item.image_url) await queueAutoPhotos([created.id]);
  redirect(`/admin/menu/${created.id}?saved=1`);
});

export const updateItem = adminAction({ ...STAFF, audit: "menu_item.updated", revalidate: ["/admin/menu", "/menu", "/"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const item = parseItem(f);
  const supabase = await createClient();
  check(await supabase.from("menu_items").update(item).eq("id", id));
  await saveWindows(id, str(f, "windows"));
  return { message: "Dish saved.", entityId: id, details: { price: item.price, published: item.is_published } };
});

export const quickToggle = adminAction({ ...STAFF, audit: "menu_item.toggled", revalidate: ["/admin/menu", "/menu", "/"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const field = z.enum(["is_available", "is_published", "is_popular"]).parse(str(f, "field"));
  const value = str(f, "value") === "true";
  const supabase = await createClient();
  const res = await supabase.from("menu_items").update({ [field]: value }).eq("id", id);
  if (res.error?.message.includes("publish_requires_price")) throw new HttpError(400, "Add a price and veg/non-veg before publishing.");
  check(res);
  return { message: "Updated.", entityId: id, details: { [field]: value } };
});

export const deleteItem = adminAction({ ...STAFF, audit: "menu_item.deleted", revalidate: ["/admin/menu", "/menu", "/"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const supabase = await createClient();
  check(await supabase.from("menu_items").delete().eq("id", id));
  redirect("/admin/menu?deleted=1");
});

export const saveCategory = adminAction({ ...STAFF, audit: "menu_category.saved", revalidate: ["/admin/categories", "/admin/menu", "/menu", "/"] }, async (f) => {
  const id = optStr(f, "id");
  const name = str(f, "name");
  if (!name || name.length > 80) throw new HttpError(400, "Enter a category name.");
  const parent = optStr(f, "parent_id");
  if (parent && parent === id) throw new HttpError(400, "A category cannot be its own parent.");
  const row = {
    name,
    description: optStr(f, "description"),
    image_url: optStr(f, "image_url"),
    parent_id: parent,
    sort_order: num(f, "sort_order") ?? 0,
    is_active: bool(f, "is_active"),
  };
  const supabase = await createClient();
  if (id) check(await supabase.from("menu_categories").update(row).eq("id", id));
  else check(await supabase.from("menu_categories").insert({ ...row, slug: slugify(str(f, "slug") || name) }));
  return { message: "Category saved.", entityId: id ?? undefined };
});

export const deleteCategory = adminAction({ ...STAFF, audit: "menu_category.deleted", revalidate: ["/admin/categories", "/menu"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const supabase = await createClient();
  const res = await supabase.from("menu_categories").delete().eq("id", id);
  if (res.error?.code === "23503") throw new HttpError(409, "Move or delete the dishes in this category first.");
  check(res);
  return { message: "Category deleted.", entityId: id };
});

/** One click: publish every draft dish that has a price and veg/non-veg set. */
export const publishAllReady = adminAction({ ...STAFF, audit: "menu.publish_all", revalidate: ["/admin/menu", "/menu", "/"] }, async () => {
  const supabase = await createClient();
  const { data: drafts } = await supabase.from("menu_items").select("id, name, price, is_veg").eq("is_published", false);
  const ready = (drafts ?? []).filter((d) => d.price !== null && d.is_veg !== null);
  const notReady = (drafts ?? []).filter((d) => d.price === null || d.is_veg === null);
  if (ready.length) check(await supabase.from("menu_items").update({ is_published: true }).in("id", ready.map((d) => d.id)));
  const parts = [ready.length ? `Published ${ready.length} dish${ready.length === 1 ? "" : "es"} — they're live on the menu now.` : "No dishes were ready to publish."];
  if (notReady.length) {
    parts.push(`${notReady.length} still need a price or veg/non-veg: ${notReady.slice(0, 8).map((d) => d.name).join(", ")}${notReady.length > 8 ? "…" : ""}. Fill them in the table below.`);
  }
  return { message: parts.join(" "), details: { published: ready.length, skipped: notReady.length } };
});

/** Quick edit from the dishes table: set price + veg and publish in one step. */
export const quickPricePublish = adminAction({ ...STAFF, audit: "menu_item.quick_published", revalidate: ["/admin/menu", "/menu", "/"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const price = num(f, "price");
  const veg = str(f, "is_veg");
  if (price === null || price < 0 || price > 100000) throw new HttpError(400, "Enter a valid price.");
  if (veg !== "true" && veg !== "false") throw new HttpError(400, "Choose Veg or Non-veg.");
  const supabase = await createClient();
  check(await supabase.from("menu_items").update({ price, is_veg: veg === "true", is_published: true }).eq("id", id));
  return { message: "Saved and published.", entityId: id, details: { price } };
});
