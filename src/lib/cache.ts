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
 *
 *    **One honest exception, for cron-written reference tables** (`fx_rates`,
 *    `acquisition_costs`, `market_medians`): rule 1 assumes an in-process
 *    writer, and these have none. `npm run cron:fx` runs as a separate `tsx`
 *    process, and a `revalidateTag()` there cannot reach the running Next
 *    server's data cache. So for those tags **the TTL is the invalidation
 *    mechanism, not a backstop** — pick it to match the publication cadence of
 *    the upstream data, not how fast an operator expects a save to appear. The
 *    `revalidate*()` helpers still exist and are still called, from the
 *    `/admin` manual-override actions, which genuinely are in-process.
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
  /** The EUR/SEK reference rate. Cron-written — see the TTL note above. */
  fx: "fx",
  /** Per-comunidad purchase taxes and fees. Cron/operator-written. */
  acquisitionCosts: "acquisition-costs",
};

/** Seconds. Short enough that a missed writer is a blip, not a bug report. */
export const CACHE_TTL = {
  listings: 600,
  directory: 300,
  guides: 300,
  /** Cities change when someone seeds them, i.e. never in normal operation. */
  locations: 3600,
  marketMedians: 21_600,
  /** ECB publishes once per business day; an hour of lag is invisible. */
  fx: 3600,
  /** Regional tax scales move with an annual budget, not with a deploy. */
  acquisitionCosts: 86_400,
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

/**
 * Call from the `/admin` FX manual-override action — the one in-process writer
 * of `fx_rates`. `npm run cron:fx` cannot call this (different process); its
 * freshness comes from `CACHE_TTL.fx`.
 */
export function revalidateFx(): void {
  revalidateTag(CACHE_TAGS.fx);
}

/** Call from the `/admin` acquisition-cost override action. Same story. */
export function revalidateAcquisitionCosts(): void {
  revalidateTag(CACHE_TAGS.acquisitionCosts);
}
