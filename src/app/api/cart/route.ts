import { NextResponse, type NextRequest } from "next/server";
import { assertUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cartSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/http";
import { optionsKey } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import type { MenuItem, SelectedOptions } from "@/lib/types";

// Server-synced cart for signed-in customers. Uses the user's session so
// RLS guarantees a customer can only read/write their own cart.

export async function GET() {
  try {
    const user = await assertUser();
    const supabase = await createClient();
    const { data: cart } = await supabase
      .from("carts")
      .select("special_instructions, coupon_code, cart_items(menu_item_id, quantity, selected_options, menu_items(id, name, price, image_url, is_veg, is_published, options, max_per_order))")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cart) return NextResponse.json({ lines: [], special_instructions: "", coupon_code: "" });

    type Row = { menu_item_id: string; quantity: number; selected_options: SelectedOptions; menu_items: MenuItem | null };
    const lines = ((cart.cart_items ?? []) as unknown as Row[])
      .filter((r) => r.menu_items && r.menu_items.is_published && r.menu_items.price !== null)
      .map((r) => {
        const item = r.menu_items!;
        let delta = 0;
        const labels: string[] = [];
        for (const g of item.options ?? []) {
          for (const id of r.selected_options[g.id] ?? []) {
            const c = g.choices.find((x) => x.id === id);
            if (c) {
              delta += Number(c.price_delta);
              labels.push(c.label);
            }
          }
        }
        return {
          key: `${item.id}#${optionsKey(r.selected_options)}`,
          menu_item_id: item.id,
          name: item.name,
          image_url: item.image_url,
          is_veg: Boolean(item.is_veg),
          unit_price: Math.round((Number(item.price) + delta) * 100) / 100,
          quantity: Math.min(r.quantity, item.max_per_order),
          max_per_order: item.max_per_order,
          selected_options: r.selected_options,
          options_summary: labels.join(", "),
        };
      });
    return NextResponse.json({ lines, special_instructions: cart.special_instructions ?? "", coupon_code: cart.coupon_code ?? "" });
  } catch (err) {
    return handleRouteError(err, "cart:get");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await assertUser();
    await rateLimit(`cart:${user.id}`, 120, 60);
    const body = cartSchema.parse(await req.json());
    const supabase = await createClient();
    const { data: cart, error } = await supabase
      .from("carts")
      .upsert(
        { user_id: user.id, special_instructions: body.special_instructions ?? null, coupon_code: body.coupon_code || null },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (error) throw error;

    // Replace contents (merge duplicate lines by options key)
    const merged = new Map<string, { menu_item_id: string; quantity: number; selected_options: SelectedOptions; options_key: string }>();
    for (const l of body.items) {
      const key = optionsKey(l.selected_options);
      const id = `${l.menu_item_id}#${key}`;
      const prev = merged.get(id);
      merged.set(id, { menu_item_id: l.menu_item_id, quantity: Math.min(100, (prev?.quantity ?? 0) + l.quantity), selected_options: l.selected_options, options_key: key });
    }
    await supabase.from("cart_items").delete().eq("cart_id", cart.id);
    if (merged.size) {
      const { error: insErr } = await supabase.from("cart_items").insert([...merged.values()].map((l) => ({ ...l, cart_id: cart.id })));
      if (insErr && insErr.code !== "23503") throw insErr; // ignore deleted menu items
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "cart:put");
  }
}
