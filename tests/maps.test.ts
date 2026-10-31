import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapsEmbed, parseMapsLink } from "../src/lib/maps";

const IFRAME = `<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3885.33!2d80.19!3d13.14!5e0!3m2!1sen!2sge!4v1793435764050!5m2!1sen!2sge" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy`;

test("extracts src from pasted (even truncated) iframe code", () => {
  assert.equal(parseMapsEmbed(IFRAME), "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3885.33!2d80.19!3d13.14!5e0!3m2!1sen!2sge!4v1793435764050!5m2!1sen!2sge");
});

test("accepts a bare embed URL and rejects non-Google URLs", () => {
  assert.ok(parseMapsEmbed("https://www.google.com/maps/embed?pb=abc")!.startsWith("https://www.google.com/maps/embed"));
  assert.throws(() => parseMapsEmbed('<iframe src="https://evil.example/maps/embed?x">'));
  assert.throws(() => parseMapsEmbed("https://www.google.com/search?q=x"));
  assert.equal(parseMapsEmbed(""), null);
});

test("maps share links", () => {
  assert.equal(parseMapsLink("maps.app.goo.gl/AbC123"), "https://maps.app.goo.gl/AbC123");
  assert.ok(parseMapsLink("https://www.google.com/maps/place/Orange+Kitchen"));
  assert.throws(() => parseMapsLink("https://example.com"));
});
