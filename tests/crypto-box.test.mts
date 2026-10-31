import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
const { seal, open } = await import("../src/lib/crypto-box");

test("secrets round-trip and are not stored in plain text", () => {
  const sealed = seal("abcd efgh ijkl mnop");
  assert.ok(!sealed.includes("abcd"));
  assert.equal(open(sealed), "abcd efgh ijkl mnop");
  assert.notEqual(seal("x"), seal("x"), "random IV per value");
});

test("tampered or foreign values are rejected", () => {
  const sealed = seal("secret");
  const parts = sealed.split(".");
  parts[3] = Buffer.from("other").toString("base64");
  assert.equal(open(parts.join(".")), null);
  assert.equal(open("garbage"), null);
});
