/**
 * "Paste the link to your own listing and we'll fill in the form."
 *
 * This is deliberately NOT a scraper of a competitor's catalogue. It reads one
 * page, at one agent's request, for a listing that agent says is theirs — and
 * the result is a *draft* they must review and submit through the normal review
 * queue. Nothing is published from a URL alone.
 *
 * Parsing strategy, in order:
 *   1. JSON-LD (schema.org Product / RealEstateListing / Offer)
 *   2. OpenGraph + Twitter meta
 *   3. A few generic text patterns (price, m², rooms) over the visible text
 *
 * Structured data first because it is what portals *publish for reuse*, it is
 * stable across redesigns, and it works for any site rather than one. There are
 * no per-site CSS selectors here: those break weekly and are the part that
 * makes an importer feel like scraping.
 *
 * Everything is best-effort. A field we cannot read with confidence comes back
 * empty with a note, so the agent fills it in — a wrong price silently imported
 * is far worse than a blank one.
 */
import "server-only";
import { fetchUserUrl } from "@/lib/safe-fetch";
import { parseAmount } from "./normalize";
import type { Operation, PropertyType } from "./types";

export interface ParsedListing {
  sourceUrl: string;
  title: string | null;
  description: string | null;
  priceEur: number | null;
  operation: Operation | null;
  propertyType: PropertyType | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  builtM2: number | null;
  plotM2: number | null;
  /** Free-text location as printed on the page; matched to a location later. */
  locationText: string | null;
  imageUrls: string[];
  /** Human-readable notes about what could not be read. */
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Small HTML helpers — no parser dependency for this much            */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);
}

/** Visible text: scripts, styles and tags removed, whitespace collapsed. */
function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return decodeEntities(m[1]).trim();
    }
  }
  return null;
}

/** Every JSON-LD block on the page, flattened (@graph included). */
function jsonLdNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const push = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        const obj = node as Record<string, unknown>;
        out.push(obj);
        const graph = obj["@graph"];
        if (Array.isArray(graph)) graph.forEach(push);
      };
      if (Array.isArray(parsed)) parsed.forEach(push);
      else push(parsed);
    } catch {
      // A malformed block is normal on the open web; the next source covers it.
    }
  }
  return out;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseAmount(v);
      if (n != null) return n;
    }
  }
  return null;
}

// Moved to normalize.ts so the CSV adapter shares it; re-exported for callers.
export { parseAmount } from "./normalize";

/**
 * Whether a printed amount near this match actually reads as EUR. This
 * portal is EUR-only (docs/SPAIN-PORTAL-DESIGN.md §2), so unlike the
 * inherited USD/PYG detector this returns a boolean rather than a currency:
 * a non-EUR marker (£, $, kr) next to the number means the page is not
 * denominated the way this portal expects, and the caller should leave the
 * price blank rather than import a foreign-currency figure as EUR.
 */
function looksLikeEur(text: string): boolean {
  if (/[£$]|kr\b|usd|gbp|sek/i.test(text)) return false;
  return /€|eur\b/i.test(text) || true; // no marker at all is the common case on Spanish sites
}

/** "3 dormitorios", "3 hab", "3 sovrum" → 3 */
function countNear(text: string, words: string[]): number | null {
  for (const word of words) {
    const m = text.match(new RegExp(`(\\d{1,2})\\s*(?:${word})`, "i"));
    if (m) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n >= 0 && n <= 30) return n;
    }
  }
  return null;
}

/** Surfaces like "120 m²", "120 m2", "120m²". Returns the FIRST match. */
function areaFrom(text: string, labels?: string[]): number | null {
  const pattern = labels
    ? new RegExp(`(?:${labels.join("|")})[^\\d]{0,12}(\\d[\\d.,]*)\\s*m(?:2|²)`, "i")
    : /(\d[\d.,]*)\s*m(?:2|²)/i;
  const m = text.match(pattern);
  if (!m) return null;
  const n = parseAmount(m[1]);
  return n != null && n > 0 && n < 1_000_000 ? n : null;
}

