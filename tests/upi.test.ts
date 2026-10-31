import { test } from "node:test";
import assert from "node:assert/strict";
import { upiPayLink, UTR_PATTERN } from "../src/lib/payment-methods";

test("UPI deep link has payee, exact amount, INR and order reference", () => {
  const link = upiPayLink({ upiId: "orangekitchen@okaxis", payeeName: "Orange Kitchen", amount: 408, orderNumber: "OK261031-1001" });
  const u = new URL(link.replace("upi://pay", "https://x/pay"));
  assert.ok(link.startsWith("upi://pay?"));
  assert.equal(u.searchParams.get("pa"), "orangekitchen@okaxis");
  assert.equal(u.searchParams.get("pn"), "Orange Kitchen");
  assert.equal(u.searchParams.get("am"), "408.00");
  assert.equal(u.searchParams.get("cu"), "INR");
  assert.equal(u.searchParams.get("tr"), "OK261031-1001");
  assert.ok(!link.includes("+"), "spaces encoded as %20 for UPI apps");
  assert.ok(upiPayLink({ upiId: "a@b", payeeName: "X", amount: 1.5, orderNumber: "1" }, "tez://upi/pay").startsWith("tez://upi/pay?"));
});

test("UTR must be 12 digits", () => {
  assert.ok(UTR_PATTERN.test("123456789012"));
  assert.ok(!UTR_PATTERN.test("12345678901"));
  assert.ok(!UTR_PATTERN.test("12345678901a"));
});
