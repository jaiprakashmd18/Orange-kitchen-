// Pure helpers for opening hours, item time windows and pickup slots (IST).

import { addDays, istDateTime, nowInIST } from "./format";
import type { AvailabilityWindow, HolidayClosure, MenuItem, OperatingHour, PickupSlot } from "./types";

const t = (s: string) => (s.length === 5 ? s + ":00" : s);

export function isOpenAt(hours: OperatingHour[], holidays: HolidayClosure[], at: Date) {
  const { date, time, dayOfWeek } = nowInIST(at);
  if (holidays.some((h) => h.closed_on === date)) return false;
  // No hours configured yet -> rely solely on the "accepting orders" switch.
  if (hours.length === 0) return true;
  return hours.some((h) => h.day_of_week === dayOfWeek && t(h.open_time) <= time && time < t(h.close_time));
}

export function hoursForDay(hours: OperatingHour[], day: number) {
  return hours.filter((h) => h.day_of_week === day).sort((a, b) => a.open_time.localeCompare(b.open_time));
}

/** Is the item inside one of its weekday windows at the given moment (no windows = always). */
export function itemAvailableAt(item: Pick<MenuItem, "id">, windows: AvailabilityWindow[], at: Date) {
  const own = windows.filter((w) => w.menu_item_id === item.id);
  if (own.length === 0) return true;
  const { time, dayOfWeek } = nowInIST(at);
  return own.some((w) => w.day_of_week === dayOfWeek && t(w.start_time) <= time && time < t(w.end_time));
}

export function isSpecialToday(item: Pick<MenuItem, "is_special" | "special_from" | "special_until">, at = new Date()) {
  if (!item.is_special) return false;
  const { date } = nowInIST(at);
  if (item.special_from && date < item.special_from) return false;
  if (item.special_until && date > item.special_until) return false;
  return true;
}

export interface PickupOption {
  slot_id: string;
  date: string;
  start_time: string;
  end_time: string;
  remaining: number;
}

/**
 * Pickup slots for today and the next `daysAhead` days that start at least
 * `leadMinutes` from now, are not on a holiday, and still have capacity.
 */
export function upcomingPickupOptions(args: {
  slots: PickupSlot[];
  holidays: HolidayClosure[];
  usage: Map<string, number>; // key `${date}|${slot_id}`
  leadMinutes: number;
  daysAhead?: number;
  now?: Date;
}): PickupOption[] {
  const now = args.now ?? new Date();
  const today = nowInIST(now).date;
  const earliest = now.getTime() + args.leadMinutes * 60_000;
  const out: PickupOption[] = [];
  for (let d = 0; d <= (args.daysAhead ?? 1); d++) {
    const date = addDays(today, d);
    if (args.holidays.some((h) => h.closed_on === date)) continue;
    const dow = istDateTime(date, "12:00").getUTCDay(); // noon IST is same calendar day in UTC
    for (const slot of args.slots) {
      if (!slot.is_active || slot.day_of_week !== dow) continue;
      if (istDateTime(date, slot.start_time).getTime() < earliest) continue;
      const used = args.usage.get(`${date}|${slot.id}`) ?? 0;
      const remaining = slot.max_orders - used;
      if (remaining <= 0) continue;
      out.push({ slot_id: slot.id, date, start_time: t(slot.start_time), end_time: t(slot.end_time), remaining });
    }
  }
  return out.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
}
