import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { getConfig } from "@/lib/config";
import { commonsSearchUrl, parseCommons, parsePexels, photoQueries, type PhotoCandidate } from "@/lib/photo-sources";

// Automatic dish photos. Uses Pexels when PEXELS_API_KEY is set (best food
// photography, free licence), otherwise Wikimedia Commons (no key needed,
// freely licensed, credited). Chosen photos are copied into Supabase Storage
// so the menu never depends on a third-party host.

const UA = `OrangeKitchenMenu/1.0 (${publicEnv.siteUrl})`;
const MAX_BYTES = 8 * 1024 * 1024;

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const photoProvider = async () => ((await getConfig()).pexels_api_key ? "Pexels" : "Wikimedia Commons");

/** Up to `limit` candidate photos for a dish. */
export async function findPhotos(dish: string, category: string | null, limit = 6): Promise<PhotoCandidate[]> {
  const out: PhotoCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: PhotoCandidate[]) => {
    for (const x of c) {
      if (seen.has(x.full)) continue;
      seen.add(x.full);
      out.push(x);
    }
  };
  const pexelsKey = (await getConfig()).pexels_api_key;
  for (const q of photoQueries(dish, category)) {
    if (out.length >= limit) break;
    if (pexelsKey) {
      const json = await getJson<Parameters<typeof parsePexels>[0]>(
        `https://api.pexels.com/v1/search?${new URLSearchParams({ query: q, per_page: "8", orientation: "landscape" })}`,
        { Authorization: pexelsKey },
      );
      if (json) add(parsePexels(json));
    }
    const commons = await getJson<Parameters<typeof parseCommons>[0]>(commonsSearchUrl(q));
    if (commons) add(parseCommons(commons));
  }
  return out.slice(0, limit);
}

/** Downloads a candidate into Storage and sets it as the dish photo. */
export async function applyPhoto(itemId: string, c: PhotoCandidate) {
  const allowed = /^https:\/\/(upload\.wikimedia\.org|images\.pexels\.com)\//;
  if (!allowed.test(c.full)) throw new Error("Unsupported image source.");
  const res = await fetch(c.full, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) throw new Error(`Could not download the photo (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("Photo is too large.");
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const path = `menu/auto/${itemId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const db = createAdminClient();
  const up = await db.storage.from("public-media").upload(path, buf, { contentType: type, cacheControl: "31536000", upsert: false });
  if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);
  const url = db.storage.from("public-media").getPublicUrl(path).data.publicUrl;
  const { error } = await db
    .from("menu_items")
    .update({ image_url: url, image_source: c.source, image_credit: c.credit.slice(0, 200), image_credit_url: c.creditUrl })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  return url;
}

/** Fills in photos for dishes that have none (bounded per call for serverless time limits). */
export async function autoPhotosForMissing(limit = 12, onlyIds?: string[]) {
  const db = createAdminClient();
  let q = db.from("menu_items").select("id, name, menu_categories(name)").is("image_url", null).order("sort_order").limit(limit);
  if (onlyIds?.length) q = q.in("id", onlyIds);
  const { data } = await q;
  const result = { added: 0, notFound: [] as string[], failed: [] as string[] };
  for (const item of data ?? []) {
    const cat = (item.menu_categories as unknown as { name: string } | null)?.name ?? null;
    try {
      const [best] = await findPhotos(item.name, cat, 1);
      if (!best) {
        result.notFound.push(item.name);
        continue;
      }
      await applyPhoto(item.id, best);
      result.added++;
    } catch (e) {
      console.error("[auto-photo]", item.name, e);
      result.failed.push(item.name);
    }
  }
  const { count } = await db.from("menu_items").select("id", { count: "exact", head: true }).is("image_url", null);
  return { ...result, remaining: count ?? 0 };
}
