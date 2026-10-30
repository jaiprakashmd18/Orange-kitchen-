import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/auth";

/** Postgres-backed fixed-window limiter (works across serverless instances). */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit]", error.message);
    return; // fail open on limiter outage; business rules still apply
  }
  if (data === false) throw new HttpError(429, "Too many requests. Please wait a moment and try again.", "RATE_LIMITED");
}
