import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

// Staff areas are intentionally not listed here (that would advertise their
// paths). They require login and send noindex headers instead.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/account", "/checkout", "/cart", "/orders", "/auth", "/api"] }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
    host: publicEnv.siteUrl,
  };
}
