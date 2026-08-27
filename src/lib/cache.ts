import { revalidateTag } from "next/cache";

/**
 * Data-cache tags and TTLs for the public site.
 *
 * The public pages are all `force-dynamic` — they read the Host header for
 * the per-host brand and canonical, so no route can hold a full route cache
 * (PLAN.md F17). That makes the *data* cache the only cache the portal has:
 * a page still renders per request, but a cached payload means it renders
 * without touching MySQL. Under a crawl burst or a share spike that is the
 * difference between a template render and N queries per visitor, which is
 * the shape the 503s took.
 *
 * Two rules keep this honest:
 *
 * 1. **Every tag has a writer.** A TTL alone means an operator saves a change
 *    and the public page keeps showing the old one until the timer expires —
 *    which reads as "the save didn't work". Each tag below names the actions
 *    that must call its `revalidate*()` helper. `revalidatePath()` does NOT
 *    clear `unstable_cache` entries; the two caches are separate.
 * 2. **Dates do not survive the cache.** Entries are serialized, so a `Date`
 *    comes back as an ISO string and `string > Date` is silently false (see
 *    ListingCard's featuredUntil re-wrap). A cached query that returns Dates
 *    re-wraps them on the way out, at the call site of the cached function.
 */
export const CACHE_TAGS = {
  /** Published listing rows: home rail, sitemap, cards. */
  listings: "listings",
  /** Agency / agent / developer / project directories and portal counts. */
  directory: "directory",
  /** /guias index and post detail. */
  guides: "guides",
  /** The `locations` table — seed data, effectively immutable. */
  locations: "locations",
  /** Computed price medians (precios-queries, valuation). */
  marketMedians: "market-medians",
};

/** Seconds. Short enough that a missed writer is a blip, not a bug report. */
export const CACHE_TTL = {
  listings: 600,
  directory: 300,
  guides: 300,
  /** Cities change when someone seeds them, i.e. never in normal operation. */
  locations: 3600,
  marketMedians: 21_600,
} as const;

/**
 * Call after any write that changes which listings are published, or what a
 * published listing says: approve/reject, panel status changes, listing edits,
 * publish-wizard submits, photo changes, import commit and import rollback.
 */
export function revalidateListings(): void {
  revalidateTag(CACHE_TAGS.listings);
  // The directories are derived from published listings — an agency's card
  // shows its listing count and its top three cities — so a listing write
  // moves them too. One extra tag drop beats a second call every writer has
  // to remember.
  revalidateTag(CACHE_TAGS.directory);
}

/** Call after agency / agent / developer / project profile writes. */
export function revalidateDirectory(): void {
  revalidateTag(CACHE_TAGS.directory);
}

/** Call after any post create / update / publish / delete. */
export function revalidateGuides(): void {
  revalidateTag(CACHE_TAGS.guides);
}
