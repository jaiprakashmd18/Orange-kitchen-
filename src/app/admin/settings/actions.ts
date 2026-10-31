"use server";

import { z } from "zod";
import { adminAction, bool, check, num, optStr, str } from "@/lib/admin-action";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/auth";

/** Accepts "instagram.com/x", "www…" or "http://…" and normalises to https://. */
const url = (v: string | null, label: string) => {
  if (!v) return null;
  let u = v.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u.replace(/^\/+/, "")}`;
  u = u.replace(/^http:\/\//i, "https://");
  try {
    const parsed = new URL(u);
    if (!parsed.hostname.includes(".")) throw new Error();
    return parsed.toString();
  } catch {
    throw new HttpError(400, `${label}: "${v}" is not a valid web link.`);
  }
};

const range = (v: number | null, label: string, min: number, max: number, fallback: number) => {
  if (v === null) return fallback;
  if (v < min || v > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
  return v;
};
const phone = (v: string | null, label: string) => {
  if (!v) return null;
  const d = v.replace(/[\s-]/g, "");
  if (!/^\+?\d{10,13}$/.test(d)) throw new HttpError(400, `${label} looks invalid.`);
  return d.length === 10 ? `+91${d}` : d.startsWith("+") ? d : `+${d}`;
};

export const saveSettings = adminAction({ audit: "settings.updated", revalidate: ["/"] }, async (f, ctx) => {
  const email = optStr(f, "email");
  if (email && !z.string().email().safeParse(email).success) throw new HttpError(400, "Email looks invalid.");
  const socials: Record<string, string> = {};
  for (const k of ["instagram", "facebook", "youtube", "x", "google", "zomato", "swiggy"]) {
    const v = url(optStr(f, `social_${k}`), k);
    if (v) socials[k] = v;
  }
  const gallery = str(f, "gallery_urls").split("\n").map((s) => s.trim()).filter(Boolean).map((g) => url(g, "Gallery image")!);
  const lat = num(f, "latitude");
  const lng = num(f, "longitude");
  const row = {
    name: str(f, "name") || "Orange Kitchen",
    tagline: str(f, "tagline") || "Freshly Prepared. Deliciously Served.",
    logo_url: optStr(f, "logo_url"),
    announcement: optStr(f, "announcement")?.slice(0, 200) ?? null,
    phone: phone(optStr(f, "phone"), "Phone"),
    whatsapp: phone(optStr(f, "whatsapp"), "WhatsApp number"),
    email,
    address_line1: optStr(f, "address_line1"),
    address_line2: optStr(f, "address_line2"),
    city: optStr(f, "city"),
    state: optStr(f, "state"),
    pincode: optStr(f, "pincode"),
    latitude: lat,
    longitude: lng,
    google_maps_url: url(optStr(f, "google_maps_url"), "Google Maps link"),
    google_maps_embed_url: url(optStr(f, "google_maps_embed_url"), "Google Maps embed link"),
    social_links: socials,
    accepting_orders: bool(f, "accepting_orders"),
    delivery_enabled: bool(f, "delivery_enabled"),
    takeaway_enabled: bool(f, "takeaway_enabled"),
    delivery_mode_default: str(f, "delivery_mode_default") === "third_party" ? "third_party" : "own",
    min_order_amount: range(num(f, "min_order_amount"), "Minimum order", 0, 100000, 0),
    tax_rate_percent: range(num(f, "tax_rate_percent"), "Tax rate", 0, 50, 0),
    tax_label: str(f, "tax_label") || "GST",
    prices_include_tax: bool(f, "prices_include_tax"),
    packaging_charge: range(num(f, "packaging_charge"), "Packaging charge", 0, 10000, 0),
    prep_time_minutes: range(num(f, "prep_time_minutes"), "Preparation time", 5, 240, 30),
    payment_window_minutes: range(num(f, "payment_window_minutes"), "Payment window", 5, 120, 20),
    upi_enabled: bool(f, "upi_enabled"),
    upi_id: optStr(f, "upi_id")?.replace(/\s/g, "").toLowerCase() ?? null,
    upi_payee_name: optStr(f, "upi_payee_name")?.slice(0, 50) ?? null,
    pickup_instructions: optStr(f, "pickup_instructions"),
    about_story: optStr(f, "about_story"),
    gallery_urls: gallery,
    cancellation_policy: optStr(f, "cancellation_policy"),
    refund_policy: optStr(f, "refund_policy"),
    gstin: optStr(f, "gstin"),
    fssai_license: optStr(f, "fssai_license"),
    updated_by: ctx.userId,
  };
  if (row.pincode && !/^[1-9]\d{5}$/.test(row.pincode)) throw new HttpError(400, "Pincode must be 6 digits.");
  if (row.upi_id && !/^[a-z0-9._-]{2,128}@[a-z0-9]{2,64}$/.test(row.upi_id)) {
    throw new HttpError(400, `UPI ID "${row.upi_id}" looks wrong — it should look like name@okaxis or 9876543210@ybl.`);
  }
  if (row.upi_enabled && !row.upi_id) throw new HttpError(400, "Enter your UPI ID to turn on UPI payments.");
  if (lat !== null && (lat < -90 || lat > 90)) throw new HttpError(400, "Latitude must be between -90 and 90.");
  if (lng !== null && (lng < -180 || lng > 180)) throw new HttpError(400, "Longitude must be between -180 and 180.");
  // Role was verified server-side by adminAction; write with the service role and
  // upsert so a missing settings row can never make the save silently do nothing.
  const { data: saved, error } = await createAdminClient()
    .from("restaurant_settings")
    .upsert({ id: 1, ...row }, { onConflict: "id" })
    .select("id")
    .single();
  if (error || !saved) throw new HttpError(500, `Could not save settings: ${error?.message ?? "no row returned"}`);
  return { message: "Settings saved.", entityId: "1", details: { accepting_orders: row.accepting_orders, tax: row.tax_rate_percent } };
});

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time");

export const addHours = adminAction({ audit: "hours.added", revalidate: ["/admin/hours", "/"] }, async (f) => {
  const days = f.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6);
  if (!days.length) throw new HttpError(400, "Select at least one day.");
  const open = time.parse(str(f, "open_time"));
  const close = time.parse(str(f, "close_time"));
  if (close <= open) throw new HttpError(400, "Closing time must be after opening time.");
  const supabase = await createClient();
  check(await supabase.from("operating_hours").insert(days.map((d) => ({ day_of_week: d, open_time: open, close_time: close, label: optStr(f, "label") }))));
  return { message: "Hours added." };
});

export const deleteHours = adminAction({ audit: "hours.deleted", revalidate: ["/admin/hours", "/"] }, async (f) => {
  const supabase = await createClient();
  check(await supabase.from("operating_hours").delete().eq("id", z.string().uuid().parse(str(f, "id"))));
  return { message: "Removed." };
});

export const addHoliday = adminAction({ audit: "holiday.added", revalidate: ["/admin/hours", "/"] }, async (f) => {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date").parse(str(f, "closed_on"));
  const supabase = await createClient();
  check(await supabase.from("holiday_closures").insert({ closed_on: date, reason: optStr(f, "reason") }));
  return { message: "Holiday added." };
});

export const deleteHoliday = adminAction({ audit: "holiday.deleted", revalidate: ["/admin/hours", "/"] }, async (f) => {
  const supabase = await createClient();
  check(await supabase.from("holiday_closures").delete().eq("id", z.string().uuid().parse(str(f, "id"))));
  return { message: "Removed." };
});

export const saveArea = adminAction({ audit: "serviceable_area.saved", revalidate: ["/admin/delivery-areas"] }, async (f) => {
  const id = optStr(f, "id");
  const pincode = str(f, "pincode");
  if (!/^[1-9]\d{5}$/.test(pincode)) throw new HttpError(400, "Pincode must be 6 digits.");
  const fee = num(f, "delivery_fee");
  if (fee === null || fee < 0) throw new HttpError(400, "Enter the delivery fee (0 for free).");
  const row = {
    name: str(f, "name") || pincode,
    pincode,
    delivery_fee: fee,
    free_delivery_above: num(f, "free_delivery_above"),
    min_order_amount: num(f, "min_order_amount") ?? 0,
    estimated_minutes: num(f, "estimated_minutes") ?? 45,
    is_active: bool(f, "is_active"),
  };
  const supabase = await createClient();
  if (id) check(await supabase.from("serviceable_areas").update(row).eq("id", id));
  else check(await supabase.from("serviceable_areas").insert(row));
  return { message: "Delivery area saved." };
});

export const deleteArea = adminAction({ audit: "serviceable_area.deleted", revalidate: ["/admin/delivery-areas"] }, async (f) => {
  const supabase = await createClient();
  check(await supabase.from("serviceable_areas").delete().eq("id", z.string().uuid().parse(str(f, "id"))));
  return { message: "Removed." };
});

export const generateSlots = adminAction({ audit: "pickup_slots.generated", revalidate: ["/admin/pickup-slots"] }, async (f) => {
  const days = f.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6);
  if (!days.length) throw new HttpError(400, "Select at least one day.");
  const start = time.parse(str(f, "start")).slice(0, 5);
  const end = time.parse(str(f, "end")).slice(0, 5);
  const every = num(f, "interval") ?? 30;
  const cap = num(f, "max_orders") ?? 10;
  if (every < 10 || every > 240) throw new HttpError(400, "Slot length must be 10–240 minutes.");
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const rows = [];
  for (const d of days) for (let m = toMin(start); m + every <= toMin(end); m += every) rows.push({ day_of_week: d, start_time: fmt(m), end_time: fmt(m + every), max_orders: cap, is_active: true });
  if (!rows.length) throw new HttpError(400, "No slots fit in that time range.");
  const supabase = await createClient();
  check(await supabase.from("pickup_slots").upsert(rows, { onConflict: "day_of_week,start_time" }));
  return { message: `${rows.length} slots saved.` };
});

export const updateSlot = adminAction({ audit: "pickup_slot.updated", revalidate: ["/admin/pickup-slots"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const supabase = await createClient();
  if (str(f, "delete") === "1") {
    const res = await supabase.from("pickup_slots").delete().eq("id", id);
    if (res.error?.code === "23503") check(await supabase.from("pickup_slots").update({ is_active: false }).eq("id", id));
    else check(res);
    return { message: "Removed." };
  }
  check(await supabase.from("pickup_slots").update({ max_orders: num(f, "max_orders") ?? 10, is_active: bool(f, "is_active") }).eq("id", id));
  return { message: "Saved." };
});

export const saveCoupon = adminAction({ audit: "coupon.saved", revalidate: ["/admin/coupons"] }, async (f) => {
  const id = optStr(f, "id");
  const code = str(f, "code").toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new HttpError(400, "Code must be 3–30 letters/numbers.");
  const type = str(f, "discount_type") === "flat" ? "flat" : "percent";
  const value = num(f, "discount_value");
  if (!value || value <= 0 || (type === "percent" && value > 100)) throw new HttpError(400, "Enter a valid discount.");
  const applies = str(f, "applies_to");
  const from = optStr(f, "valid_from");
  const until = optStr(f, "valid_until");
  const row = {
    code,
    description: optStr(f, "description"),
    discount_type: type,
    discount_value: value,
    max_discount: num(f, "max_discount"),
    min_order_amount: num(f, "min_order_amount") ?? 0,
    valid_from: from ? new Date(`${from}T00:00:00+05:30`).toISOString() : null,
    valid_until: until ? new Date(`${until}T23:59:59+05:30`).toISOString() : null,
    usage_limit: num(f, "usage_limit"),
    per_user_limit: num(f, "per_user_limit") ?? 1,
    applies_to: applies === "delivery" || applies === "takeaway" ? applies : null,
    is_active: bool(f, "is_active"),
  };
  const supabase = await createClient();
  if (id) check(await supabase.from("coupons").update(row).eq("id", id));
  else check(await supabase.from("coupons").insert(row));
  return { message: "Coupon saved.", entityId: code };
});

/** Creates pickup slots covering every opening-hours window. */
export const slotsFromHours = adminAction({ audit: "pickup_slots.generated_from_hours", revalidate: ["/admin/pickup-slots"] }, async (f) => {
  const every = num(f, "interval") ?? 30;
  const cap = num(f, "max_orders") ?? 10;
  if (every < 10 || every > 240) throw new HttpError(400, "Slot length must be 10–240 minutes.");
  const supabase = await createClient();
  const { data: hours } = await supabase.from("operating_hours").select("day_of_week, open_time, close_time");
  if (!hours?.length) throw new HttpError(400, "Set opening hours first (Admin → Hours & holidays).");
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const rows = [];
  for (const h of hours) for (let m = toMin(h.open_time); m + every <= toMin(h.close_time); m += every) rows.push({ day_of_week: h.day_of_week, start_time: fmt(m), end_time: fmt(m + every), max_orders: cap, is_active: true });
  if (!rows.length) throw new HttpError(400, "Opening windows are shorter than one slot.");
  check(await supabase.from("pickup_slots").upsert(rows, { onConflict: "day_of_week,start_time" }));
  return { message: `${rows.length} pickup slots created from your opening hours.` };
});


/** One-click online/offline switch for ordering (dashboard + top banner). */
export const setAcceptingOrders = adminAction({ roles: ["admin"], audit: "settings.accepting_orders", revalidate: ["/"] }, async (f, ctx) => {
  const on = str(f, "value") === "true";
  const { error } = await createAdminClient()
    .from("restaurant_settings")
    .upsert({ id: 1, accepting_orders: on, updated_by: ctx.userId }, { onConflict: "id" });
  if (error) throw new HttpError(500, `Could not update: ${error.message}`);
  return { message: on ? "Online ordering is now LIVE." : "Online ordering paused.", details: { accepting_orders: on } };
});
