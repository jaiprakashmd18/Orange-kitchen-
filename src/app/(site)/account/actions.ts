"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { addressSchema, firstError, phoneSchema } from "@/lib/validation";
import type { Address } from "@/lib/types";

// Customer self-service actions. All run with the customer's own session,
// so Row Level Security enforces ownership in the database as well.

type Result<T = null> = { error: string | null; data?: T };

const normPhone = (p: string) => (p.startsWith("+") ? p : `+91${p}`);

export async function saveAddress(input: unknown, id?: string): Promise<Result<Address>> {
  const user = await getSessionUser();
  if (!user) return { error: "Please log in again." };
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const row = { ...parsed.data, phone: normPhone(parsed.data.phone), user_id: user.id };
  const query = id
    ? supabase.from("customer_addresses").update(row).eq("id", id).eq("user_id", user.id)
    : supabase.from("customer_addresses").insert(row);
  const { data, error } = await query.select("*").single();
  if (error) return { error: "Could not save the address." };
  revalidatePath("/account/addresses");
  return { error: null, data: data as Address };
}

export async function deleteAddress(id: string): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { error: "Please log in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not delete the address." };
  revalidatePath("/account/addresses");
  return { error: null };
}

export async function setDefaultAddress(id: string): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { error: "Please log in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not update the address." };
  revalidatePath("/account/addresses");
  return { error: null };
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
  phone: phoneSchema,
  whatsapp_opt_in: z.boolean(),
  marketing_opt_in: z.boolean(),
});

export async function updateProfile(input: unknown): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { error: "Please log in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, phone: normPhone(parsed.data.phone) })
    .eq("id", user.id);
  if (error) return { error: "Could not update your profile." };
  revalidatePath("/account", "layout");
  return { error: null };
}

export async function toggleFavourite(itemId: string): Promise<Result<boolean>> {
  const user = await getSessionUser();
  if (!user) return { error: "Please log in to save favourites." };
  if (!z.string().uuid().safeParse(itemId).success) return { error: "Invalid item." };
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("favourite_item_ids").eq("id", user.id).single();
  const current: string[] = data?.favourite_item_ids ?? [];
  const next = current.includes(itemId) ? current.filter((i) => i !== itemId) : [...current, itemId].slice(-200);
  const { error } = await supabase.from("profiles").update({ favourite_item_ids: next }).eq("id", user.id);
  if (error) return { error: "Could not update favourites." };
  revalidatePath("/account/favourites");
  return { error: null, data: next.includes(itemId) };
}

export async function markNotificationsRead(): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { error: "Please log in again." };
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).eq("channel", "in_app").is("read_at", null);
  revalidatePath("/account", "layout");
  return { error: null };
}

const reviewSchema = z.object({
  order_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  display_name: z.string().trim().max(60).optional(),
});

export async function submitReview(input: unknown): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { error: "Please log in again." };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert({ ...parsed.data, comment: parsed.data.comment || null, display_name: parsed.data.display_name || null, user_id: user.id });
  if (error) return { error: error.code === "23505" ? "You have already reviewed this order." : "Reviews can be added once your order is completed." };
  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { error: null };
}

/** Current menu data for re-adding a past order to the cart (skips unavailable items). */
export async function getReorderLines(orderId: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Please log in again.", lines: [], skipped: 0 };
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity, selected_options, orders!inner(customer_id)")
    .eq("order_id", orderId)
    .eq("orders.customer_id", user.id);
  const ids = [...new Set((items ?? []).map((i) => i.menu_item_id).filter(Boolean))] as string[];
  const { data: menu } = ids.length ? await supabase.from("menu_items").select("*").in("id", ids) : { data: [] };
  const byId = new Map((menu ?? []).map((m) => [m.id as string, m]));
  let skipped = 0;
  const lines = [];
  for (const it of items ?? []) {
    const m = it.menu_item_id ? byId.get(it.menu_item_id) : null;
    if (!m || !m.is_published || !m.is_available || m.price === null) {
      skipped++;
      continue;
    }
    // Map stored option labels back to current option ids
    const selected: Record<string, string[]> = {};
    let extra = 0;
    let ok = true;
    for (const so of it.selected_options as { group: string; choice: string }[]) {
      const g = (m.options ?? []).find((x: { name: string }) => x.name === so.group);
      const c = g?.choices.find((x: { label: string }) => x.label === so.choice);
      if (!g || !c) { ok = false; break; }
      (selected[g.id] ??= []).push(c.id);
      extra += Number(c.price_delta);
    }
    if (!ok) { skipped++; continue; }
    lines.push({
      menu_item_id: m.id as string,
      name: m.name as string,
      image_url: m.image_url as string | null,
      is_veg: Boolean(m.is_veg),
      unit_price: Math.round((Number(m.price) + extra) * 100) / 100,
      max_per_order: m.max_per_order as number,
      selected_options: selected,
      options_summary: (it.selected_options as { choice: string }[]).map((o) => o.choice).join(", "),
      quantity: it.quantity as number,
    });
  }
  return { error: null, lines, skipped };
}
