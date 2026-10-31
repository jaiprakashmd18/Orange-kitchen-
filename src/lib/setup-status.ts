import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrationStatus } from "@/lib/env";

/** Whether the database schema has been applied (checked with the service role). */
export async function schemaStatus(): Promise<{ ready: boolean; error: string | null }> {
  if (!integrationStatus().supabase) return { ready: false, error: "Supabase keys are not set." };
  try {
    const { error } = await createAdminClient().from("restaurant_settings").select("id").limit(1);
    if (!error) return { ready: true, error: null };
    return { ready: false, error: error.message };
  } catch (e) {
    return { ready: false, error: (e as Error).message };
  }
}
