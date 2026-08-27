import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";

// Reads the Host header, so it must be rendered per request rather than
// baked once — otherwise every domain advertises the first one's sitemap.
export const dynamic = "force-dynamic";

/**
 * Per-page noindex is handled in each template's metadata (the thin-page
 * rule); robots.txt points crawlers at the sitemap and keeps the API surface
 * and the account/panel pages out of the crawl entirely — they all carry
 * noindex meta, but crawling them at all is wasted budget (audit F24).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/agencia", "/publicar", "/login", "/registro"],
    },
    sitemap: `${await siteOrigin()}/sitemap.xml`,
  };
}
