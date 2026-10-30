// Pure pricing engine. Used by the server to compute authoritative totals
// (never trust client totals) and by the UI for previews.
// All arithmetic is done in integer paise to avoid floating point drift.

import type { Coupon, Fulfillment, MenuItem, OptionGroup, SelectedOptions, ServiceableArea } from "./types";

export const toPaise = (rupees: number | string) => Math.round(Number(rupees) * 100);
export const toRupees = (paise: number) => Math.round(paise) / 100;

export class PricingError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface CartLineInput {
  menu_item_id: string;
  quantity: number;
  selected_options: SelectedOptions;
}

export interface PricedLine {
  menu_item_id: string;
  item_name: string;
  is_veg: boolean;
  quantity: number;
  unit_price: number;
  line_total: number;
  selected_options: { group: string; choice: string; price_delta: number }[];
}

export interface PricingSettings {
  min_order_amount: number;
  tax_rate_percent: number;
  prices_include_tax: boolean;
  packaging_charge: number;
}

export interface Quote {
  lines: PricedLine[];
  subtotal: number;
  discount_amount: number;
  packaging_charge: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  coupon: { id: string; code: string } | null;
  coupon_error: string | null;
  min_order_amount: number;
}

/** Stable key used to merge identical cart lines. */
export function optionsKey(selected: SelectedOptions) {
  return Object.keys(selected)
    .sort()
    .map((g) => `${g}:${[...selected[g]].sort().join(",")}`)
    .join("|");
}

export function resolveOptions(groups: OptionGroup[], selected: SelectedOptions) {
  const chosen: PricedLine["selected_options"] = [];
  let deltaPaise = 0;
  const known = new Set(groups.map((g) => g.id));
  for (const key of Object.keys(selected)) {
    if (!known.has(key)) throw new PricingError("INVALID_OPTION", "An option you selected is no longer offered.");
  }
  for (const group of groups) {
    const ids = [...new Set(selected[group.id] ?? [])];
    if (group.required && ids.length === 0) {
      throw new PricingError("OPTION_REQUIRED", `Please choose ${group.name}.`);
    }
    if (ids.length > Math.max(1, group.max)) {
      throw new PricingError("OPTION_LIMIT", `Choose at most ${group.max} for ${group.name}.`);
    }
    for (const id of ids) {
      const choice = group.choices.find((c) => c.id === id);
      if (!choice) throw new PricingError("INVALID_OPTION", `An option for ${group.name} is no longer offered.`);
      deltaPaise += toPaise(choice.price_delta);
      chosen.push({ group: group.name, choice: choice.label, price_delta: Number(choice.price_delta) });
    }
  }
  return { chosen, deltaPaise };
}

