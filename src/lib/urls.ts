/**
 * URL scheme — permanent SEO contract. Every canonical URL and every parse of
 * an inbound path goes through here, so the shape is defined once. Types are
 * pluralized nouns; operations are nouns, never verbs. Swedish segments per
 * docs/SPAIN-PORTAL-DESIGN.md, i18n handoff — the DB enum values stay in
 * Spanish (that is the language of every agency feed the importer will ever
 * read); only the URL vocabulary is Swedish.
 *
 *   /{affar}/{ort}                    /kopa/marbella
 *   /{affar}/{ort}/{typ}             /kopa/marbella/villor
 *   /{affar}/{ort}/{omrade}/{typ}    /kopa/marbella/nueva-andalucia/villor
 *   /bostad/{slug}-{public_id}        listing detail (canonical)
 */
import type { Operation, PropertyType } from "./import/types";

/** Enum value ↔ URL segment. */
const OPERATION_SLUG: Record<Operation, string> = {
  venta: "kopa",
  alquiler: "hyra",
  alquiler_vacacional: "korttidshyra",
};
const OPERATION_FROM_SLUG: Record<string, Operation> = {
  kopa: "venta",
  hyra: "alquiler",
  korttidshyra: "alquiler_vacacional",
};

/** Singular enum → plural URL segment (and back). */
const TYPE_PLURAL: Record<PropertyType, string> = {
  villa: "villor",
  apartamento: "lagenheter",
  atico: "takvaningar",
  adosado: "radhus",
  duplex: "etagelagenheter",
  finca: "lantegendomar",
  terreno: "tomter",
  local: "lokaler",
};
const TYPE_FROM_PLURAL: Record<string, PropertyType> = Object.fromEntries(
  Object.entries(TYPE_PLURAL).map(([k, v]) => [v, k as PropertyType]),
) as Record<string, PropertyType>;

export function operationSlug(op: Operation): string {
  return OPERATION_SLUG[op];
}
export function parseOperation(slug: string): Operation | null {
  return OPERATION_FROM_SLUG[slug] ?? null;
}
export function typePlural(t: PropertyType): string {
  return TYPE_PLURAL[t];
}
export function parseTypePlural(seg: string): PropertyType | null {
  return TYPE_FROM_PLURAL[seg] ?? null;
}

export interface CategoryParams {
  operation: Operation;
  citySlug: string; // location.slug of a municipio
  barrioSlug?: string; // location.slug of a zona
  type?: PropertyType;
}

/** Build a canonical category path from resolved parts. */
export function categoryUrl(p: CategoryParams): string {
  const parts = [operationSlug(p.operation), p.citySlug];
  if (p.barrioSlug) parts.push(p.barrioSlug);
  if (p.type) parts.push(typePlural(p.type));
  return "/" + parts.join("/");
}

/** Canonical listing URL. slug is cosmetic; public_id is the identity. */
export function listingUrl(listing: {
  slug: string;
  publicId: string;
}): string {
  return `/bostad/${listing.slug}-${listing.publicId}`;
}

/**
 * Extract the 10-char public_id from a /bostad/{slug}-{public_id} param.
 * Returns null if the tail doesn't look like a public_id.
 */
export function parseListingPublicId(slugParam: string): string | null {
  const m = slugParam.match(/-([a-z0-9]{10})$/);
  return m ? m[1] : null;
}

/** Public agency profile URL. agencies.slug is already unique (schema.ts). */
export function agencyUrl(slug: string): string {
  return `/inmobiliaria/${slug}`;
}

/** Public agent profile URL. agents.slug is already unique (schema.ts). */
export function agentUrl(slug: string): string {
  return `/agent/${slug}`;
}

/**
 * Interpret the segments after /{affar}/. Pure structure check — the caller
 * still resolves slugs against the DB (and 404s on unknown locations).
 *   [city]                 → city landing
 *   [city, typ]            → city + type
 *   [city, omrade, typ]    → area + type
 * Anything else is not a valid category shape.
 */
export type CategoryShape =
  | { kind: "city"; citySlug: string }
  | { kind: "city-type"; citySlug: string; type: PropertyType }
  | {
      kind: "barrio-type";
      citySlug: string;
      barrioSlug: string;
      type: PropertyType;
    };

export function parseCategorySegments(segments: string[]): CategoryShape | null {
  if (segments.length === 1) {
    return { kind: "city", citySlug: segments[0] };
  }
  if (segments.length === 2) {
    const type = parseTypePlural(segments[1]);
    if (!type) return null; // 2nd segment must be a known type plural
    return { kind: "city-type", citySlug: segments[0], type };
  }
  if (segments.length === 3) {
    const type = parseTypePlural(segments[2]);
    if (!type) return null;
    return {
      kind: "barrio-type",
      citySlug: segments[0],
      barrioSlug: segments[1],
      type,
    };
  }
  return null;
}
