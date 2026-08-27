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
 * point (lat -25.28 must stay -25.28).
 */
const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Money/area cell — es-PY spreadsheets write `85.000` meaning 85 000, so these
 * go through the locale-aware parseAmount the link importer already uses.
 * Reading `85.000` as a JS decimal wrote a $85 listing into the DB (F3).
 */
const amount = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  return parseAmount(s) ?? undefined;
};

/** Map one CSV record to a RawListing. Throws with a clear reason if invalid. */
export function recordToRaw(
  rec: Record<string, string>,
  source: ListingSource,
): RawListing {
  const operation = rec.operation as Operation;
  const propertyType = rec.property_type as PropertyType;
  const priceAmount = amount(rec.price_amount);
  const currency = (rec.price_currency || "USD").toUpperCase();

  if (!rec.title) throw new Error("missing title");
  if (!operation) throw new Error("missing operation");
  if (!propertyType) throw new Error("missing property_type");
  if (priceAmount === undefined || priceAmount <= 0)
    throw new Error(`invalid price_amount '${rec.price_amount}'`);
  if (currency !== "USD" && currency !== "PYG")
    throw new Error(`invalid price_currency '${rec.price_currency}'`);
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
    priceAmount,
    priceCurrency: currency,
    bedrooms: num(rec.bedrooms),
    bathrooms: num(rec.bathrooms),
    parking: num(rec.parking),
    areaM2: amount(rec.area_m2),
    landM2: amount(rec.land_m2),
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
  };
}
