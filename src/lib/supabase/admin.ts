import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Service-role client. BYPASSES RLS — use only in server code after the
 * caller's identity and role have been verified.
 */
export function createAdminClient(): SupabaseClient {
  if (!client) {
    client = createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
