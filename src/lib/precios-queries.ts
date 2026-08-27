/**
 * Price pages (`/precios/{ciudad}`) — ARCHITECTURE.md §4.4.
 *
 * Reads `market_medians`, which the nightly `cron:medians` job fills from
 * published listings. Nothing here computes a median at request time: a page
 * that recalculated the market on every visit would be both slow and
 * inconsistent between the table and the copy above it.
 *
 * The honesty rule is the important one. A median over three listings is not a
 * market price, so a group below MIN_RELIABLE_SAMPLE renders **with a caveat**
 * and the page as a whole only becomes indexable once it has a group we would
 * defend — otherwise this is exactly the thin programmatic page the
 * indexability rule exists to prevent.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { locations, marketMedians } from "@/db/schema";
import { citySubtreeIds, resolveCity, type LocationRow } from "@/lib/queries";
import type { Operation, PropertyType } from "@/lib/import/types";

/**
 * Below this, a median is an anecdote. The same threshold the context module
 * uses (schema.ts: "context module renders only when >= 8").
 */
export const MIN_RELIABLE_SAMPLE = 8;

export interface MedianCell {
  propertyType: PropertyType;
  operation: Operation;
  medianPriceUsd: number | null;
  medianPriceM2Usd: number | null;
  sampleSize: number;
  /** False when the sample is too small to present without a caveat. */
  reliable: boolean;
}

export interface CityPrices {
  city: LocationRow;
  period: string;
  cells: MedianCell[];
  /** Sum of the samples behind the reliable cells — the page's own weight. */
  reliableSample: number;
}

/**
 * The median that describes one exact (operation, type) pair — the number a
 * category or listing page can state as market context (audit I8).
 *
 * Only `reliable` cells come back. Below MIN_RELIABLE_SAMPLE a median is an
 * anecdote, and a page that prints an anecdote as "the market" is worse than a
 * page that prints nothing: /precios exists precisely because we refuse to do
 * that, and these surfaces must not undercut it.
 */
export function medianFor(
  prices: CityPrices | null,
  operation: Operation,
  propertyType: PropertyType,
): MedianCell | null {
  if (!prices) return null;
  const cell = prices.cells.find(
    (c) => c.operation === operation && c.propertyType === propertyType,
  );
  return cell?.reliable ? cell : null;
}

/**
 * The best-evidenced median for an operation, whatever the property type —
 * for a city page that has no type in its path. Returns the type alongside so
 * the copy can name what it is describing rather than implying it covers
 * everything.
 */
export function bestMedianFor(
  prices: CityPrices | null,
  operation: Operation,
): MedianCell | null {
  if (!prices) return null;
  return (
    prices.cells
      .filter((c) => c.reliable && c.operation === operation)
      .sort((a, b) => b.sampleSize - a.sampleSize)[0] ?? null
  );
}

/** The newest period we actually have rows for; null when the job never ran. */
export async function latestPeriod(): Promise<string | null> {
  const [row] = await db
    .select({ period: marketMedians.period })
    .from(marketMedians)
    .orderBy(desc(marketMedians.period))
    .limit(1);
  return row?.period ?? null;
}

/**
 * Medians for a city, aggregated over the city and its barrios.
 *
 * Aggregation is a sample-weighted mean of the barrio medians — not a median of
 * medians, which would throw away the fact that one barrio has 40 listings and
 * another has two. It is an approximation of the true city median, and it is
 * labelled as an estimate in the copy rather than dressed up as exact.
 */
