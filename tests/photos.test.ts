import { test } from "node:test";
import assert from "node:assert/strict";
import { commonsSearchUrl, parseCommons, parsePexels, photoQueries } from "../src/lib/photo-sources";

test("queries prefer specific phrasing", () => {
  assert.deepEqual(photoQueries("Masala Dosa", "Dosa"), ["Masala Dosa south indian food", "Masala Dosa dish", "Masala Dosa"]);
  assert.equal(photoQueries("Crab Gravy", "Special Gravies").at(-1), "Special Gravies Crab Gravy");
});

test("parses Commons: keeps free-licensed landscape JPEGs, credits author + licence", () => {
  const json = {
    query: {
      pages: {
        "1": { title: "File:Dosa.jpg", index: 2, imageinfo: [{ mime: "image/jpeg", width: 2000, height: 1500, thumburl: "https://upload.wikimedia.org/t/1000px-Dosa.jpg", url: "https://upload.wikimedia.org/Dosa.jpg", descriptionurl: "https://commons.wikimedia.org/wiki/File:Dosa.jpg", extmetadata: { Artist: { value: '<a href="x">Ravi K</a>' }, LicenseShortName: { value: "CC BY-SA 4.0" } } }] },
        "2": { title: "File:Logo.png", index: 1, imageinfo: [{ mime: "image/png", width: 900, height: 900, url: "u", descriptionurl: "d" }] },
        "3": { title: "File:Tiny.jpg", index: 3, imageinfo: [{ mime: "image/jpeg", width: 300, height: 200, url: "u", descriptionurl: "d", extmetadata: { LicenseShortName: { value: "CC BY 2.0" } } }] },
        "4": { title: "File:Unknown.jpg", index: 4, imageinfo: [{ mime: "image/jpeg", width: 1200, height: 900, url: "u", descriptionurl: "d", extmetadata: { LicenseShortName: { value: "Fair use" } } }] },
      },
    },
  };
  const out = parseCommons(json);
  assert.equal(out.length, 1);
  assert.equal(out[0].full, "https://upload.wikimedia.org/t/1000px-Dosa.jpg");
  assert.equal(out[0].credit, "Ravi K · CC BY-SA 4.0 · Wikimedia Commons");
});

test("parses Pexels", () => {
  const out = parsePexels({ photos: [{ width: 4000, height: 3000, url: "https://www.pexels.com/photo/1", photographer: "Asha", src: { medium: "m.jpg", large: "l.jpg" } }] });
  assert.deepEqual(out[0], { source: "pexels", thumb: "m.jpg", full: "l.jpg", credit: "Photo by Asha on Pexels", creditUrl: "https://www.pexels.com/photo/1", width: 4000, height: 3000 });
});

test("commons URL searches the File namespace for bitmaps", () => {
  const u = new URL(commonsSearchUrl("Idli"));
  assert.equal(u.searchParams.get("gsrnamespace"), "6");
  assert.equal(u.searchParams.get("gsrsearch"), "Idli filetype:bitmap");
});

import { parsePixabay, pixabaySearchUrl } from "../src/lib/photo-sources";

test("parses Pixabay hits and builds a food-photo search", () => {
  const out = parsePixabay({ hits: [
    { pageURL: "https://pixabay.com/photos/dosa-1/", webformatURL: "https://pixabay.com/get/w.jpg", largeImageURL: "https://pixabay.com/get/l.jpg", imageWidth: 4000, imageHeight: 2600, user: "chef" },
    { pageURL: "p", webformatURL: "w", largeImageURL: "l", imageWidth: 300, imageHeight: 200, user: "x" },
  ] });
  assert.equal(out.length, 1);
  assert.equal(out[0].credit, "Image by chef on Pixabay");
  const u = new URL(pixabaySearchUrl("k", "Masala Dosa"));
  assert.equal(u.searchParams.get("category"), "food");
  assert.equal(u.searchParams.get("q"), "Masala Dosa");
});
