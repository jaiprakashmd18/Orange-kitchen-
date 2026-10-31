import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { integrationStatus } from "@/lib/env";
import { schemaStatus } from "@/lib/setup-status";
import { ensureEnvAdmin, matchesAdminEnv } from "@/lib/admin-bootstrap";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, handleRouteError } from "@/lib/http";
import { audit } from "@/lib/audit";

/**
 * Called by the login form when a sign-in fails. If the credentials equal
 * ADMIN_EMAIL / ADMIN_PASSWORD from the server environment, the admin
 * account is created or repaired so the owner can always get in.
 */
export async function POST(req: NextRequest) {
  try {
    if (!integrationStatus().supabase) {
      return NextResponse.json({ ok: false, code: "NO_KEYS", error: "Supabase keys are not set in Vercel yet. Open /setup." }, { status: 503 });
    }
    const schema = await schemaStatus();
    if (!schema.ready) {
      return NextResponse.json({ ok: false, code: "NO_SCHEMA", error: "The database is not set up yet. Open /setup to see what's missing." }, { status: 503 });
    }
    await rateLimit(`admin-bootstrap:${clientIp(req)}`, 10, 600);
    const { email, password } = z.object({ email: z.string().max(200), password: z.string().max(200) }).parse(await req.json());
    if (!matchesAdminEnv(email, password)) return NextResponse.json({ ok: false, code: "NOT_ADMIN" }, { status: 401 });
    const userId = await ensureEnvAdmin();
    await audit({ actorId: userId, action: "admin.bootstrapped", entity: "user", entityId: userId, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "admin-bootstrap");
  }
}
