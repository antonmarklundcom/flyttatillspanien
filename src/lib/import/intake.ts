/**
 * File in, `RawListing[]` out — the one place that knows about spreadsheets.
 *
 * Both upload formats converge on the same keyed records the CSV adapter
 * already produced, so `recordToRaw` stays the single definition of what a
 * column means. There is no column-mapping UI on purpose: the template is
 * fixed, published, and handed to the agency. A mapper is the right answer to
 * "our third agency refuses to use the template" — a problem worth waiting for,
 * since guessing which four columns actually vary is cheaper once you've seen
 * them vary.
 */
import {
  parseCsvRecords,
  recordToRaw,
} from "./csv";
import { parseXlsxRecords, XlsxError } from "./xlsx";
import type { ListingSource, RawListing } from "./types";

/** Below next.config's serverActions limit, so this error fires first. */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
/** A spreadsheet, not a database dump. Beyond this, use the CLI. */
export const MAX_ROWS = 5000;

/** The template columns, in the order the downloadable file presents them. */
export const TEMPLATE_COLUMNS = [
  "operation",
  "property_type",
  "title",
  "description_es",
  "price_eur",
  "bedrooms",
  "bathrooms",
  "parking",
  "built_m2",
  "usable_m2",
  "plot_m2",
  "year_built",
  "property_state",
  "location_full_slug",
  "location_name",
  "address_text",
  "lat",
  "lng",
  /* The Spain legal block. `referencia_catastral` is first because it is the
     single highest-value cell in the file: it is the exact dedup key and the
     strongest anti-fraud signal the portal has. */
  "referencia_catastral",
  "energy_rating",
  "energy_emissions",
  "energy_kwh_m2",
  "energy_co2_m2",
  "legal_status",
  "charges_status",
  "ibi_annual_eur",
  "community_monthly_eur",
  "is_vpo",
  "land_classification",
  "buildable_m2",
  "tourist_licence",
  "contact_phone",
  "source_external_id",
  "source_url",
  "image_urls",
] as const;

/**
 * `energy_rating` is deliberately NOT required. A feed that has not got the
 * certificate yet must still be importable — the row simply cannot be
 * published until the rating arrives, which the publish gate enforces at the
 * one transition where it matters (src/lib/publish-gate.ts). Making it
 * required here would reject whole spreadsheets over a field the operator can
 * fill in later.
 */
export const REQUIRED_COLUMNS = [
  "operation",
  "property_type",
  "title",
  "price_eur",
] as const;

/**
 * Sources an operator may pick in the upload form. `manual`, `api` and
 * `fsbo_ads` are excluded because they describe how a listing arrived, not a
 * file someone can hand you.
 */
export const UPLOAD_SOURCES: readonly ListingSource[] = [
  "whiteglove",
  "import_agency_site",
  "import_idealista",
  "import_fotocasa",
  "import_kyero",
];

export type IntakeKind = "csv" | "xlsx";

export interface IntakeResult {
  kind: IntakeKind;
  rows: RawListing[];
  /** Rows that never became a RawListing — bad enum, missing price, and so on. */
  parseErrors: { row: number; reason: string }[];
  /** Header columns we did not recognise. Informational, never fatal. */
  unknownColumns: string[];
  missingRequired: string[];
  totalRows: number;
}

export class IntakeError extends Error {}

export function kindForFilename(filename: string): IntakeKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".csv")) return "csv";
  throw new IntakeError("El archivo debe ser .csv o .xlsx.");
}

/**
 * Parse an uploaded spreadsheet.
 *
 * Row numbers count data rows, 1-based, header excluded — not spreadsheet line
 * numbers. Fully blank lines are dropped before numbering, so a file padded
 * with empty rows will report a number lower than the line Excel shows. The row
 * title is carried alongside in the job log for exactly that reason.
 */
export function readIntake(
  bytes: Buffer,
  filename: string,
  source: ListingSource,
): IntakeResult {
  if (bytes.length === 0) throw new IntakeError("El archivo está vacío.");
  if (bytes.length > MAX_UPLOAD_BYTES)
    throw new IntakeError(
      `El archivo supera los ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    );

  const kind = kindForFilename(filename);

  let records: Record<string, string>[];
  try {
    records =
      kind === "xlsx"
        ? parseXlsxRecords(bytes)
        : // A BOM from Excel's "CSV UTF-8" export would otherwise become part
          // of the first header name and make `operation` unrecognisable.
          parseCsvRecords(bytes.toString("utf8").replace(/^﻿/, ""));
  } catch (e) {
    if (e instanceof XlsxError)
      throw new IntakeError(`No pudimos leer el archivo: ${e.message}`);
    throw new IntakeError("No pudimos leer el archivo.");
  }

  if (records.length === 0)
    throw new IntakeError("El archivo no tiene filas debajo del encabezado.");
  if (records.length > MAX_ROWS)
    throw new IntakeError(
      `El archivo tiene ${records.length} filas; el máximo es ${MAX_ROWS}.`,
    );

  const header = Object.keys(records[0]);
  const known = new Set<string>(TEMPLATE_COLUMNS);
  const unknownColumns = header.filter((h) => !known.has(h));
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !header.includes(c));

  const rows: RawListing[] = [];
  const parseErrors: { row: number; reason: string }[] = [];
  records.forEach((rec, i) => {
    try {
      rows.push(recordToRaw(rec, source));
    } catch (e) {
      parseErrors.push({
        row: i + 1,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  });

  return {
    kind,
    rows,
    parseErrors,
    unknownColumns,
    missingRequired,
    totalRows: records.length,
  };
}

/**
 * The blank template, as the download route serves it.
 *
 * The example row is keyed by column NAME, not written out positionally. The
 * positional version silently misaligned the moment a column was added in the
 * middle — every value after the insertion point landed one cell to the left,
 * which reads as a plausible spreadsheet and imports as nonsense. A column
 * with no example here is simply blank, which is also the honest answer for
 * the optional legal fields.
 */
const TEMPLATE_EXAMPLE: Partial<Record<(typeof TEMPLATE_COLUMNS)[number], string>> =
  {
    operation: "venta",
    property_type: "villa",
    title: "Villa con jardín en Nueva Andalucía",
    description_es: "Villa reformada a diez minutos de Puerto Banús.",
    price_eur: "485000",
    bedrooms: "4",
    bathrooms: "3",
    parking: "2",
    built_m2: "280",
    usable_m2: "245",
    plot_m2: "800",
    year_built: "2004",
    property_state: "segunda_mano",
    // Preferred over location_name: an exact match needs no fuzzy resolution.
    location_full_slug: "marbella/nueva-andalucia",
    location_name: "Marbella",
    address_text: "Calle Ejemplo 1",
    // 20 characters, exactly. Anything else is not a cadastral reference and
    // the importer treats it as absent (normalize.ts).
    referencia_catastral: "9872023VH5797S0001WX",
    // Required before the row can be published, not before it can be imported.
    energy_rating: "D",
    legal_status: "escritura_registrada",
    charges_status: "libre_de_cargas",
    ibi_annual_eur: "820",
    community_monthly_eur: "145",
    is_vpo: "no",
    contact_phone: "+34 952 12 34 56",
    source_external_id: "A-001",
  };

export function templateCsv(): string {
  const row = TEMPLATE_COLUMNS.map((c) => TEMPLATE_EXAMPLE[c] ?? "");
  return `${TEMPLATE_COLUMNS.join(",")}\n${row
    .map((v) => (v.includes(",") ? `"${v}"` : v))
    .join(",")}\n`;
}
