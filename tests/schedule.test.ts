import { test } from "node:test";
import assert from "node:assert/strict";
import { isOpenAt, itemAvailableAt, upcomingPickupOptions, isSpecialToday } from "../src/lib/schedule";
import { nowInIST, istDateTime } from "../src/lib/format";

// 2026-10-30 is a Friday (day 5)
const at = (time: string) => istDateTime("2026-10-30", time);

test("nowInIST resolves IST regardless of server tz", () => {
  const n = nowInIST(new Date("2026-10-30T20:00:00Z")); // 01:30 IST next day
  assert.equal(n.date, "2026-10-31");
  assert.equal(n.dayOfWeek, 6);
});

test("opening hours and holidays", () => {
  const hours = [{ id: "1", day_of_week: 5, open_time: "07:00:00", close_time: "11:00:00", label: null },
                 { id: "2", day_of_week: 5, open_time: "12:00", close_time: "15:30", label: null }];
  assert.equal(isOpenAt(hours, [], at("08:00")), true);
  assert.equal(isOpenAt(hours, [], at("11:30")), false);
  assert.equal(isOpenAt(hours, [], at("15:29")), true);
  assert.equal(isOpenAt(hours, [{ id: "h", closed_on: "2026-10-30", reason: null }], at("08:00")), false);
  assert.equal(isOpenAt([], [], at("03:00")), true);
});

test("item windows", () => {
  const w = [{ id: "w", menu_item_id: "i", day_of_week: 5, start_time: "07:00", end_time: "11:00" }];
  assert.equal(itemAvailableAt({ id: "i" }, w, at("09:00")), true);
  assert.equal(itemAvailableAt({ id: "i" }, w, at("12:00")), false);
  assert.equal(itemAvailableAt({ id: "other" }, w, at("12:00")), true);
});

test("pickup options respect lead time, capacity and holidays", () => {
  const slots = [
    { id: "s1", day_of_week: 5, start_time: "12:00:00", end_time: "12:30:00", max_orders: 2, is_active: true },
    { id: "s2", day_of_week: 5, start_time: "13:00:00", end_time: "13:30:00", max_orders: 2, is_active: true },
    { id: "s3", day_of_week: 6, start_time: "08:00:00", end_time: "08:30:00", max_orders: 2, is_active: true },
  ];
  const usage = new Map([["2026-10-30|s2", 2]]);
  const opts = upcomingPickupOptions({ slots, holidays: [], usage, leadMinutes: 30, now: at("11:15") });
  assert.deepEqual(opts.map((o) => o.slot_id), ["s1", "s3"]);
  const late = upcomingPickupOptions({ slots, holidays: [{ id: "h", closed_on: "2026-10-31", reason: null }], usage, leadMinutes: 30, now: at("11:45") });
  assert.deepEqual(late, []);
});

test("specials by date range", () => {
  assert.equal(isSpecialToday({ is_special: true, special_from: "2026-10-01", special_until: "2026-10-31" }, at("10:00")), true);
  assert.equal(isSpecialToday({ is_special: true, special_from: "2026-11-01", special_until: null }, at("10:00")), false);
  assert.equal(isSpecialToday({ is_special: false, special_from: null, special_until: null }, at("10:00")), false);
});
