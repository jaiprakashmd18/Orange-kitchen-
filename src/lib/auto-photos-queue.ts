import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoPhotosForMissing } from "@/lib/food-photos";

/** After the response is sent, find photos for these dishes (if automatic photos are on). */
export async function queueAutoPhotos(ids?: string[]) {
  const { data } = await createAdminClient().from("restaurant_settings").select("auto_dish_photos").eq("id", 1).maybeSingle();
  if (data && data.auto_dish_photos === false) return;
  after(() => autoPhotosForMissing(12, ids).catch((e) => console.error("[auto-photos]", e)));
}
