"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrationStatus } from "@/lib/env";
import { getConfig, saveSecrets } from "@/lib/config";
import { configureAuth, migrateViaApi, requestOrigin, verifyToken } from "@/lib/supabase-management";
import { schemaStatus } from "@/lib/setup-status";
import type { ActionResult } from "@/components/admin/ActionForm";

export async function hasAdmin() {
  const { data, error } = await createAdminClient().from("user_roles").select("user_id").eq("role", "admin").limit(1);
  return !error && (data?.length ?? 0) > 0;
}

const schema = z.object({
  token: z.string().trim().min(10, "Paste your Supabase access token."),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(10, "Password must be at least 10 characters.").max(72),
});

/**
 * One-step first-run setup. The Supabase access token proves the visitor
 * owns this Supabase project; only then is the database created and the
 * owner (admin) account made. Disabled once an admin exists.
 */
export async function completeSetup(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    if (!integrationStatus().supabase) return { ok: false, error: "Connect Supabase in Vercel first (step 1)." };
    const input = schema.safeParse(Object.fromEntries(form));
    if (!input.success) return { ok: false, error: input.error.issues[0].message };
    const { token, name, email, password } = input.data;

    try {
      await verifyToken(token);
    } catch (e) {
      return { ok: false, error: `${(e as Error).message} — make sure you created the token while logged in to the Supabase account that owns this project.` };
    }

    if (!(await schemaStatus()).ready) await migrateViaApi(token);
    if (await hasAdmin()) return { ok: false, error: "This site is already set up. Log in at /auth/login." };

    const db = createAdminClient();
    const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    let userId = existing?.id as string | undefined;
    if (userId) {
      const { error } = await db.auth.admin.updateUserById(userId, { password, email_confirm: true, user_metadata: { full_name: name } });
      if (error) return { ok: false, error: error.message };
    } else {
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
      if (error || !data.user) return { ok: false, error: error?.message ?? "Could not create the account." };
      userId = data.user.id;
    }
    const role = await db.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (role.error) return { ok: false, error: role.error.message };
    await db.from("profiles").update({ full_name: name }).eq("id", userId);

    await saveSecrets({ supabase_access_token: token }, userId);
    const c = await getConfig();
    const smtp = c.smtp_host && c.smtp_user && c.smtp_pass
      ? { host: c.smtp_host, port: Number(c.smtp_port || 465), user: c.smtp_user, pass: c.smtp_pass, senderEmail: c.smtp_sender_email || c.smtp_user, senderName: c.smtp_sender_name || "Orange Kitchen" }
      : null;
    try {
      await configureAuth(token, await requestOrigin(), smtp);
    } catch (e) {
      console.error("[setup] auth config", e);
    }
    await db.from("audit_logs").insert({ actor_id: userId, action: "setup.completed", entity: "site", entity_id: "setup", details: { email } });
    redirect(`/auth/login?setup=done&next=/admin`);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    console.error("[setup]", e);
    return { ok: false, error: (e as Error).message || "Setup failed. Please try again." };
  }
}
