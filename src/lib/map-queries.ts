/**
 * Map queries (ARCHITECTURE.md §1: "plain lat/lng bounding boxes (idx_geo), no
 * spatial extensions" — the Postgres escape hatch stays open).
 *
 * **Coordinate privacy is the load-bearing rule here.** `addressText` and the
 * listing's own lat/lng are "never shown publicly at full precision"
 * (schema.ts §2.1): a pin on the exact building tells a stranger which house is
 * empty and for sale. So every coordinate that leaves this module is rounded to
 * COORD_DECIMALS, and a listing with no coordinates of its own borrows its
 * barrio/city centroid rather than being invented into a position or dropped.
 *
 * Rounding happens here, in the query layer, not in the route handler — a
 * future caller cannot forget it.
 */
import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { facetConds, verticalConds } from "@/lib/facet-sql";
import { servedTitle } from "@/lib/listing-copy";
import type { ListingFacets } from "@/lib/facets";
import type { VerticalConfig } from "@/config/verticals";

/**
 * 3 decimals ≈ 110 m at this latitude. Enough for "this block", not enough to
 * pick a house out of it. Bump with care: every extra decimal is ~10x more
 * precise about someone's home.
 */
const COORD_DECIMALS = 3;

/** Pins per response. A denser view is what clustering is for. */
const MAX_PINS = 400;

/** Refuse absurd boxes — a whole-planet bbox is a scrape, not a map pan. */
const MAX_SPAN_DEG = 12;

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * The map narrows by exactly the same vocabulary as the grid — it *is*
 * `ListingFacets` (src/lib/facets.ts), not a parallel type. That is the whole
 * point of the shared layer: a facet the grid understands and the map does not
 * is how the two start showing different sets of the same city.
 *
 * `sort` is the one field the map ignores: pins have no order a visitor sees,
 * and the response is capped by price for determinism (below).
 */
export type MapFilters = Omit<ListingFacets, "sort">;

export interface MapPin {
  publicId: string;
  slug: string;
  title: string;
  /** Rounded — see COORD_DECIMALS. Never the stored value. */
  lat: number;
  lng: number;
  priceEur: number;
  bedrooms: number | null;
  builtM2: number | null;
  /** True when the position is the barrio/city centroid, not the listing's own. */
  approximate: boolean;
}

export function boundsAreSane(b: MapBounds): boolean {
  const finite = [b.minLat, b.maxLat, b.minLng, b.maxLng].every(Number.isFinite);
  if (!finite) return false;
  if (b.minLat > b.maxLat || b.minLng > b.maxLng) return false;
  if (Math.abs(b.maxLat - b.minLat) > MAX_SPAN_DEG) return false;
  if (Math.abs(b.maxLng - b.minLng) > MAX_SPAN_DEG) return false;
  return true;
}

function round(value: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(value * f) / f;
}

/**
 * Published listings whose position falls inside the box.
 *
 * The box is tested against `display_lat`/`display_lng` — the materialised
 * "listing's own coordinate, else its location's centroid" (src/lib/geo.ts).
 * That is the position we actually plot, and testing the private coordinate
 * while displaying a different one would put pins outside the box the client
 * asked for.
 *
 * It used to be `coalesce(listings.lat, locations.lat)` over a join, computed
 * per query. Correct, and unindexable: `idx_geo` could not be used and every
 * pan scanned the published set (audit F38). Materialising it turns the whole
 * thing into one indexed range scan on one table, so the join is gone too —
 * `approximate` now reads the listing's own lat, which we already had.
 */
export async function listingsInBounds(
  bounds: MapBounds,
  filters: MapFilters = {},
  vertical?: VerticalConfig | null,
): Promise<MapPin[]> {
  if (!boundsAreSane(bounds)) return [];

  const rows = await db
    .select({
      publicId: listings.publicId,
      slug: listings.slug,
      title: listings.title,
      titleSv: listings.titleSv,
      sourceLang: listings.sourceLang,
      lat: listings.displayLat,
      lng: listings.displayLng,
      ownLat: listings.lat,
      priceEur: listings.priceEur,
      bedrooms: listings.bedrooms,
      builtM2: listings.builtM2,
    })
    .from(listings)
    .where(
      and(
        eq(listings.status, "published"),
        // No IS NOT NULL here, and that is deliberate: a NULL fails the
        // BETWEEN anyway, and the redundant predicate is what stops MariaDB
        // choosing a range seek — measured on 3 000 rows, it fell back to
        // `ref` on status alone (734 index entries scanned) instead of
        // `range` on (status, display_lat, display_lng) (130). A listing with
        // no position at all is still excluded; `npm run cron:geo` names them.
        gte(listings.displayLat, String(bounds.minLat)),
        lte(listings.displayLat, String(bounds.maxLat)),
        gte(listings.displayLng, String(bounds.minLng)),
        lte(listings.displayLng, String(bounds.maxLng)),
        ...facetConds(filters),
        ...(vertical ? verticalConds(vertical) : []),
      ),
    )
    // Cheapest first is arbitrary but stable, so a capped response is at least
    // deterministic rather than whatever order the storage engine returns.
    .orderBy(listings.priceEur)
    .limit(MAX_PINS);

  return rows.map((r) => ({
    publicId: r.publicId,
    slug: r.slug,
    // The pin's label is what a visitor reads, so it follows the same
    // `title_sv ?? title` rule as every other surface (listing-copy.ts).
    title: servedTitle(r),
    lat: round(Number(r.lat)),
    lng: round(Number(r.lng)),
    priceEur: Number(r.priceEur),
    bedrooms: r.bedrooms,
    builtM2: r.builtM2 != null ? Number(r.builtM2) : null,
    approximate: r.ownLat == null,
  }));
}

export const MAP_LIMITS = { MAX_PINS, MAX_SPAN_DEG, COORD_DECIMALS };
