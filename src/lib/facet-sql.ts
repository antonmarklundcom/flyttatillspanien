/**
 * Facets → SQL. The only place a listing filter becomes a WHERE clause.
 *
 * Pairs with `facets.ts` (the pure vocabulary) the way `brand-server.ts` pairs
 * with `brand.ts`: this half imports drizzle and is `server-only`, so the
 * client components that build the same query strings never pull the ORM into
 * the browser bundle.
 *
 * Two rules encoded here rather than at each call site:
 *
 * - **Price filters run on `price_usd`.** It is the one normalized, indexed
 *   price column (schema §2.1); filtering on `price_amount` would compare
 *   guaraníes to dollars and silently return nonsense for half the inventory.
 * - **The vertical's hard filters are ANDed in, not merged.** A door that
 *   declares `filters: { operation: ["alquiler"] }` may only ever *narrow*
 *   what a visitor asked for, never widen it — otherwise alquiler.com.py could
 *   be talked into serving ventas with a query string.
 */
import "server-only";
import { and, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { listings } from "@/db/schema";
import type { ListingFacets } from "./facets";
import type { VerticalConfig } from "@/config/verticals";
import { OPERATIONS, PROPERTY_TYPES } from "./import/types";
import type { Operation, PropertyType } from "./import/types";

/** Conditions for the visitor-chosen facets. Undefined fields add nothing. */
export function facetConds(f: ListingFacets): SQL[] {
  const conds: SQL[] = [];
  if (f.operation) conds.push(eq(listings.operation, f.operation));
  if (f.propertyType) conds.push(eq(listings.propertyType, f.propertyType));
  if (f.locationIds) conds.push(inArray(listings.locationId, f.locationIds));
  if (f.priceMin != null) conds.push(gte(listings.priceUsd, String(f.priceMin)));
  if (f.priceMax != null) conds.push(lte(listings.priceUsd, String(f.priceMax)));
  if (f.minBedrooms != null) conds.push(gte(listings.bedrooms, f.minBedrooms));
  return conds;
}

/**
 * The hard filters a domain applies to every listing query it serves
 * (`VerticalConfig.filters` — declared since the routing layer landed and,
 * until now, read by nothing).
 *
 * Unknown enum values in the config are dropped rather than passed to the
 * database: the config is hand-written TypeScript with `string[]` fields, and
 * a typo there should narrow nothing rather than produce a query that matches
 * nothing and reads as "the site is empty".
 */
export function verticalConds(vertical: VerticalConfig): SQL[] {
  const conds: SQL[] = [];
  const f = vertical.filters;
  if (!f) return conds;

  const ops = (f.operation ?? []).filter((o): o is Operation =>
    (OPERATIONS as readonly string[]).includes(o),
  );
  if (ops.length === 1) conds.push(eq(listings.operation, ops[0]));
  else if (ops.length > 1) conds.push(inArray(listings.operation, ops));

  const types = (f.property_type ?? []).filter((t): t is PropertyType =>
    (PROPERTY_TYPES as readonly string[]).includes(t),
  );
  if (types.length === 1) conds.push(eq(listings.propertyType, types[0]));
  else if (types.length > 1) conds.push(inArray(listings.propertyType, types));

  // Only `true` is a filter. `foreign_exposure: false` would mean "show the
  // ones nobody opted in for", which no door wants — the column is an opt-in
  // (default true), so its absence is the neutral state.
  if (f.foreign_exposure === true) {
    conds.push(eq(listings.foreignExposure, true));
  }
  return conds;
}

/**
 * The complete WHERE for a public listing query: published, narrowed by the
 * visitor's facets, narrowed again by the door they arrived through.
 *
 * `status = 'published'` is included here rather than left to callers because
 * every public surface needs it and forgetting it leaks drafts and rejected
 * listings — the one mistake in this file that would be a real incident.
 */
export function publishedFacetWhere(
  f: ListingFacets = {},
  vertical?: VerticalConfig | null,
): SQL | undefined {
  return and(
    eq(listings.status, "published"),
    ...facetConds(f),
    ...(vertical ? verticalConds(vertical) : []),
  );
}
