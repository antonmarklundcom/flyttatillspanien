/**
 * CSV adapter — turns a white-glove spreadsheet export into RawListing[].
 * Minimal RFC-4180 parser (quotes, escaped quotes, embedded newlines) so we
 * take no dependency for a format this simple.
 *
 * Expected header columns (snake_case; extras ignored, missing optional ones
 * default): operation, property_type, title, description_es, price_eur,
 * bedrooms, bathrooms, parking, built_m2, usable_m2, plot_m2, year_built,
 * property_state, location_full_slug, location_name, address_text, lat, lng,
 * contact_phone, source_external_id, source_url, image_urls (| separated),
 * plus the Spain legal block: referencia_catastral, energy_rating,
 * energy_emissions, energy_kwh_m2, energy_co2_m2, legal_status,
 * charges_status, ibi_annual_eur, community_monthly_eur, is_vpo,
 * land_classification, buildable_m2, tourist_licence.
 */
import { parseAmount } from "./normalize";
import type {
  Operation,
  PropertyState,
  PropertyType,
  RawListing,
  ListingSource,
} from "./types";

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
 * point (lat 36.51 must stay 36.51).
 */
const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Money/area cell — Spanish spreadsheets write `285.000` meaning 285 000, so
 * these go through the locale-aware parseAmount the link importer already
 * uses. Reading `285.000` as a JS decimal wrote a €285 listing into the DB.
 */
const amount = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  return parseAmount(s) ?? undefined;
};

const bool = (s: string | undefined): boolean | undefined => {
  if (!s) return undefined;
  return /^(1|true|si|sí|yes)$/i.test(s.trim());
};

/** Map one CSV record to a RawListing. Throws with a clear reason if invalid. */
export function recordToRaw(
  rec: Record<string, string>,
  source: ListingSource,
): RawListing {
  const operation = rec.operation as Operation;
  const propertyType = rec.property_type as PropertyType;
  const priceEur = amount(rec.price_eur);

  if (!rec.title) throw new Error("missing title");
  if (!operation) throw new Error("missing operation");
  if (!propertyType) throw new Error("missing property_type");
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
    propertyState: (rec.property_state as PropertyState) || undefined,
    locationFullSlug: rec.location_full_slug || undefined,
    locationName: rec.location_name || undefined,
    addressText: rec.address_text || undefined,
    lat: num(rec.lat),
    lng: num(rec.lng),
    contactPhone: rec.contact_phone || undefined,
    imageUrls: rec.image_urls
      ? rec.image_urls.split("|").map((u) => u.trim()).filter(Boolean)
      : undefined,
    // Spain legal block (docs/SPAIN-PORTAL-DESIGN.md §3.2) — optional
    // columns, most feeds omit some of them.
    referenciaCatastral: rec.referencia_catastral || undefined,
    energyRating: (rec.energy_rating as RawListing["energyRating"]) || undefined,
    energyEmissions: (rec.energy_emissions as RawListing["energyEmissions"]) || undefined,
    energyKwhM2: amount(rec.energy_kwh_m2),
    energyCo2M2: amount(rec.energy_co2_m2),
    legalStatus: (rec.legal_status as RawListing["legalStatus"]) || undefined,
    chargesStatus: (rec.charges_status as RawListing["chargesStatus"]) || undefined,
    ibiAnnualEur: amount(rec.ibi_annual_eur),
    communityMonthlyEur: amount(rec.community_monthly_eur),
    isVpo: bool(rec.is_vpo),
    landClassification:
      (rec.land_classification as RawListing["landClassification"]) || undefined,
    buildableM2: amount(rec.buildable_m2),
    touristLicence: rec.tourist_licence || undefined,
  };
}
