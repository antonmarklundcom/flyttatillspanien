/**
 * CSV adapter (ARCHITECTURE.md §2.4, M2) — turns a white-glove spreadsheet
 * export into RawListing[]. Minimal RFC-4180 parser (quotes, escaped quotes,
 * embedded newlines) so we take no dependency for a format this simple.
 *
 * Expected header columns (snake_case; extras ignored, missing optional ones
 * default): operation, property_type, title, description_es, price_amount,
 * price_currency, bedrooms, bathrooms, parking, area_m2, land_m2,
 * property_state, location_full_slug, location_name, address_text, lat, lng,
 * contact_phone, source_external_id, source_url, image_urls (| separated).
 */
import { parseAmount } from "./normalize";
import {
  CHARGES_STATUSES,
  ENERGY_EMISSIONS,
  ENERGY_RATINGS,
  LAND_CLASSIFICATIONS,
  LEGAL_STATUSES,
  OPERATIONS,
  PROPERTY_STATES,
  PROPERTY_TYPES,
} from "./types";
import type { RawListing, ListingSource } from "./types";

/** Parse CSV text into rows of raw string cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // flush trailing field/row (file may not end in newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** CSV text → keyed records using the header row. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => (rec[h] = (r[i] ?? "").trim()));
    return rec;
  });
}

/**
 * Plain numeric cell — counts and coordinates, where '.' really is a decimal
 * point (lat -25.28 must stay -25.28).
 */
const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Money/area cell — Spanish spreadsheets write `285.000` meaning 285 000, so
 * these go through the locale-aware parseAmount the link importer already
 * uses. Reading `285.000` as a JS decimal wrote a €285 listing into the DB
 * (F3).
 */
const amount = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  return parseAmount(s) ?? undefined;
};

/**
 * A cell that must be one of a fixed set, or undefined.
 *
 * Throws on a value that is present but not a member, rather than dropping it:
 * a feed spelling `legal_status` as `sin licencia` is telling us something
 * about the property, and silently storing the `desconocido` default would
 * turn a stated problem into "nobody said". Absence and a bad value are
 * different facts.
 */
function enumCell<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  column: string,
): T | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if ((allowed as readonly string[]).includes(v)) return v as T;
  throw new Error(
    `invalid ${column} '${v}' — expected one of ${allowed.join(", ")}`,
  );
}

/** A yes/no cell. Blank is `undefined`, not `false`. */
function boolCell(value: string | undefined): boolean | undefined {
  const v = value?.trim().toLowerCase();
  if (!v) return undefined;
  if (["1", "true", "si", "sí", "ja", "yes", "x"].includes(v)) return true;
  if (["0", "false", "no", "nej"].includes(v)) return false;
  return undefined;
}

/** Map one CSV record to a RawListing. Throws with a clear reason if invalid. */
export function recordToRaw(
  rec: Record<string, string>,
  source: ListingSource,
): RawListing {
  if (!rec.title) throw new Error("missing title");
  if (!rec.operation) throw new Error("missing operation");
  if (!rec.property_type) throw new Error("missing property_type");

  // Validated rather than cast. A cast let an unknown enum value travel all
  // the way to MySQL, where it lands as a truncation warning and an empty
  // string — a listing filed under no operation at all.
  const operation = enumCell(rec.operation, OPERATIONS, "operation")!;
  const propertyType = enumCell(
    rec.property_type,
    PROPERTY_TYPES,
    "property_type",
  )!;

  // Spain is EUR-only, so there is no currency column to get wrong.
  const priceEur = amount(rec.price_eur);
  if (priceEur === undefined || priceEur <= 0)
    throw new Error(`invalid price_eur '${rec.price_eur}'`);
  if (!rec.location_full_slug && !rec.location_name)
    throw new Error("need location_full_slug or location_name");

  return {
    source,
    sourceExternalId: rec.source_external_id || undefined,
    sourceUrl: rec.source_url || undefined,
    operation,
    propertyType,
    title: rec.title,
    descriptionEs: rec.description_es || undefined,
    priceEur,
    bedrooms: num(rec.bedrooms),
    bathrooms: num(rec.bathrooms),
    parking: num(rec.parking),
    builtM2: amount(rec.built_m2),
    usableM2: amount(rec.usable_m2),
    plotM2: amount(rec.plot_m2),
    yearBuilt: num(rec.year_built),
    propertyState: enumCell(
      rec.property_state,
      PROPERTY_STATES,
      "property_state",
    ),
    locationFullSlug: rec.location_full_slug || undefined,
    locationName: rec.location_name || undefined,
    addressText: rec.address_text || undefined,
    lat: num(rec.lat),
    lng: num(rec.lng),
    /* The Spain legal block. Normalisation of the catastral reference itself
       happens in normalize.ts, which is also what decides that a malformed one
       is not a reference at all. */
    referenciaCatastral: rec.referencia_catastral || undefined,
    energyRating: enumCell(rec.energy_rating, ENERGY_RATINGS, "energy_rating"),
    energyEmissions: enumCell(
      rec.energy_emissions,
      ENERGY_EMISSIONS,
      "energy_emissions",
    ),
    energyKwhM2: amount(rec.energy_kwh_m2),
    energyCo2M2: amount(rec.energy_co2_m2),
    legalStatus: enumCell(rec.legal_status, LEGAL_STATUSES, "legal_status"),
    chargesStatus: enumCell(
      rec.charges_status,
      CHARGES_STATUSES,
      "charges_status",
    ),
    ibiAnnualEur: amount(rec.ibi_annual_eur),
    communityMonthlyEur: amount(rec.community_monthly_eur),
    isVpo: boolCell(rec.is_vpo),
    landClassification: enumCell(
      rec.land_classification,
      LAND_CLASSIFICATIONS,
      "land_classification",
    ),
    buildableM2: amount(rec.buildable_m2),
    touristLicence: rec.tourist_licence || undefined,
    contactPhone: rec.contact_phone || undefined,
    imageUrls: rec.image_urls
      ? rec.image_urls.split("|").map((u) => u.trim()).filter(Boolean)
      : undefined,
  };
}