export function priceLines(lines: CartLineInput[], items: Map<string, MenuItem>, isOrderable: (item: MenuItem) => boolean) {
  if (lines.length === 0) throw new PricingError("EMPTY_CART", "Your cart is empty.");
  if (lines.length > 50) throw new PricingError("CART_TOO_LARGE", "Too many different items in the cart.");
  return lines.map((line) => {
    const item = items.get(line.menu_item_id);
    if (!item || !item.is_published || item.price === null || item.is_veg === null) {
      throw new PricingError("ITEM_UNAVAILABLE", "An item in your cart is no longer on the menu.");
    }
    if (!item.is_available || !isOrderable(item)) {
      throw new PricingError("ITEM_UNAVAILABLE", `${item.name} is not available right now.`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > item.max_per_order) {
      throw new PricingError("INVALID_QUANTITY", `You can order up to ${item.max_per_order} × ${item.name}.`);
    }
    const { chosen, deltaPaise } = resolveOptions(item.options ?? [], line.selected_options ?? {});
    const unitPaise = toPaise(item.price) + deltaPaise;
    return {
      menu_item_id: item.id,
      item_name: item.name,
      is_veg: item.is_veg,
      quantity: line.quantity,
      unit_price: toRupees(unitPaise),
      line_total: toRupees(unitPaise * line.quantity),
      selected_options: chosen,
    } satisfies PricedLine;
  });
}

export interface CouponContext {
  coupon: Coupon | null;
  timesUsedTotal: number;
  timesUsedByUser: number;
  now: Date;
  fulfillment: Fulfillment;
}

/** Returns discount in paise, or an error message explaining why the coupon does not apply. */
export function evaluateCoupon(subtotalPaise: number, ctx: CouponContext): { discountPaise: number; error: string | null } {
  const c = ctx.coupon;
  if (!c || !c.is_active) return { discountPaise: 0, error: "This coupon code is not valid." };
  if (c.valid_from && new Date(c.valid_from) > ctx.now) return { discountPaise: 0, error: "This coupon is not active yet." };
  if (c.valid_until && new Date(c.valid_until) <= ctx.now) return { discountPaise: 0, error: "This coupon has expired." };
  if (c.applies_to && c.applies_to !== ctx.fulfillment)
    return { discountPaise: 0, error: `This coupon is valid only for ${c.applies_to} orders.` };
  if (c.usage_limit !== null && ctx.timesUsedTotal >= c.usage_limit)
    return { discountPaise: 0, error: "This coupon has reached its usage limit." };
  if (ctx.timesUsedByUser >= c.per_user_limit) return { discountPaise: 0, error: "You have already used this coupon." };
  if (subtotalPaise < toPaise(c.min_order_amount))
    return { discountPaise: 0, error: `Add items worth ₹${c.min_order_amount} or more to use this coupon.` };

  let discount =
    c.discount_type === "percent" ? Math.round((subtotalPaise * Number(c.discount_value)) / 100) : toPaise(c.discount_value);
  if (c.max_discount !== null) discount = Math.min(discount, toPaise(c.max_discount));
  discount = Math.min(discount, subtotalPaise);
  return { discountPaise: discount, error: null };
}

export function computeQuote(args: {
  lines: PricedLine[];
  settings: PricingSettings;
  fulfillment: Fulfillment;
  area: ServiceableArea | null;
  coupon: CouponContext | null;
}): Quote {
  const { lines, settings, fulfillment, area } = args;
  const subtotal = lines.reduce((sum, l) => sum + toPaise(l.line_total), 0);

  let discount = 0;
  let couponError: string | null = null;
  let coupon: Quote["coupon"] = null;
  if (args.coupon) {
    const result = evaluateCoupon(subtotal, args.coupon);
    discount = result.discountPaise;
    couponError = result.error;
    if (!result.error && args.coupon.coupon) coupon = { id: args.coupon.coupon.id, code: args.coupon.coupon.code };
  }

  const packaging = toPaise(settings.packaging_charge);

  let deliveryFee = 0;
  if (fulfillment === "delivery") {
    if (!area) throw new PricingError("NOT_SERVICEABLE", "We do not deliver to this pincode yet.");
    const freeAbove = area.free_delivery_above;
    deliveryFee = freeAbove !== null && subtotal >= toPaise(freeAbove) ? 0 : toPaise(area.delivery_fee);
  }

  const rate = Number(settings.tax_rate_percent) / 100;
  const taxable = subtotal - discount + packaging;
  let tax: number;
  let total: number;
  if (settings.prices_include_tax) {
    tax = rate > 0 ? Math.round(taxable - taxable / (1 + rate)) : 0;
    total = taxable + deliveryFee;
  } else {
    tax = Math.round(taxable * rate);
    total = taxable + tax + deliveryFee;
  }

  const minOrder = Math.max(
    toPaise(settings.min_order_amount),
    fulfillment === "delivery" && area ? toPaise(area.min_order_amount) : 0,
  );

  return {
    lines,
    subtotal: toRupees(subtotal),
    discount_amount: toRupees(discount),
    packaging_charge: toRupees(packaging),
    delivery_fee: toRupees(deliveryFee),
    tax_amount: toRupees(tax),
    total_amount: toRupees(total),
    coupon,
    coupon_error: couponError,
    min_order_amount: toRupees(minOrder),
  };
}
