import { siteOrigin, hostOwnsListingDetail } from "@/lib/origin";
import { currentVertical } from "@/lib/vertical-context";
import {
  CHUNK_SIZE,
  renderIndex,
  renderUrlset,
  sitemapEntries,
  xmlResponse,
} from "@/lib/sitemap-xml";

/**
 * The one sitemap address, the one `robots.txt` advertises. It renders a
 * `<urlset>` while the site fits in a single chunk and a `<sitemapindex>` once
 * it does not — see src/lib/sitemap-xml.ts for why the chunking is here rather
 * than in Next's `generateSitemaps()`.
 *
 * This replaced `app/sitemap.ts`: the Metadata convention can only emit a
 * `<urlset>`, so an index needs a route handler.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const [origin, ownsListingDetail, vertical] = await Promise.all([
    siteOrigin(),
    hostOwnsListingDetail(),
    currentVertical(),
  ]);
  const entries = await sitemapEntries(ownsListingDetail, vertical.key);

  return xmlResponse(
    entries.length <= CHUNK_SIZE
      ? renderUrlset(origin, entries)
      : renderIndex(origin, entries),
  );
}
