import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPickupOptions } from "@/lib/orders";
import { normalizeSettings } from "@/lib/data";
import { handleRouteError } from "@/lib/http";
import type { HolidayClosure, PickupSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createAdminClient();
    const [s, slots, holidays] = await Promise.all([
      db.from("restaurant_settings").select("*").eq("id", 1).single(),
      db.from("pickup_slots").select("*").eq("is_active", true),
      db.from("holiday_closures").select("*"),
    ]);
    const settings = normalizeSettings(s.data!);
    const options = await getPickupOptions(settings, (slots.data ?? []) as PickupSlot[], (holidays.data ?? []) as HolidayClosure[]);
    return NextResponse.json({ options, pickup_instructions: settings.pickup_instructions });
  } catch (err) {
    return handleRouteError(err, "pickup-slots");
  }
}
