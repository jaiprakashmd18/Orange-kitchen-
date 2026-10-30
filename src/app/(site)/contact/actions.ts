"use server";

import { headers } from "next/headers";
import { contactSchema, firstError } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { HttpError } from "@/lib/auth";

export interface ContactState {
  ok: boolean;
  error: string | null;
}

export async function submitContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (parsed.data.website) return { ok: true, error: null }; // honeypot: silently drop bots
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await rateLimit(`contact:${ip}`, 5, 3600);
    const { error } = await createAdminClient()
      .from("contact_messages")
      .insert({ name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null, message: parsed.data.message });
    if (error) throw error;
    return { ok: true, error: null };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    console.error("[contact]", e);
    return { ok: false, error: "We couldn't send your message. Please call us instead." };
  }
}
