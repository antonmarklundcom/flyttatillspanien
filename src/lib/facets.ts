/**
 * The listing facet vocabulary — one definition of "what a visitor can narrow
 * a listing set by", shared by every surface that narrows one.
 *
 * Why this file exists (PLAN.md M4, the last open item): the same four
 * facets were being spelled out three times — once in the category page's
 * `parseFilters`, once in `/api/mapa`'s zod schema, and once again in the
 * `mapQuery` object the page hands the map. Three copies of one vocabulary is
 * how a grid and its map start disagreeing about what the visitor asked for,
 * and it is how a future saved-search engine would disagree with both. The
 * query-string names, the parsing rules and the types all live here now, and
 * `facet-sql.ts` turns them into the one WHERE clause every query uses.
 *
 * **Pure on purpose** — no `next/*`, no drizzle, no `server-only`. The filter
 * bar is a client component and builds the same query strings; it must be able
 * to import this. The SQL half lives in `facet-sql.ts` for exactly the reason
 * `brand.ts` / `brand-server.ts` are split.
 */
import type { Operation, PropertyType } from "./import/types";
import { parseOperation, parseTypePlural } from "./urls";

export type SortOption = "senaste" | "pris_upp" | "pris_ner";

/**
 * Everything a listing query can be narrowed by.
 *
 * `locationIds` is the resolved city/barrio subtree rather than a slug: the
 * hierarchy walk belongs to the query layer's cached `citySubtreeIds()`, and
 * every caller already holds the result by the time it builds facets.
 */
export interface ListingFacets {
  operation?: Operation;
  propertyType?: PropertyType;
  locationIds?: number[];
  /** EUR. Converted from a visitor's SEK bounds by the caller, never in SQL. */
  priceMin?: number;
  priceMax?: number;
  minBedrooms?: number;
  sort?: SortOption;
}

/**
 * The query-string names. Swedish, because they are part of the public URL
 * surface the visitor reads — the same seam as `urls.ts`, where the DB's
 * Spanish enums meet the site's Swedish vocabulary.
 *
 * `pris_min` / `pris_max` are bounds **in EUR**, the stored and indexed
 * currency. A visitor filtering in kronor has their bounds converted SEK→EUR
 * once, in the caller, before `facetConds()` ever sees them: `price_eur *
 * :rate` in a WHERE is an expression over a column, so it cannot use the
 * index, and every filtered search would scan the published set (the F38
 * mistake in a different costume).
 */
export const FACET_PARAM = {
  operation: "affar",
  propertyType: "typ",
  city: "ort",
  barrio: "omrade",
  priceMin: "pris_min",
  priceMax: "pris_max",
  minBedrooms: "sovrum",
  sort: "sortering",
} as const;

/** The narrowing params a visitor toggles, as opposed to the ones the path fixes. */
export const USER_FACET_PARAMS: readonly string[] = [
  FACET_PARAM.priceMin,
  FACET_PARAM.priceMax,
  FACET_PARAM.minBedrooms,
  FACET_PARAM.sort,
];

type ParamBag = Record<string, string | string[] | undefined>;

function one(sp: ParamBag, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v !== "" ? v : undefined;
}

/**
 * Positive finite number, or undefined. A bad value is dropped rather than
 * rejected: a filter is a convenience, and `?precio_min=abc` should show the
 * unfiltered page, never an error.
 */
function positive(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseSort(raw: string | undefined): SortOption | undefined {
  return raw === "pris_upp" || raw === "pris_ner" ? raw : undefined;
}

/**
 * Read the facets a visitor chose out of a query string.
 *
 * Only the parts that live in the query string: `operation` and
 * `propertyType` are usually fixed by the path on a category page, and are
 * read here for the surfaces (the map endpoint) where they arrive as params.
 * `locationIds` never comes from the URL as ids — see `parseLocationSlugs`.
 */
export function parseFacetParams(sp: ParamBag): ListingFacets {
  const affar = one(sp, FACET_PARAM.operation);
  const typ = one(sp, FACET_PARAM.propertyType);
  return {
    operation: affar ? parseOperation(affar) ?? undefined : undefined,
    propertyType: typ ? parseTypePlural(typ) ?? undefined : undefined,
    priceMin: positive(one(sp, FACET_PARAM.priceMin)),
    priceMax: positive(one(sp, FACET_PARAM.priceMax)),
    minBedrooms: positive(one(sp, FACET_PARAM.minBedrooms)),
    sort: parseSort(one(sp, FACET_PARAM.sort)),
  };
}

/** The `?ort=&omrade=` pair, for callers that resolve slugs themselves. */
export function parseLocationSlugs(sp: ParamBag): {
  citySlug?: string;
  barrioSlug?: string;
} {
  return {
    citySlug: one(sp, FACET_PARAM.city),
    barrioSlug: one(sp, FACET_PARAM.barrio),
  };
}

/** True when the visitor narrowed anything themselves (as opposed to the path). */
export function hasUserFacets(f: ListingFacets): boolean {
  return Boolean(f.priceMin || f.priceMax || f.minBedrooms || f.sort);
}

/**
 * Facets back out as query-string pairs — the inverse of `parseFacetParams`,
 * so a link that carries filters across a view switch cannot spell them
 * differently from the parser that reads them back.
 */
export function facetSearchParams(
  f: ListingFacets,
  opts: { operationSlug?: string; typeSlug?: string } = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  if (opts.operationSlug) out[FACET_PARAM.operation] = opts.operationSlug;
  if (opts.typeSlug) out[FACET_PARAM.propertyType] = opts.typeSlug;
  if (f.priceMin) out[FACET_PARAM.priceMin] = String(f.priceMin);
  if (f.priceMax) out[FACET_PARAM.priceMax] = String(f.priceMax);
  if (f.minBedrooms) out[FACET_PARAM.minBedrooms] = String(f.minBedrooms);
  if (f.sort) out[FACET_PARAM.sort] = f.sort;
  return out;
}
