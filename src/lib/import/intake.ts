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
  "price_amount",
  "price_currency",
  "bedrooms",
  "bathrooms",
  "parking",
  "area_m2",
  "land_m2",
  "property_state",
  "location_full_slug",
  "location_name",
  "address_text",
  "lat",
  "lng",
  "contact_phone",
  "source_external_id",
  "source_url",
  "image_urls",
] as const;

export const REQUIRED_COLUMNS = [
  "operation",
  "property_type",
  "title",
  "price_amount",
] as const;

/**
 * Sources an operator may pick in the upload form. `manual`, `api` and
 * `fsbo_ads` are excluded because they describe how a listing arrived, not a
 * file someone can hand you.
 */
export const UPLOAD_SOURCES: readonly ListingSource[] = [
  "whiteglove",
  "import_agency_site",
  "import_tulugar",
  "import_infocasas",
  "import_clasipar",
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

/** The blank template, as the download route serves it. */
export function templateCsv(): string {
  const example = [
    "venta",
    "casa",
    "Casa en Villa Morra con patio",
    "Casa reciclada a una cuadra de Avda. España.",
    "185000",
    "USD",
    "3",
    "2",
    "2",
    "180",
    "360",
    "usado",
    "",
    "Villa Morra",
    "Dr. Morra casi Sucre",
    "",
    "",
    "0981123456",
    "A-001",
    "",
    "",
  ];
  return `${TEMPLATE_COLUMNS.join(",")}\n${example
    .map((v) => (v.includes(",") ? `"${v}"` : v))
    .join(",")}\n`;
}
