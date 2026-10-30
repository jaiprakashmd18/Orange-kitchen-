import "server-only";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { assertRole, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { firstError } from "@/lib/validation";
import type { AppRole } from "@/lib/types";
import type { ActionResult } from "@/components/admin/ActionForm";

type Ctx = { userId: string; roles: AppRole[] };

/**
 * Wraps an admin server action: verifies role server-side, converts errors to
 * a safe result, writes an audit log entry and revalidates paths.
 */
export function adminAction(
  opts: { roles?: AppRole[]; audit?: string; revalidate?: string[] },
  fn: (form: FormData, ctx: Ctx) => Promise<{ message?: string; entityId?: string; details?: Record<string, unknown> } | void>,
) {
  return async (_prev: ActionResult, form: FormData): Promise<ActionResult> => {
    try {
      const { user, roles } = await assertRole(opts.roles ?? ["admin"]);
      let res: { message?: string; entityId?: string; details?: Record<string, unknown> } = {};
      let redirectErr: unknown = null;
      try {
        res = (await fn(form, { userId: user.id, roles })) || {};
      } catch (e) {
        if (isRedirectError(e)) redirectErr = e; // success path that navigates
        else throw e;
      }
      if (opts.audit) {
        const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        await audit({ actorId: user.id, action: opts.audit, entity: opts.audit.split(".")[0], entityId: res.entityId ?? null, details: res.details, ip });
      }
      for (const p of opts.revalidate ?? []) revalidatePath(p, "layout");
      if (redirectErr) throw redirectErr;
      return { ok: true, error: null, message: res.message ?? "Saved." };
    } catch (e) {
      if (isRedirectError(e)) throw e;
      if (e instanceof HttpError) return { ok: false, error: e.message };
      if (e instanceof ZodError) return { ok: false, error: firstError(e) };
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") return { ok: false, error: "That value already exists." };
      if (e && typeof e === "object" && "message" in e && String((e as { message: string }).message).includes("violates check")) {
        return { ok: false, error: "Some values are invalid. Please check the form." };
      }
      console.error("[admin action]", e);
      return { ok: false, error: e instanceof Error && e.message.length < 200 ? e.message : "Something went wrong." };
    }
  };
}

/** Throw a PostgREST error so the wrapper can map it. */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }) {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data;
}

export const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (f: FormData, k: string) => str(f, k) || null;
export const num = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `Invalid number for ${k.replace(/_/g, " ")}`);
  return n;
};
export const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";
