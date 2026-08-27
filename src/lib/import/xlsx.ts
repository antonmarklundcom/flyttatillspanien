/**
 * Minimal .xlsx reader — enough to turn an agency's spreadsheet into the same
 * `Record<string, string>[]` the CSV adapter produces, and nothing more.
 *
 * Why not a library: the `xlsx` package on npm is a stale mirror of a project
 * that moved its releases off the registry, which is a supply-chain shape worth
 * avoiding for a format we need one direction of. An .xlsx is a ZIP of XML, and
 * Node ships the inflate. This reads the sheet, the shared string table, and
 * stops — no formulas, no styles, no dates, no writing.
 *
 * What it deliberately does NOT do: interpret number formats. Excel stores a
 * date as a serial number and the *format* is what makes it a date; since no
 * column in the import template is a date, guessing here could only invent
 * wrong values. Numbers come back as the digits Excel stored.
 */
import { inflateRawSync } from "node:zlib";

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export class XlsxError extends Error {}

/** Read the ZIP central directory into name → decompressed bytes, lazily. */
function readZip(buf: Buffer): Map<string, () => Buffer> {
  // The end-of-central-directory record sits at the very end, unless the file
  // carries a comment — hence the scan backwards over the 64KB it may occupy.
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new XlsxError("not a zip archive");

  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff)
    throw new XlsxError("zip64 archives are not supported");

  const out = new Map<string, () => Buffer>();
  for (let n = 0; n < entryCount; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CEN_SIG) break;

    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);

    out.set(name, () => {
      if (buf.readUInt32LE(localOffset) !== LOC_SIG)
        throw new XlsxError(`corrupt entry '${name}'`);
      // The local header repeats the name/extra lengths and they can differ
      // from the central directory's — the data starts after the local pair.
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(raw);
      if (method === 8) return inflateRawSync(raw);
      throw new XlsxError(`unsupported compression in '${name}'`);
    });

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* XML                                                                 */
/* ------------------------------------------------------------------ */

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => XML_ENTITIES[name.toLowerCase()] ?? whole);
}

/** Concatenated text of every <t> in a fragment — a string can be split into
 *  several runs when part of it is styled differently. */
function textRuns(fragment: string): string {
  let out = "";
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
    out += decodeXml(m[1]);
  }
  return out;
}

/** xl/sharedStrings.xml → the indexed string table cells refer to. */
function readSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) {
    out.push(textRuns(m[1]));
  }
  return out;
}

/** "BC12" → 54 (0-based column index); the row part is ignored. */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break; // hit the row digits
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

/** The first worksheet, as a grid of trimmed strings. */
export function parseXlsx(buf: Buffer): string[][] {
  const zip = readZip(buf);

  const sharedPart = zip.get("xl/sharedStrings.xml");
  const shared = sharedPart ? readSharedStrings(sharedPart().toString("utf8")) : [];

  /**
   * Which file is "the first sheet" is decided by the workbook, not by the
   * filename: a workbook whose first tab was deleted can have its first sheet
   * living in sheet2.xml, and reading sheet1.xml would silently import the
   * wrong tab.
   */
  const sheetPath = firstSheetPath(zip);
  const part = zip.get(sheetPath);
  if (!part) throw new XlsxError("the workbook has no readable sheet");
  const xml = part().toString("utf8");

  const grid: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>|<row[^>]*\/>/g)) {
    const body = rowMatch[1];
    const cells: string[] = [];
    if (body) {
      for (const c of body.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? "";
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
        const type = /t="([^"]+)"/.exec(attrs)?.[1];

        let value = "";
        if (type === "s") {
          const idx = Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
          value = shared[idx] ?? "";
        } else if (type === "inlineStr") {
          value = textRuns(inner);
        } else {
          // n (number), b (boolean), str (formula result), or untyped.
          value = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
        }

        // Empty cells are simply absent from the XML, so a cell's column has
        // to come from its reference — appending in document order would shift
        // every value left of a gap into the wrong column.
        const at = ref ? columnIndex(ref) : cells.length;
        while (cells.length < at) cells.push("");
        cells[at] = value.trim();
      }
    }
    grid.push(cells);
  }

  return grid.filter((r) => r.some((cell) => cell !== ""));
}

/** Resolve the workbook's first sheet to its part name via the rels table. */
function firstSheetPath(zip: Map<string, () => Buffer>): string {
  const workbookPart = zip.get("xl/workbook.xml");
  const relsPart = zip.get("xl/_rels/workbook.xml.rels");
  if (workbookPart && relsPart) {
    const rid = /<sheet\b[^>]*r:id="([^"]+)"/.exec(
      workbookPart().toString("utf8"),
    )?.[1];
    if (rid) {
      const rels = relsPart().toString("utf8");
      const target = new RegExp(
        `<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`,
      ).exec(rels)?.[1];
      if (target) {
        const clean = target.replace(/^\/?(xl\/)?/, "");
        if (zip.has(`xl/${clean}`)) return `xl/${clean}`;
      }
    }
  }
  // Fall back to the conventional layout rather than failing outright.
  for (const name of zip.keys()) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) return name;
  }
  throw new XlsxError("the workbook has no readable sheet");
}

/** Grid → keyed records using the header row, matching parseCsvRecords. */
export function parseXlsxRecords(buf: Buffer): Record<string, string>[] {
  const rows = parseXlsx(buf);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h) rec[h] = (r[i] ?? "").trim();
    });
    return rec;
  });
}
