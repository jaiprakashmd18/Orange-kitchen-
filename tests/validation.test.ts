import { test } from "node:test";
import assert from "node:assert/strict";
import { addressSchema, cartSchema, checkoutSchema, contactSchema, optionGroupsSchema, phoneSchema, slugify, verifyPaymentSchema } from "../src/lib/validation";

const id = "6f9619ff-8b86-4d11-b42d-00c04fc964ff"; // a real v4 UUID (as created by Postgres gen_random_uuid)

test("phone numbers: Indian mobiles, spaces/dashes stripped", () => {
  assert.equal(phoneSchema.parse("98765 43210"), "9876543210");
  assert.equal(phoneSchema.parse("+91-98765-43210"), "+919876543210");
  assert.throws(() => phoneSchema.parse("12345"));
  assert.throws(() => phoneSchema.parse("5876543210"));
});

test("address: defaults, optional fields become null, pin optional and bounded", () => {
  const a = addressSchema.parse({ full_name: "Ravi", phone: "9876543210", house: "12", street: "Main St", area: "Surapet", pincode: "600066" });
  assert.equal(a.label, "Home");
  assert.equal(a.city, "Chennai");
  assert.equal(a.landmark, null);
  assert.equal(a.delivery_instructions, null);
  assert.equal(a.latitude, null);
  assert.equal(a.is_default, false);
  const pinned = addressSchema.parse({ full_name: "Ravi", phone: "9876543210", house: "1", street: "S", area: "A", pincode: "600066", latitude: 13.14, longitude: 80.19 });
  assert.equal(pinned.latitude, 13.14);
  assert.throws(() => addressSchema.parse({ full_name: "Ravi", phone: "9876543210", house: "1", street: "S", area: "A", pincode: "600066", latitude: 51.5, longitude: -0.1 }));
  assert.throws(() => addressSchema.parse({ full_name: "Ravi", phone: "9876543210", house: "1", street: "S", area: "A", pincode: "060066" }));
});

test("cart: defaults options, caps lines and quantities", () => {
  const c = cartSchema.parse({ items: [{ menu_item_id: id, quantity: 2 }] });
  assert.deepEqual(c.items[0].selected_options, {});
  assert.throws(() => cartSchema.parse({ items: [{ menu_item_id: id, quantity: 0 }] }));
  assert.throws(() => cartSchema.parse({ items: [{ menu_item_id: "not-a-uuid", quantity: 1 }] }));
  assert.throws(() => cartSchema.parse({ items: Array.from({ length: 51 }, () => ({ menu_item_id: id, quantity: 1 })) }));
});

test("checkout: delivery needs address, takeaway needs slot, method defaults to razorpay", () => {
  const base = { items: [{ menu_item_id: id, quantity: 1 }], idempotency_key: "abcdefabcdefabcdef12" };
  assert.throws(() => checkoutSchema.parse({ ...base, fulfillment: "delivery" }), /delivery address/);
  assert.throws(() => checkoutSchema.parse({ ...base, fulfillment: "takeaway" }), /pickup time/);
  const ok = checkoutSchema.parse({ ...base, fulfillment: "delivery", address_id: id });
  assert.equal(ok.payment_method, "razorpay");
  assert.equal(checkoutSchema.parse({ ...base, fulfillment: "takeaway", pickup_slot_id: id, pickup_date: "2026-11-03", payment_method: "upi" }).payment_method, "upi");
  assert.throws(() => checkoutSchema.parse({ ...base, fulfillment: "delivery", address_id: id, payment_method: "cod" }));
});

test("contact form: honeypot must be empty; optional phone may be blank", () => {
  assert.ok(contactSchema.parse({ name: "Asha", email: "a@b.in", message: "Hello there", phone: "" }));
  assert.throws(() => contactSchema.parse({ name: "Asha", email: "a@b.in", message: "Hello there", website: "spam" }));
  assert.throws(() => contactSchema.parse({ name: "A", email: "bad", message: "x" }));
});

test("payment signature format and option groups", () => {
  assert.ok(verifyPaymentSchema.parse({ razorpay_order_id: "order_123", razorpay_payment_id: "pay_123", razorpay_signature: "a".repeat(64) }));
  assert.throws(() => verifyPaymentSchema.parse({ razorpay_order_id: "order_123", razorpay_payment_id: "pay_123", razorpay_signature: "zz" }));
  assert.ok(optionGroupsSchema.parse([{ id: "spice", name: "Spice", required: true, max: 1, choices: [{ id: "mild", label: "Mild", price_delta: 0 }] }]));
  assert.throws(() => optionGroupsSchema.parse([{ id: "Spice Level", name: "x", required: true, max: 1, choices: [] }]));
  assert.equal(slugify("Kuzhambu / Gravies"), "kuzhambu-gravies");
});
