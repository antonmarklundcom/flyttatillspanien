import { siteOrigin, hostOwnsListingDetail } from "@/lib/origin";
import { currentVertical } from "@/lib/vertical-context";
import {
  chunkCount,
  chunkOf,
  renderUrlset,
  sitemapEntries,
  xmlResponse,
} from "@/lib/sitemap-xml";

/**
 * One chunk of the sitemap: `/sitemap/1.xml`, `/sitemap/2.xml`, … Only reached
 * from the index at `/sitemap.xml`, which is the only thing that knows how
 * many there are.
 *
 * Every chunk reads the same cached entry list as the index, so a crawler
 * pulling twelve chunks in parallel costs one query set, not twelve.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ chunk: string }> },
): Promise<Response> {
  const { chunk: raw } = await ctx.params;

  // `/sitemap/3.xml` → 3. Anything else is not a chunk address.
  const match = /^(\d+)\.xml$/.exec(raw);
  if (!match) return new Response("Not found", { status: 404 });
  const chunk = Number(match[1]);

  const [origin, ownsListingDetail, vertical] = await Promise.all([
    siteOrigin(),
    hostOwnsListingDetail(),
    currentVertical(),
  ]);
  const entries = await sitemapEntries(ownsListingDetail, vertical.key);

  /**
   * Out of range is a 404, not an empty sitemap. An empty `<urlset>` at
   * `/sitemap/99.xml` would be a valid document that tells Search Console the
   * site has no pages there, which is the wrong answer to "that chunk does not
   * exist".
   */
  if (chunk < 1 || chunk > chunkCount(entries.length)) {
    return new Response("Not found", { status: 404 });
  }

  return xmlResponse(renderUrlset(origin, chunkOf(entries, chunk)));
}
