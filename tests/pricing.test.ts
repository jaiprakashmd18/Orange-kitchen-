import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, evaluateCoupon, priceLines, PricingError, optionsKey } from "../src/lib/pricing";
import type { Coupon, MenuItem, ServiceableArea } from "../src/lib/types";

const item = (over: Partial<MenuItem> = {}): MenuItem => ({
  id: "i1", category_id: "c", name: "Crab Gravy", slug: "crab-gravy", description: null, price: 350,
  image_url: null, is_veg: false, is_published: true, is_available: true, is_popular: false, is_special: false,
  special_from: null, special_until: null, max_per_order: 10, sort_order: 0,
  options: [{ id: "spice", name: "Spice level", required: true, max: 1,
    choices: [{ id: "mild", label: "Mild", price_delta: 0 }, { id: "xhot", label: "Extra hot", price_delta: 10.5 }] }],
  ...over,
});
const area: ServiceableArea = { id: "a", name: "Surapet", pincode: "600066", delivery_fee: 30,
  free_delivery_above: 500, min_order_amount: 100, estimated_minutes: 40, is_active: true };
const settings = { min_order_amount: 0, tax_rate_percent: 5, prices_include_tax: false, packaging_charge: 10 };
const items = new Map([["i1", item()]]);

test("prices options and quantities in paise", () => {
  const lines = priceLines([{ menu_item_id: "i1", quantity: 3, selected_options: { spice: ["xhot"] } }], items, () => true);
  assert.equal(lines[0].unit_price, 360.5);
  assert.equal(lines[0].line_total, 1081.5);
});

test("required option enforced; unknown option rejected", () => {
  assert.throws(() => priceLines([{ menu_item_id: "i1", quantity: 1, selected_options: {} }], items, () => true), PricingError);
  assert.throws(() => priceLines([{ menu_item_id: "i1", quantity: 1, selected_options: { spice: ["nope"] } }], items, () => true), PricingError);
  assert.throws(() => priceLines([{ menu_item_id: "i1", quantity: 1, selected_options: { spice: ["mild"], x: ["y"] } }], items, () => true), PricingError);
});

test("unpublished, sold out, quantity limits", () => {
  const sold = new Map([["i1", item({ is_available: false })]]);
  assert.throws(() => priceLines([{ menu_item_id: "i1", quantity: 1, selected_options: { spice: ["mild"] } }], sold, () => true), /not available/);
  assert.throws(() => priceLines([{ menu_item_id: "i1", quantity: 11, selected_options: { spice: ["mild"] } }], items, () => true), /up to 10/);
  assert.throws(() => priceLines([{ menu_item_id: "zz", quantity: 1, selected_options: {} }], items, () => true), /no longer/);
  assert.throws(() => priceLines([{ menu_item_id: "i1", quantity: 1, selected_options: { spice: ["mild"] } }], items, () => false), /not available/);
});

test("delivery quote with tax, packaging and fee", () => {
  const lines = priceLines([{ menu_item_id: "i1", quantity: 1, selected_options: { spice: ["mild"] } }], items, () => true);
  const q = computeQuote({ lines, settings, fulfillment: "delivery", area, coupon: null });
  assert.equal(q.subtotal, 350);
  assert.equal(q.packaging_charge, 10);
  assert.equal(q.tax_amount, 18); // 5% of 360
  assert.equal(q.delivery_fee, 30);
  assert.equal(q.total_amount, 408);
  assert.equal(q.min_order_amount, 100);
});

test("free delivery threshold and takeaway has no fee", () => {
  const lines = priceLines([{ menu_item_id: "i1", quantity: 2, selected_options: { spice: ["mild"] } }], items, () => true);
  assert.equal(computeQuote({ lines, settings, fulfillment: "delivery", area, coupon: null }).delivery_fee, 0);
  const t = computeQuote({ lines, settings, fulfillment: "takeaway", area: null, coupon: null });
  assert.equal(t.delivery_fee, 0);
  assert.throws(() => computeQuote({ lines, settings, fulfillment: "delivery", area: null, coupon: null }), /do not deliver/);
});

test("tax-inclusive prices do not increase total", () => {
  const lines = priceLines([{ menu_item_id: "i1", quantity: 1, selected_options: { spice: ["mild"] } }], items, () => true);
  const q = computeQuote({ lines, settings: { ...settings, prices_include_tax: true, packaging_charge: 0 }, fulfillment: "takeaway", area: null, coupon: null });
  assert.equal(q.total_amount, 350);
  assert.equal(q.tax_amount, 16.67);
});

const coupon = (over: Partial<Coupon> = {}): Coupon => ({ id: "cp", code: "WELCOME", description: null, discount_type: "percent",
  discount_value: 10, max_discount: 50, min_order_amount: 200, valid_from: null, valid_until: null, usage_limit: null,
  per_user_limit: 1, applies_to: null, is_active: true, ...over });
const ctx = (c: Coupon, over = {}) => ({ coupon: c, timesUsedTotal: 0, timesUsedByUser: 0, now: new Date(), fulfillment: "delivery" as const, ...over });

test("coupons: percent capped, flat capped at subtotal, rules", () => {
  assert.deepEqual(evaluateCoupon(100000, ctx(coupon())), { discountPaise: 5000, error: null });
  assert.equal(evaluateCoupon(30000, ctx(coupon())).discountPaise, 3000);
  assert.equal(evaluateCoupon(25000, ctx(coupon({ discount_type: "flat", discount_value: 500, min_order_amount: 0, max_discount: null }))).discountPaise, 25000);
  assert.match(evaluateCoupon(10000, ctx(coupon())).error!, /₹200/);
  assert.match(evaluateCoupon(100000, ctx(coupon(), { timesUsedByUser: 1 })).error!, /already used/);
  assert.match(evaluateCoupon(100000, ctx(coupon({ usage_limit: 5 }), { timesUsedTotal: 5 })).error!, /limit/);
  assert.match(evaluateCoupon(100000, ctx(coupon({ valid_until: "2000-01-01T00:00:00Z" }))).error!, /expired/);
  assert.match(evaluateCoupon(100000, ctx(coupon({ applies_to: "takeaway" }))).error!, /takeaway/);
});

test("optionsKey is order-independent", () => {
  assert.equal(optionsKey({ b: ["2", "1"], a: ["x"] }), optionsKey({ a: ["x"], b: ["1", "2"] }));
});
