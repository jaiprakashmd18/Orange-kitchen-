import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  AvailabilityWindow,
  HolidayClosure,
  MenuCategory,
  MenuItem,
  OperatingHour,
  RestaurantSettings,
  Review,
} from "@/lib/types";

// Read-only public data, fetched with the anon/user session so RLS applies.

/** Fallback used only when Supabase is not configured yet (local preview). */
const FALLBACK_SETTINGS: RestaurantSettings = {
  id: 1,
  name: "Orange Kitchen",
  tagline: "Freshly Prepared. Deliciously Served.",
  logo_url: null,
  announcement: null,
  phone: "+918072272313",
  whatsapp: "+918072272313",
  email: null,
  address_line1: "Shop 32, Pillaiyar Koil Street",
  address_line2: "Surapet Service Road",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600066",
  country: "India",
  latitude: null,
  longitude: null,
  google_maps_url: null,
  google_maps_embed_url: null,
  social_links: {},
  currency: "INR",
  timezone: "Asia/Kolkata",
  accepting_orders: false,
  delivery_enabled: true,
  takeaway_enabled: true,
  delivery_mode_default: "own",
  min_order_amount: 0,
  tax_rate_percent: 0,
  tax_label: "GST",
  prices_include_tax: false,
  packaging_charge: 0,
  prep_time_minutes: 30,
  payment_window_minutes: 20,
  upi_enabled: false,
  upi_id: null,
  upi_payee_name: null,
  pickup_instructions: null,
  about_story: null,
  gallery_urls: [],
  cancellation_policy: null,
  refund_policy: null,
  gstin: null,
  fssai_license: null,
};

const num = (v: unknown) => (v === null || v === undefined ? v : Number(v));

export function normalizeItem(row: Record<string, unknown>): MenuItem {
  return { ...(row as unknown as MenuItem), price: num(row.price) as number | null };
}

export function normalizeSettings(row: Record<string, unknown>): RestaurantSettings {
  const s = row as unknown as RestaurantSettings;
  return {
    ...s,
    min_order_amount: Number(s.min_order_amount),
    tax_rate_percent: Number(s.tax_rate_percent),
    packaging_charge: Number(s.packaging_charge),
    social_links: (s.social_links ?? {}) as Record<string, string>,
    gallery_urls: s.gallery_urls ?? [],
  };
}

export const getSettings = cache(async (): Promise<RestaurantSettings> => {
  if (!isSupabaseConfigured) return FALLBACK_SETTINGS;
  const supabase = await createClient();
  const { data, error } = await supabase.from("restaurant_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) {
    if (error) console.error("[settings]", error.message);
    return FALLBACK_SETTINGS;
  }
  return normalizeSettings(data);
});

export const getHours = cache(async () => {
  if (!isSupabaseConfigured) return { hours: [] as OperatingHour[], holidays: [] as HolidayClosure[] };
  const supabase = await createClient();
  const [hours, holidays] = await Promise.all([
    supabase.from("operating_hours").select("*").order("day_of_week").order("open_time"),
    supabase.from("holiday_closures").select("*").gte("closed_on", new Date(Date.now() - 86400000).toISOString().slice(0, 10)).order("closed_on"),
  ]);
  return { hours: (hours.data ?? []) as OperatingHour[], holidays: (holidays.data ?? []) as HolidayClosure[] };
});

export const getMenu = cache(async () => {
  if (!isSupabaseConfigured) return { categories: [] as MenuCategory[], items: [] as MenuItem[], windows: [] as AvailabilityWindow[] };
  const supabase = await createClient();
  const [cats, items, windows] = await Promise.all([
    supabase.from("menu_categories").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("menu_items").select("*").eq("is_published", true).order("sort_order").order("name"),
    supabase.from("menu_item_availability").select("*"),
  ]);
  if (cats.error) console.error("[menu]", cats.error.message);
  return {
    categories: (cats.data ?? []) as MenuCategory[],
    items: (items.data ?? []).map(normalizeItem),
    windows: (windows.data ?? []) as AvailabilityWindow[],
  };
});

export const getPublicReviews = cache(async (limit = 6) => {
  if (!isSupabaseConfigured) return [] as Review[];
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, order_id, user_id, rating, comment, display_name, is_approved, is_featured, created_at")
    .eq("is_approved", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Review[];
});

export function fullAddress(s: RestaurantSettings) {
  return [s.address_line1, s.address_line2, s.city && s.pincode ? `${s.city} – ${s.pincode}` : s.city, s.state, s.country]
    .filter(Boolean)
    .join(", ");
}

export function mapsLink(s: RestaurantSettings) {
  if (s.google_maps_url) return s.google_maps_url;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name}, ${fullAddress(s)}`)}`;
}
