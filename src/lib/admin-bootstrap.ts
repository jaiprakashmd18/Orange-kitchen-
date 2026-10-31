import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const digest = (v: string) => crypto.createHash("sha256").update(v).digest();

export const adminEmail = () => process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;

/** Constant-time check against ADMIN_EMAIL / ADMIN_PASSWORD from the environment. */
export function matchesAdminEnv(email: string, password: string) {
  const envEmail = adminEmail();
  const envPass = process.env.ADMIN_PASSWORD;
  if (!envEmail || !envPass || envPass.length < 10) return false;
  const a = crypto.timingSafeEqual(digest(email.trim().toLowerCase()), digest(envEmail));
  const b = crypto.timingSafeEqual(digest(password), digest(envPass));
  return a && b;
}

/** Grants the admin role (idempotent). */
export async function grantAdmin(userId: string) {
  const { error } = await createAdminClient().from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (error) throw new Error(error.message);
}

/**
 * Makes sure the ADMIN_EMAIL account exists, is confirmed, uses
 * ADMIN_PASSWORD and has the admin role. Only call after matchesAdminEnv().
 */
export async function ensureEnvAdmin() {
  const db = createAdminClient();
  const email = adminEmail()!;
  const password = process.env.ADMIN_PASSWORD!;
  const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  let userId = profile?.id as string | undefined;
  if (userId) {
    const { error } = await db.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: process.env.ADMIN_NAME || "Orange Kitchen Admin" },
    });
    if (error || !data.user) throw new Error(error?.message ?? "Could not create the admin user");
    userId = data.user.id;
  }
  await grantAdmin(userId);
  return userId;
}