function absoluteUrl(candidate: string, base: string): string | null {
  try {
    const u = new URL(candidate, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Spanish vocabulary → our enums                                      */
/* ------------------------------------------------------------------ */

/** Order matters: "alquiler vacacional" first (more specific than "alquiler"). */
function detectOperation(text: string): Operation | null {
  const t = text.toLowerCase();
  if (/alquiler\s+vacacional|temporada|por\s+d[ií]a|vacation\s+rental/.test(t))
    return "alquiler_vacacional";
  if (/\balquil|\barrend|\brenta\b|for\s+rent|\bto\s+let\b/.test(t)) return "alquiler";
  if (/\bventa\b|\bvende\b|en\s+venta|for\s+sale/.test(t)) return "venta";
  return null;
}

function detectPropertyType(text: string): PropertyType | null {
  const t = text.toLowerCase();
  // Most specific first — "casa de campo" reads as finca, an ático is a
  // distinct tier from a plain apartamento.
  if (/\b[áa]tico/.test(t)) return "atico";
  if (/\bd[úu]plex/.test(t)) return "duplex";
  if (/\badosad|\btownhouse/.test(t)) return "adosado";
  if (/\bfinca|\bcortijo|\bmasía|\bcasa\s+de\s+campo|\bcountry\s+house/.test(t)) return "finca";
  if (/\bapartamento|\bpiso\b|\bflat\b|\bapartment\b/.test(t)) return "apartamento";
  if (/\bterreno|\bsolar\b|\bparcela\b|\bplot\b|\bland\b/.test(t)) return "terreno";
  if (/\blocal\b|\bcomercial|\bcommercial\b/.test(t)) return "local";
  if (/\bvilla\b|\bchalet\b|\bcasa\b|\bhouse\b/.test(t)) return "villa";
  return null;
}

/* ------------------------------------------------------------------ */
/* The parse                                                          */
/* ------------------------------------------------------------------ */

export function parseListingHtml(html: string, sourceUrl: string): ParsedListing {
  const notes: string[] = [];
  const nodes = jsonLdNodes(html);
  const text = visibleText(html);
  // Title + description + URL slug carry most of the type/operation signal.
  const signal = `${sourceUrl} ${text.slice(0, 4000)}`;

  const offer = nodes
    .map((n) => n.offers ?? n.Offer)
    .flatMap((o) => (Array.isArray(o) ? o : [o]))
    .find((o): o is Record<string, unknown> => !!o && typeof o === "object");

  const productish = nodes.find((n) => {
    const type = n["@type"];
    const types = Array.isArray(type) ? type : [type];
    return types.some(
      (t) =>
        typeof t === "string" &&
        /product|realestatelisting|residence|apartment|house|offer|place/i.test(t),
    );
  });

  const title =
    firstString(productish?.name, metaContent(html, "og:title", "twitter:title")) ??
    (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      ? decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)![1]).trim()
      : null);

  const description = firstString(
    productish?.description,
    metaContent(html, "og:description", "description", "twitter:description"),
  );

  const priceRaw = firstNumber(
    offer?.price,
    (offer?.priceSpecification as Record<string, unknown> | undefined)?.price,
    productish?.price,
    metaContent(html, "product:price:amount", "og:price:amount"),
  );

  const currencyRaw = firstString(
    offer?.priceCurrency,
    (offer?.priceSpecification as Record<string, unknown> | undefined)?.priceCurrency,
    metaContent(html, "product:price:currency", "og:price:currency"),
  );
  // Structured-data currency, when present, must say EUR — anything else means
  // this page is not priced the way this EUR-only portal expects.
  const structuredIsEur = currencyRaw == null || /eur\b/i.test(currencyRaw);

  // Price from visible text as a fallback: the first amount next to a €
  // marker, which on a Spanish listing page is the headline price.
  let fallbackPrice: number | null = null;
  if (priceRaw == null) {
    const m = text.match(/€\s*([\d][\d.,]{2,})|([\d][\d.,]{5,})\s*€/);
    if (m) fallbackPrice = parseAmount(m[1] ?? m[2] ?? "");
    if (fallbackPrice == null) notes.push("No pudimos leer el precio — completalo a mano.");
  }

  const images: string[] = [];
  const pushImage = (value: unknown) => {
    const raw =
      typeof value === "string"
        ? value
        : value && typeof value === "object"
          ? firstString((value as Record<string, unknown>).url, (value as Record<string, unknown>).contentUrl)
          : null;
    if (!raw) return;
    const abs = absoluteUrl(raw, sourceUrl);
    if (abs && !images.includes(abs)) images.push(abs);
  };
  const ldImages = productish?.image;
  if (Array.isArray(ldImages)) ldImages.forEach(pushImage);
  else pushImage(ldImages);
  pushImage(metaContent(html, "og:image", "twitter:image"));

  const operation = detectOperation(signal);
  if (!operation) notes.push("No pudimos deducir si es venta o alquiler — elegilo vos.");

  /**
   * Type comes from the headline and the URL slug first, and only falls back to
   * the body text. A spec list saying "Terreno: 400 m²" describes a *house's*
   * plot, so reading the whole page made every house with a garden a terreno.
   */
  const headline = `${sourceUrl} ${title ?? ""}`;
  const propertyType = detectPropertyType(headline) ?? detectPropertyType(signal);
  if (!propertyType) notes.push("No pudimos deducir el tipo de propiedad — elegilo vos.");

  const builtM2 =
    areaFrom(text, ["superficie construida", "construidos?", "sup\\.? construida"]) ??
    areaFrom(text);
  const plotM2 = areaFrom(text, ["parcela", "solar", "superficie total", "sup\\.? total"]);

  const locationText = firstString(
    (productish?.address as Record<string, unknown> | undefined)?.addressLocality,
    (productish?.address as Record<string, unknown> | undefined)?.streetAddress,
    metaContent(html, "og:locality", "geo.placename"),
  );

  const finalAmount = priceRaw ?? fallbackPrice;
  const finalIsEur = priceRaw != null ? structuredIsEur : looksLikeEur(text);
  const priceEur = finalAmount != null && finalIsEur ? finalAmount : null;
  if (finalAmount != null && priceEur == null) {
    notes.push("El precio no parece estar en euros — confirmalo a mano.");
  }

  return {
    sourceUrl,
    title,
    description,
    priceEur,
    operation,
    propertyType,
    bedrooms: countNear(text, ["dormitorios?", "sovrum", "habitaciones?", "hab\\.?", "bedrooms?"]),
    bathrooms: countNear(text, ["ba[ñn]os?", "bathrooms?"]),
    parking: countNear(text, ["plazas? de garaje", "parking", "garajes?"]),
    builtM2,
    plotM2,
    locationText,
    imageUrls: images.slice(0, 20),
    notes,
  };
}

/** Fetch + parse. Throws UnsafeUrlError for anything we refuse to fetch. */
export async function importListingFromUrl(rawUrl: string): Promise<ParsedListing> {
  const page = await fetchUserUrl(rawUrl);
  return parseListingHtml(page.html, page.url);
}
