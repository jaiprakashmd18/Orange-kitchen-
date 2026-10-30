import "server-only";
import { getHours, getMenu, getSettings } from "@/lib/data";
import { isOpenAt, itemAvailableAt, isSpecialToday } from "@/lib/schedule";
import type { BrowserDish } from "@/components/menu/MenuBrowser";
import type { MenuItem } from "@/lib/types";

/** Menu data decorated with live availability for display. */
export async function getMenuView(favouriteIds: string[] = []) {
  const [{ categories, items, windows }, settings, { hours, holidays }] = await Promise.all([getMenu(), getSettings(), getHours()]);
  const now = new Date();
  const open = isOpenAt(hours, holidays, now);

  const decorate = (i: MenuItem): BrowserDish => {
    const inWindow = itemAvailableAt(i, windows, now);
    const orderable = settings.accepting_orders && i.is_available && i.price !== null && (inWindow || settings.takeaway_enabled);
    return {
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      description: i.description,
      price: i.price,
      image_url: i.image_url,
      is_veg: i.is_veg,
      options: i.options ?? [],
      max_per_order: i.max_per_order,
      orderable,
      unavailable_reason: !i.is_available ? "Sold out" : !settings.accepting_orders ? "Not taking orders" : !inWindow ? "Not now" : undefined,
      badge: isSpecialToday(i, now) ? "Today's special" : i.is_popular ? "Popular" : undefined,
      favourite: favouriteIds.includes(i.id),
    };
  };

  let notice: string | null = null;
  if (!settings.accepting_orders) notice = "Online ordering is currently paused. You can browse the menu and call us to order.";
  else if (!open) notice = "We're closed right now. You can schedule a takeaway for a later pickup slot, or order delivery during opening hours.";

  return { settings, categories, items, dishes: items.map(decorate), notice, open };
}
