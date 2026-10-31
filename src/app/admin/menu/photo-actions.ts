"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/admin-action";
import { assertRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyPhoto, autoPhotosForMissing, findPhotos, photoProvider } from "@/lib/food-photos";
import { audit } from "@/lib/audit";
import type { PhotoCandidate } from "@/lib/photo-sources";

const STAFF = ["admin", "staff"] as ("admin" | "staff")[];

/** Bulk: add a photo to every dish without one (a batch per click). */
export const autoAddPhotos = adminAction({ roles: STAFF, audit: "menu.auto_photos", revalidate: ["/admin/menu", "/menu", "/"] }, async () => {
  const r = await autoPhotosForMissing(8);
  const parts = [`Added ${r.added} photo${r.added === 1 ? "" : "s"} from ${await photoProvider()}.`];
  if (r.notFound.length) parts.push(`No good photo found for: ${r.notFound.join(", ")} — upload your own.`);
  if (r.failed.length) parts.push(`Couldn't download: ${r.failed.join(", ")}.`);
  if (r.remaining > 0) parts.push(`${r.remaining} dish(es) still without a photo — click again to continue.`);
  return { message: parts.join(" "), details: r };
});

/** Candidates for one dish (shown as a picker in the dish editor). */
export async function suggestPhotos(itemId: string): Promise<{ error: string | null; candidates: PhotoCandidate[] }> {
  try {
    await assertRole(STAFF);
    const id = z.string().uuid().parse(itemId);
    const { data } = await createAdminClient().from("menu_items").select("name, menu_categories(name)").eq("id", id).single();
    if (!data) return { error: "Dish not found.", candidates: [] };
    const cat = (data.menu_categories as unknown as { name: string } | null)?.name ?? null;
    const candidates = await findPhotos(data.name, cat, 9);
    return { error: candidates.length ? null : `No photos found for “${data.name}”. Try uploading your own.`, candidates };
  } catch (e) {
    return { error: (e as Error).message || "Could not search photos.", candidates: [] };
  }
}

const candidateSchema = z.object({
  source: z.enum(["pexels", "wikimedia", "pixabay"]),
  thumb: z.string().url(),
  full: z.string().url().regex(/^https:\/\/(upload\.wikimedia\.org|images\.pexels\.com|pixabay\.com|cdn\.pixabay\.com)\//),
  credit: z.string().max(200),
  creditUrl: z.string().url().regex(/^https:\/\/(commons\.wikimedia\.org|www\.pexels\.com|pixabay\.com)\//),
  width: z.number(),
  height: z.number(),
});

export async function choosePhoto(itemId: string, candidate: PhotoCandidate): Promise<{ error: string | null; url?: string }> {
  try {
    const { user } = await assertRole(STAFF);
    const id = z.string().uuid().parse(itemId);
    const url = await applyPhoto(id, candidateSchema.parse(candidate));
    await audit({ actorId: user.id, action: "menu_item.photo_chosen", entity: "menu_item", entityId: id, details: { source: candidate.source, credit: candidate.credit } });
    revalidatePath("/menu");
    revalidatePath("/");
    revalidatePath(`/admin/menu/${id}`);
    return { error: null, url };
  } catch (e) {
    return { error: (e as Error).message || "Could not use that photo." };
  }
}
