import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${publicEnv.siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${publicEnv.siteUrl}/menu`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${publicEnv.siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${publicEnv.siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${publicEnv.siteUrl}/policies`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
