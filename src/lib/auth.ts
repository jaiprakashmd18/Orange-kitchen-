import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { AppRole } from "@/lib/types";

export const getSessionUser = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(); // validates the JWT with Supabase Auth
  return user;
});

export const getRoles = cache(async (): Promise<AppRole[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r: { role: AppRole }) => r.role);
});

export async function requireUser(next = "/account") {
  const user = await getSessionUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** For pages/layouts: redirects when the user lacks every listed role. */
export async function requireRole(roles: AppRole[], next = "/") {
  const user = await requireUser(next);
  const mine = await getRoles();
  if (!roles.some((r) => mine.includes(r))) redirect("/?error=forbidden");
  return { user, roles: mine };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** For route handlers and server actions: throws instead of redirecting. */
export async function assertUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.", "UNAUTHENTICATED");
  return user;
}

export async function assertRole(roles: AppRole[]) {
  const user = await assertUser();
  const mine = await getRoles();
  if (!roles.some((r) => mine.includes(r))) throw new HttpError(403, "You do not have permission to do that.", "FORBIDDEN");
  return { user, roles: mine };
}
