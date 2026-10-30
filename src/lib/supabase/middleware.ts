import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";

const PROTECTED_PREFIXES = ["/account", "/checkout", "/admin", "/delivery", "/orders"];

/** Refreshes the auth session cookie and redirects anonymous users away from protected areas. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) {
    // Not connected yet: send login/admin/checkout traffic to the setup guide.
    const p = request.nextUrl.pathname;
    if (/^\/(auth|admin|account|checkout|delivery|orders)(\/|$)/.test(p)) {
      const url = request.nextUrl.clone();
      url.pathname = "/setup";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
