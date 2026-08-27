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
  priceAmount: number | null;
  priceCurrency: "USD" | "PYG" | null;
  operation: Operation | null;
  propertyType: PropertyType | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  areaM2: number | null;
  landM2: number | null;
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

function detectCurrency(text: string): "USD" | "PYG" | null {
  if (/\b(usd|u\$s|us\$|dólares|dolares)\b/i.test(text)) return "USD";
  if (/\b(pyg|gs\.?|guaran[ií]es)\b/i.test(text)) return "PYG";
  if (/\$/.test(text)) return "USD"; // bare $ in this market means dollars
  return null;
}

/**
 * Currency marker within ~40 chars of where this exact amount is printed.
 * Scanning the whole page instead attached USD to a Gs price because "US$"
 * appeared *somewhere* — turning Gs 850.000.000 into price_usd 850,000,000
 * (audit F44). No nearby marker → null, and the form asks the agent.
 */
function currencyNearAmount(text: string, amount: number): "USD" | "PYG" | null {
  const re = /\d[\d.,]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const parsed = parseAmount(m[0]);
    if (parsed == null || Math.abs(parsed - amount) > 0.5) continue;
    const ctx = text.slice(
      Math.max(0, m.index - 40),
      m.index + m[0].length + 40,
    );
    const c = detectCurrency(ctx);
    if (c) return c;
  }
  return null;
}

/** es-PY vocabulary → our enums. Order matters: "alquiler temporal" first. */
function detectOperation(text: string): Operation | null {
  const t = text.toLowerCase();
  if (/alquiler\s+temporal|temporada|por\s+d[ií]a/.test(t)) return "alquiler_temporal";
  if (/\balquil|\barrend|\brenta\b|for\s+rent/.test(t)) return "alquiler";
  if (/\bventa\b|\bvende\b|en\s+venta|for\s+sale/.test(t)) return "venta";
  return null;
}

function detectPropertyType(text: string): PropertyType | null {
  const t = text.toLowerCase();
  // Most specific first — "casa quinta" is a quinta, not a casa.
  if (/\bquinta/.test(t)) return "quinta";
  if (/\bd[úu]plex/.test(t)) return "duplex";
  if (/\bdepto\b|\bdepartamento|\bapartamento|\bapart\b|\bpiso\b/.test(t)) return "departamento";
  if (/\bterreno|\blote\b|\blotes\b|\bfracci[óo]n/.test(t)) return "terreno";
  if (/\bdep[óo]sito|\bgalp[óo]n/.test(t)) return "deposito";
  if (/\boficina/.test(t)) return "oficina";
  if (/\blocal\b|\bcomercial|\bsal[óo]n\b/.test(t)) return "comercial";
  if (/\bcasa\b|\bvivienda\b|\bchalet\b/.test(t)) return "casa";
  return null;
}

/** "3 dormitorios", "3 dorm.", "3 hab" → 3 */
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

  const priceAmount = firstNumber(
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
  const priceCurrency: "USD" | "PYG" | null =
    currencyRaw && /usd|dollar/i.test(currencyRaw)
      ? "USD"
      : currencyRaw && /pyg|guaran/i.test(currencyRaw)
        ? "PYG"
        : null;

  // Price from visible text as a fallback: the first amount next to a currency
  // marker, which on a listing page is the headline price.
  let fallbackPrice: number | null = null;
  let fallbackCurrency: "USD" | "PYG" | null = null;
  if (priceAmount == null) {
    const m = text.match(
      /(?:US\$|U\$S|USD|Gs\.?|₲|\$)\s*([\d][\d.,]{2,})|([\d][\d.,]{5,})\s*(?:Gs\.?|guaran[ií]es|USD)/i,
    );
    if (m) {
      fallbackPrice = parseAmount(m[1] ?? m[2] ?? "");
      fallbackCurrency = detectCurrency(m[0]);
    }
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

  const areaM2 =
    areaFrom(text, ["superficie cubierta", "cubierta", "construidos?", "sup\\.? cub"]) ??
    areaFrom(text);
  const landM2 = areaFrom(text, ["terreno", "lote", "superficie total", "sup\\.? total"]);

  const locationText = firstString(
    (productish?.address as Record<string, unknown> | undefined)?.addressLocality,
    (productish?.address as Record<string, unknown> | undefined)?.streetAddress,
    metaContent(html, "og:locality", "geo.placename"),
  );

  const finalAmount = priceAmount ?? fallbackPrice;
  // Never from the page at large: only structured data, the marker the price
  // was matched against, or a marker printed next to the amount count (F44).
  const finalCurrency =
    priceCurrency ??
    fallbackCurrency ??
    (finalAmount != null ? currencyNearAmount(text, finalAmount) : null);
  if (finalAmount != null && finalCurrency == null) {
    notes.push("No pudimos determinar la moneda del precio — confirmala.");
  }

  return {
    sourceUrl,
    title,
    description,
    priceAmount: finalAmount,
    priceCurrency: finalCurrency,
    operation,
    propertyType,
    bedrooms: countNear(text, ["dormitorios?", "dorm\\.?", "habitaciones?", "hab\\.?", "cuartos?"]),
    bathrooms: countNear(text, ["ba[ñn]os?", "sanitarios?"]),
    parking: countNear(text, ["cocheras?", "garages?", "garajes?", "estacionamientos?"]),
    areaM2,
    landM2,
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
