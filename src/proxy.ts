import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 "proxy" (formerly middleware): refreshes the Supabase session
// and redirects anonymous users away from protected areas.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, images, webhooks (signature-verified) and PWA files.
    "/((?!_next/static|_next/image|favicon.ico|icons/|brand/|sw.js|manifest.webmanifest|api/webhooks|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
