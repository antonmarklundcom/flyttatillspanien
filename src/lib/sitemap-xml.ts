/**
 * Serving the sitemap: caching, chunking, and the XML itself (audit F43).
 *
 * `buildSitemapEntries()` next door decides *what* is in the sitemap — that is
 * the part that must agree with `getIndexability()` and with
 * `hostOwnsListingDetail()`. This file decides how it reaches a crawler.
 *
 * **Why this is route handlers and not Next's `generateSitemaps()`.** The
 * built-in chunking enumerates its ids at build time, and the entry list comes
 * from the database — which on Hostinger is not reachable when the build runs
 * (the same reason `app/sitemap.ts` carried `force-dynamic`). A build-time
 * count would either crash the build or bake in yesterday's number. So the
 * index is rendered per request, from the same cached entry list the chunks
 * read, and the chunk count is always the true one.
 *
 * **The shape adapts.** Under `CHUNK_SIZE` URLs, `/sitemap.xml` is a plain
 * `<urlset>` — byte-for-byte the sitemap this site serves today, one fetch,
 * nothing to explain in Search Console. Past it, the same URL becomes a
 * `<sitemapindex>` pointing at `/sitemap/1.xml …`, which is a transition both
 * Google and Bing handle at a URL they have already crawled. Nothing has to be
 * resubmitted, and `robots.txt` keeps pointing at the one address.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache";
import { buildSitemapEntries, type SitemapEntry } from "@/lib/sitemap";
import { VERTICALS, type VerticalKey } from "@/config/verticals";

/**
 * URLs per chunk. The protocol's ceiling is 50 000 URLs / 50 MB uncompressed;
 * this sits far enough below it that a chunk stays a small, fast response and
 * a re-crawl of one chunk is cheap. Raising it saves requests and costs
 * granularity — there is no reason to go near the limit.
 */
export const CHUNK_SIZE = 10_000;

/**
 * The entry list loads every published row, so concurrent Googlebot fetches
 * used to each pay the full scan (audit F43, the half that was already fixed).
 * One cache entry per (owns-listing-detail, vertical) pair; the origin prefix
 * stays per-request. `lastmod` survives the JSON round trip as an ISO string,
 * which the XML wants anyway — hence `Date | string` on the entry below.
 *
 * Chunks share this entry rather than each rebuilding: a 25-URL sitemap and a
 * 25 000-URL one both cost one query set per hour per door.
 */
const cachedEntries = unstable_cache(
  async (includeListingDetail: boolean, verticalKey: VerticalKey) =>
    buildSitemapEntries({
      includeListingDetail,
      vertical: Object.values(VERTICALS).find((v) => v.key === verticalKey),
    }),
  ["sitemap-entries"],
  { revalidate: 3600, tags: [CACHE_TAGS.listings] },
);

/**
 * Sorted, because the chunk a URL lands in must not depend on the order MySQL
 * happened to return rows in. Without this, two requests an hour apart could
 * put `/propiedad/casa-x` in chunk 2 and then chunk 3, and a crawler would
 * re-read every chunk to discover nothing changed. Sorting by path also groups
 * the listing URLs — the ones that actually churn — into their own chunks.
 */
export async function sitemapEntries(
  includeListingDetail: boolean,
  verticalKey: VerticalKey,
): Promise<SitemapEntry[]> {
  const entries = await cachedEntries(includeListingDetail, verticalKey);
  return [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 1-based, matching the `/sitemap/1.xml` in the index. */
export function chunkCount(total: number): number {
  return Math.max(1, Math.ceil(total / CHUNK_SIZE));
}

export function chunkOf(entries: SitemapEntry[], chunk: number): SitemapEntry[] {
  return entries.slice((chunk - 1) * CHUNK_SIZE, chunk * CHUNK_SIZE);
}

/**
 * XML text escaping. Today's paths are slugs and ASCII, so this escapes
 * nothing in practice — which is exactly when an unescaped `&` slips in and
 * makes the whole document unparseable for every crawler at once.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** W3C datetime, which is what `<lastmod>` takes. */
function lastmod(value: Date | string | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function renderUrlset(origin: string, entries: SitemapEntry[]): string {
  const urls = entries.map((e) => {
    const mod = lastmod(e.lastmod);
    return (
      `  <url>\n    <loc>${xml(origin + e.path)}</loc>\n` +
      (mod ? `    <lastmod>${mod}</lastmod>\n` : "") +
      "  </url>"
    );
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n"
  );
}

export function renderIndex(origin: string, entries: SitemapEntry[]): string {
  const count = chunkCount(entries.length);
  const children: string[] = [];
  for (let i = 1; i <= count; i++) {
    // The freshest thing in the chunk: a crawler that has seen this index
    // before can skip a chunk whose newest listing predates its last visit.
    const newest = chunkOf(entries, i)
      .map((e) => lastmod(e.lastmod))
      .filter((v): v is string => v !== null)
      .sort()
      .pop();
    children.push(
      `  <sitemap>\n    <loc>${xml(`${origin}/sitemap/${i}.xml`)}</loc>\n` +
        (newest ? `    <lastmod>${newest}</lastmod>\n` : "") +
        "  </sitemap>",
    );
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    children.join("\n") +
    "\n</sitemapindex>\n"
  );
}

/** One place decides the content type and the caching headers for both routes. */
export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // The entry list is cached for an hour behind this; saying so lets a CDN
      // or the crawler itself skip the render too.
      "cache-control": "public, max-age=3600",
    },
  });
}
