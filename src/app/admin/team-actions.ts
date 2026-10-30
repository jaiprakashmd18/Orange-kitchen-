"use server";

import { z } from "zod";
import { adminAction, bool, check, optStr, str } from "@/lib/admin-action";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/auth";
import { phoneSchema } from "@/lib/validation";
import type { AppRole } from "@/lib/types";

async function findUserByEmail(email: string) {
  const { data } = await createAdminClient().from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  return data?.id as string | undefined;
}

/** Creates (or links) a rider login and the delivery_personnel record. */
export const createRider = adminAction({ audit: "delivery_personnel.created", revalidate: ["/admin/delivery-team"] }, async (f, ctx) => {
  const email = z.string().trim().toLowerCase().email("Enter the rider's email").parse(str(f, "email"));
  const full_name = z.string().trim().min(2, "Enter the rider's name").max(120).parse(str(f, "full_name"));
  const phone = phoneSchema.parse(str(f, "phone"));
  const password = str(f, "password");
  const admin = createAdminClient();

  let userId = await findUserByEmail(email);
  if (!userId) {
    if (password.length < 10) throw new HttpError(400, "Set a temporary password of at least 10 characters (the rider can change it later).");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, phone } });
    if (error || !data.user) throw new HttpError(400, error?.message ?? "Could not create the login.");
    userId = data.user.id;
  }
  check(await admin.from("user_roles").upsert({ user_id: userId, role: "delivery", granted_by: ctx.userId }, { onConflict: "user_id,role" }));
  check(await admin.from("delivery_personnel").upsert({ user_id: userId, full_name, phone: phone.startsWith("+") ? phone : `+91${phone}`, vehicle_number: optStr(f, "vehicle_number"), is_active: true }, { onConflict: "user_id" }));
  return { message: `${full_name} can now log in at /delivery with ${email}.`, entityId: userId };
});

export const updateRider = adminAction({ audit: "delivery_personnel.updated", revalidate: ["/admin/delivery-team"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const phone = phoneSchema.parse(str(f, "phone"));
  const active = bool(f, "is_active");
  const supabase = await createClient();
  const row = check(await supabase.from("delivery_personnel").update({
    full_name: str(f, "full_name"),
    phone: phone.startsWith("+") ? phone : `+91${phone}`,
    vehicle_number: optStr(f, "vehicle_number"),
    is_active: active,
    ...(active ? {} : { is_on_duty: false }),
  }).eq("id", id).select("user_id").single()) as { user_id: string };
  // Deactivated riders lose the delivery role (and thus all order access).
  const admin = createAdminClient();
  if (active) check(await admin.from("user_roles").upsert({ user_id: row.user_id, role: "delivery" }, { onConflict: "user_id,role" }));
  else check(await admin.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "delivery"));
  return { message: "Rider saved.", entityId: id };
});

export const grantRole = adminAction({ audit: "user_role.granted", revalidate: ["/admin/staff"] }, async (f, ctx) => {
  const email = z.string().trim().toLowerCase().email().parse(str(f, "email"));
  const role = z.enum(["admin", "staff"]).parse(str(f, "role")) as AppRole;
  const userId = await findUserByEmail(email);
  if (!userId) throw new HttpError(404, "No account with that email. Ask them to sign up first.");
  check(await createAdminClient().from("user_roles").upsert({ user_id: userId, role, granted_by: ctx.userId }, { onConflict: "user_id,role" }));
  return { message: `${email} is now ${role}.`, entityId: userId, details: { role } };
});

export const revokeRole = adminAction({ audit: "user_role.revoked", revalidate: ["/admin/staff"] }, async (f, ctx) => {
  const userId = z.string().uuid().parse(str(f, "user_id"));
  const role = z.enum(["admin", "staff"]).parse(str(f, "role"));
  if (userId === ctx.userId && role === "admin") throw new HttpError(400, "You cannot remove your own admin access.");
  check(await createAdminClient().from("user_roles").delete().eq("user_id", userId).eq("role", role));
  return { message: "Access removed.", entityId: userId, details: { role } };
});

export const saveProvider = adminAction({ audit: "delivery_provider.saved", revalidate: ["/admin/delivery-providers"] }, async (f) => {
  const id = optStr(f, "id");
  const code = str(f, "code").toLowerCase();
  if (!/^[a-z0-9_]{2,40}$/.test(code)) throw new HttpError(400, "Code: 2–40 lowercase letters, numbers or _.");
  const envPrefix = optStr(f, "env_prefix")?.toUpperCase() ?? null;
  if (envPrefix && !/^[A-Z][A-Z0-9_]{1,40}$/.test(envPrefix)) throw new HttpError(400, "Env prefix: uppercase letters, numbers and _.");
  const base = optStr(f, "api_base_url");
  const tpl = optStr(f, "tracking_url_template");
  for (const u of [base, tpl]) if (u && !/^https:\/\//.test(u)) throw new HttpError(400, "URLs must start with https://");
  const row = {
    name: str(f, "name"),
    code,
    adapter: str(f, "adapter") === "http_generic" ? "http_generic" : "manual",
    env_prefix: envPrefix,
    api_base_url: base,
    tracking_url_template: tpl,
    contact_phone: optStr(f, "contact_phone"),
    notes: optStr(f, "notes"),
    is_active: bool(f, "is_active"),
  };
  if (!row.name) throw new HttpError(400, "Enter the partner name.");
  const supabase = await createClient();
  if (id) check(await supabase.from("delivery_providers").update(row).eq("id", id));
  else check(await supabase.from("delivery_providers").insert(row));
  return { message: "Delivery partner saved.", entityId: code };
});

export const moderateReview = adminAction({ roles: ["admin", "staff"], audit: "review.moderated", revalidate: ["/admin/reviews", "/"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const supabase = await createClient();
  if (str(f, "delete") === "1") {
    check(await supabase.from("reviews").delete().eq("id", id));
    return { message: "Review deleted.", entityId: id };
  }
  check(await supabase.from("reviews").update({ is_approved: bool(f, "is_approved"), is_featured: bool(f, "is_featured") }).eq("id", id));
  return { message: "Review updated.", entityId: id };
});

export const resolveMessage = adminAction({ roles: ["admin", "staff"], revalidate: ["/admin/messages"] }, async (f) => {
  const id = z.string().uuid().parse(str(f, "id"));
  const supabase = await createClient();
  check(await supabase.from("contact_messages").update({ is_resolved: str(f, "value") === "true" }).eq("id", id));
  return { message: "Updated." };
});
