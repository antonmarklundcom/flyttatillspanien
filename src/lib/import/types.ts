/**
 * Importer framework types (ARCHITECTURE.md §2.4, M2; Spain schema per
 * docs/SPAIN-PORTAL-DESIGN.md).
 *
 * MVP intake stays CSV/XLSX through planImport/commitImport — XML feed
 * ingestion (Idealista/Fotocasa/Kyero formats) is v1.1, explicitly out of
 * scope for the first implementation pass, and goes through this same
 * pipeline when it lands. `RawListing[]` is what every adapter produces; the
 * pipeline (normalize → dedup → upsert) is source-agnostic.
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

export type PropertyType =
  | "villa"
  | "apartamento"
  | "atico"
  | "adosado"
  | "duplex"
  | "finca"
  | "terreno"
  | "local";

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

export type PropertyState =
  | "obra_nueva"
  | "sobre_plano"
  | "en_construccion"
  | "segunda_mano";

/** What an adapter emits — strings arrive loose from spreadsheets/feeds. */
export interface RawListing {
  source: ListingSource;
  sourceExternalId?: string; // stable id in the source system (dedup within a source)
  sourceUrl?: string;

  operation: Operation;
  propertyType: PropertyType;
  title: string;
  descriptionEs?: string;

  priceEur: number;

  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  builtM2?: number;
  usableM2?: number;
  plotM2?: number;
  yearBuilt?: number;
  propertyState?: PropertyState;

  // Spain legal block (docs/SPAIN-PORTAL-DESIGN.md §3.2) — optional on
  // intake because most feeds omit some of it; the publish gate (server
  // action, not the form) is what stops an ad going live without
  // energyRating.
  referenciaCatastral?: string;
  energyRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "en_tramite" | "exento";
  energyEmissions?: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  energyKwhM2?: number;
  energyCo2M2?: number;
  legalStatus?:
    | "escritura_registrada"
    | "obra_nueva_lpo"
    | "sin_lpo"
    | "en_regularizacion"
    | "desconocido";
  chargesStatus?: "libre_de_cargas" | "con_hipoteca" | "con_cargas" | "desconocido";
  ibiAnnualEur?: number;
  communityMonthlyEur?: number;
  isVpo?: boolean;
  landClassification?: "urbano" | "urbanizable" | "rustico";
  buildableM2?: number;
  touristLicence?: string;

  /** Preferred: exact 'marbella/nueva-andalucia'. Fallback: a name we fuzzy-resolve. */
  locationFullSlug?: string;
  locationName?: string;
  addressText?: string;
  lat?: number;
  lng?: number;

  /**
   * Seller/agent phone — hashed into the fuzzy dedup key, never a listing
   * column. When `referenciaCatastral` is present, dedup uses that exact key
   * instead and skips this fuzzy path entirely (docs/SPAIN-PORTAL-DESIGN.md
   * §3.2, import consequence).
   */
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
