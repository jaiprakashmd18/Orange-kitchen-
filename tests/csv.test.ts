import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseFlag } from "../src/lib/csv";

test("parses quoted fields, commas, newlines and BOM", () => {
  const rows = parseCsv('﻿category,name,description\r\nLunch,"Meals, Full","Rice, sambar\nand ""special"" kuzhambu"\n\nBreakfast,Idly,\n');
  assert.deepEqual(rows, [
    ["category", "name", "description"],
    ["Lunch", "Meals, Full", 'Rice, sambar\nand "special" kuzhambu'],
    ["Breakfast", "Idly", ""],
  ]);
});

test("flags", () => {
  assert.equal(parseFlag("Veg"), true);
  assert.equal(parseFlag("Non-Veg"), false);
  assert.equal(parseFlag("yes"), true);
  assert.equal(parseFlag(""), null);
});