async function getCityPricesUncached(
  citySlug: string,
): Promise<CityPrices | null> {
  const city = await resolveCity(citySlug);
  if (!city) return null;

  const period = await latestPeriod();
  if (!period) {
    return { city, period: "", cells: [], reliableSample: 0 };
  }

  const ids = await citySubtreeIds(city.id);
  const rows = await db
    .select({
      propertyType: marketMedians.propertyType,
      operation: marketMedians.operation,
      medianPriceUsd: marketMedians.medianPriceUsd,
      medianPriceM2Usd: marketMedians.medianPriceM2Usd,
      sampleSize: marketMedians.sampleSize,
      sampleSizeM2: marketMedians.sampleSizeM2,
    })
    .from(marketMedians)
    .where(
      and(
        eq(marketMedians.period, period),
        inArray(marketMedians.locationId, ids),
      ),
    );

  interface Acc {
    priceWeighted: number;
    priceWeight: number;
    m2Weighted: number;
    m2Weight: number;
    sample: number;
  }
  const acc = new Map<string, Acc>();

  for (const r of rows) {
    const key = `${r.propertyType}|${r.operation}`;
    const a =
      acc.get(key) ??
      { priceWeighted: 0, priceWeight: 0, m2Weighted: 0, m2Weight: 0, sample: 0 };
    const n = r.sampleSize;
    if (r.medianPriceUsd != null) {
      a.priceWeighted += Number(r.medianPriceUsd) * n;
      a.priceWeight += n;
    }
    if (r.medianPriceM2Usd != null) {
      // Weight the m² median by its own sample (listings that had an area),
      // not the full bucket (F16). Pre-migration rows carry 0 → old weight.
      const m2n = r.sampleSizeM2 > 0 ? r.sampleSizeM2 : n;
      a.m2Weighted += Number(r.medianPriceM2Usd) * m2n;
      a.m2Weight += m2n;
    }
    a.sample += n;
    acc.set(key, a);
  }

  const cells: MedianCell[] = [];
  for (const [key, a] of acc) {
    const [propertyType, operation] = key.split("|") as [PropertyType, Operation];
    cells.push({
      propertyType,
      operation,
      medianPriceUsd: a.priceWeight > 0 ? a.priceWeighted / a.priceWeight : null,
      medianPriceM2Usd: a.m2Weight > 0 ? a.m2Weighted / a.m2Weight : null,
      sampleSize: a.sample,
      reliable: a.sample >= MIN_RELIABLE_SAMPLE,
    });
  }

  // Biggest samples first: the rows a visitor should trust lead the table.
  cells.sort((x, y) => y.sampleSize - x.sampleSize);

  return {
    city,
    period,
    cells,
    reliableSample: cells
      .filter((c) => c.reliable)
      .reduce((sum, c) => sum + c.sampleSize, 0),
  };
}

/**
 * Cities with at least one defensible group — the indexable price pages, for
 * the sitemap and the index page.
 *
 * One pass over the period's medians, attributing each row to its city (a row
 * sits on either a ciudad or one of its barrios). The obvious shape — loop the
 * cities and call getCityPrices() per city — was 45 round-trips for a list.
 */
async function citiesWithPricesUncached(): Promise<
  { slug: string; name: string; reliableSample: number }[]
> {
  const period = await latestPeriod();
  if (!period) return [];

  const [locs, rows] = await Promise.all([
    db
      .select({
        id: locations.id,
        slug: locations.slug,
        name: locations.name,
        level: locations.level,
        parentId: locations.parentId,
      })
      .from(locations),
    db
      .select({
        locationId: marketMedians.locationId,
        propertyType: marketMedians.propertyType,
        operation: marketMedians.operation,
        sampleSize: marketMedians.sampleSize,
      })
      .from(marketMedians)
      .where(eq(marketMedians.period, period)),
  ]);

  const byId = new Map(locs.map((l) => [l.id, l]));
  /** The ciudad a medians row belongs to, or null if it hangs off neither. */
  const cityOf = (locationId: number) => {
    const loc = byId.get(locationId);
    if (!loc) return null;
    if (loc.level === "ciudad") return loc;
    const parent = loc.parentId != null ? byId.get(loc.parentId) : undefined;
    return parent?.level === "ciudad" ? parent : null;
  };

  // Samples per (city × type × operation), so reliability is judged on the same
  // groups the page itself shows rather than on a city-wide total.
  const groups = new Map<string, number>();
  for (const r of rows) {
    const city = cityOf(r.locationId);
    if (!city) continue;
    const key = `${city.id}|${r.propertyType}|${r.operation}`;
    groups.set(key, (groups.get(key) ?? 0) + r.sampleSize);
  }

  const perCity = new Map<number, number>();
  for (const [key, sample] of groups) {
    if (sample < MIN_RELIABLE_SAMPLE) continue;
    const cityId = Number(key.split("|")[0]);
    perCity.set(cityId, (perCity.get(cityId) ?? 0) + sample);
  }

  return [...perCity.entries()]
    .map(([cityId, reliableSample]) => {
      const city = byId.get(cityId)!;
      return { slug: city.slug, name: city.name, reliableSample };
    })
    .sort((a, b) => b.reliableSample - a.reliableSample);
}

/* ------------------------------------------------------------------ */
/* Caching                                                             */
/* ------------------------------------------------------------------ */

/**
 * Medians change once a night (`cron:medians`), but these reads sit on the
 * *hottest* paths in the app: the category page and the listing detail page both
 * link to a city's prices, and both are rendered per request. Uncached, that
 * added several queries to every page view — which is what turned a host
 * already at its process cap into a 503 spiral.
 *
 * So the results are cached across requests for an hour. React's `cache()`
 * would only dedupe within one render, which is not the problem here.
 */
const PRICES_TTL_SECONDS = 3600;

export const getCityPrices = unstable_cache(
  getCityPricesUncached,
  ["city-prices"],
  { revalidate: PRICES_TTL_SECONDS, tags: [CACHE_TAGS.marketMedians] },
);

export const citiesWithPrices = unstable_cache(
  citiesWithPricesUncached,
  ["cities-with-prices"],
  { revalidate: PRICES_TTL_SECONDS, tags: [CACHE_TAGS.marketMedians] },
);
