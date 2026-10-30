import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { runMaintenance } from "@/lib/maintenance";
import { integrationStatus } from "@/lib/env";

/**
 * Scheduled upkeep (vercel.json). If CRON_SECRET is set, Vercel sends it and
 * it is required. Without it the endpoint still works but is throttled to
 * once a minute — the job is idempotent and only reconciles/expires orders.
 */
export async function GET(req: NextRequest) {
  if (!integrationStatus().supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const secret = process.env.CRON_SECRET;
  let authorised = false;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret}`;
    authorised = auth.length === expected.length && crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
    if (!authorised) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runMaintenance({ force: authorised }));
  } catch (e) {
    console.error("[cron]", e);
    return NextResponse.json({ error: "maintenance failed" }, { status: 500 });
  }
}
