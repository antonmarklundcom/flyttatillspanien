/**
 * Importer framework types (ARCHITECTURE.md §2.4, M2).
 *
 * Every intake path — white-glove CSV now, InfoCasas/Clasipar scrapers later
 * (M6) — produces `RawListing[]`. The pipeline (normalize → dedup → upsert)
 * is source-agnostic: adapters only translate their format into this shape.
 */

export type ListingSource =
  | "manual"
  | "fsbo_ads"
  | "whiteglove"
  | "import_tulugar"
  | "import_infocasas"
  | "import_clasipar"
  | "import_agency_site"
  | "api";

export type Operation = "venta" | "alquiler" | "alquiler_temporal";

/**
 * The enum values as a runtime list, for validating anything that arrives as a
 * string (form bodies, query params, imported pages). Single definition on
 * purpose: this list had drifted into three separate copies.
 */
export const OPERATIONS: readonly Operation[] = [
  "venta",
  "alquiler",
  "alquiler_temporal",
];

export const PROPERTY_TYPES: readonly PropertyType[] = [
  "casa",
  "departamento",
  "terreno",
  "duplex",
  "comercial",
  "oficina",
  "deposito",
  "quinta",
];

export type PropertyType =
  | "casa"
  | "departamento"
  | "terreno"
  | "duplex"
  | "comercial"
  | "oficina"
  | "deposito"
  | "quinta";

export type PropertyState =
  | "entrega_inmediata"
  | "en_construccion"
  | "en_pozo"
  | "usado";

/** What an adapter emits — strings arrive loose from spreadsheets/scrapers. */
export interface RawListing {
  source: ListingSource;
  sourceExternalId?: string; // stable id in the source system (dedup within a source)
  sourceUrl?: string;

  operation: Operation;
  propertyType: PropertyType;
  title: string;
  descriptionEs?: string;

  priceAmount: number;
  priceCurrency: "USD" | "PYG";

  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  areaM2?: number;
  landM2?: number;
  propertyState?: PropertyState;

  /** Preferred: exact 'asuncion/recoleta'. Fallback: a name we fuzzy-resolve. */
  locationFullSlug?: string;
  locationName?: string;
  addressText?: string;
  lat?: number;
  lng?: number;

  /** Seller/agent phone — hashed into the dedup key, never a listing column. */
  contactPhone?: string;
  imageUrls?: string[]; // fetched to R2 in a later pass, not at import time
}

export interface ImportReport {
  created: number;
  updated: number; // same source row, content changed
  unchanged: number; // same source row, identical content
  deduped: number; // matched an existing listing from another source
  skipped: number; // validation/location failures
  errors: { row: number; reason: string }[];
}
