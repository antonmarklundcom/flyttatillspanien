/**
 * Importer framework types (ARCHITECTURE.md §2.4, M2).
 *
 * Every intake path — white-glove CSV/XLSX now, portal feeds later — produces
 * `RawListing[]`. The pipeline (normalize → dedup → upsert) is source-agnostic:
 * adapters only translate their format into this shape.
 *
 * The enum values are Spanish because that is the language of every agency
 * feed the importer will ever read; the Swedish URL slugs live in
 * `src/lib/urls.ts`. Keeping feed vocabulary and URL vocabulary in one place
 * is how they drift.
 */

export type ListingSource =
  | "manual"
  | "fsbo_ads"
  | "whiteglove"
  | "import_idealista"
  | "import_fotocasa"
  | "import_kyero"
  | "import_agency_site"
  | "api";

export type Operation = "venta" | "alquiler" | "alquiler_vacacional";

/**
 * The enum values as a runtime list, for validating anything that arrives as a
 * string (form bodies, query params, imported pages). Single definition on
 * purpose: this list had drifted into three separate copies.
 */
export const OPERATIONS: readonly Operation[] = [
  "venta",
  "alquiler",
  "alquiler_vacacional",
];

export const PROPERTY_TYPES: readonly PropertyType[] = [
  "villa",
  "apartamento",
  "atico",
  "adosado",
  "duplex",
  "finca",
  "terreno",
  "local",
];

export type PropertyType =
  | "villa"
  | "apartamento"
  | "atico"
  | "adosado"
  | "duplex"
  | "finca"
  | "terreno"
  | "local";

export type PropertyState =
  | "obra_nueva"
  | "sobre_plano"
  | "en_construccion"
  | "segunda_mano";

export const PROPERTY_STATES: readonly PropertyState[] = [
  "obra_nueva",
  "sobre_plano",
  "en_construccion",
  "segunda_mano",
];

export type EnergyRating =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "en_tramite"
  | "exento";

export const ENERGY_RATINGS: readonly EnergyRating[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "en_tramite",
  "exento",
];

/**
 * The emissions scale has no `en_tramite`/`exento`: those two are answers
 * about the *certificate*, and a certificate that does not exist yet has no
 * emissions letter to report.
 */
export type EnergyEmissions = Exclude<EnergyRating, "en_tramite" | "exento">;

export const ENERGY_EMISSIONS: readonly EnergyEmissions[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
];

export type LegalStatus =
  | "escritura_registrada"
  | "obra_nueva_lpo"
  | "sin_lpo"
  | "en_regularizacion"
  | "desconocido";

export const LEGAL_STATUSES: readonly LegalStatus[] = [
  "escritura_registrada",
  "obra_nueva_lpo",
  "sin_lpo",
  "en_regularizacion",
  "desconocido",
];

export type ChargesStatus =
  | "libre_de_cargas"
  | "con_hipoteca"
  | "con_cargas"
  | "desconocido";

export const CHARGES_STATUSES: readonly ChargesStatus[] = [
  "libre_de_cargas",
  "con_hipoteca",
  "con_cargas",
  "desconocido",
];

export type LandClassification = "urbano" | "urbanizable" | "rustico";

export const LAND_CLASSIFICATIONS: readonly LandClassification[] = [
  "urbano",
  "urbanizable",
  "rustico",
];

/** What an adapter emits — strings arrive loose from spreadsheets/scrapers. */
export interface RawListing {
  source: ListingSource;
  sourceExternalId?: string; // stable id in the source system (dedup within a source)
  sourceUrl?: string;

  operation: Operation;
  propertyType: PropertyType;
  title: string;
  descriptionEs?: string;

  /** EUR is the only price. There is no currency to carry alongside it. */
  priceEur: number;

  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  /** superficie construida — the only faceted area figure. */
  builtM2?: number;
  /** superficie útil — display only. */
  usableM2?: number;
  plotM2?: number;
  yearBuilt?: number;
  propertyState?: PropertyState;

  /**
   * The Catastro reference, when the feed carries one. Present ⇒ the pipeline
   * dedups on it EXACTLY and skips the fuzzy path entirely; absent ⇒ it falls
   * back to `dedupKey()`'s bucketed phone key, `null`-means-do-not-merge rule
   * included.
   */
  referenciaCatastral?: string;
  energyRating?: EnergyRating;
  energyEmissions?: Exclude<EnergyRating, "en_tramite" | "exento">;
  energyKwhM2?: number;
  energyCo2M2?: number;
  legalStatus?: LegalStatus;
  chargesStatus?: ChargesStatus;
  ibiAnnualEur?: number;
  communityMonthlyEur?: number;
  isVpo?: boolean;
  landClassification?: LandClassification;
  buildableM2?: number;
  touristLicence?: string;

  /** Preferred: exact 'marbella/nueva-andalucia'. Fallback: a name we fuzzy-resolve. */
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
