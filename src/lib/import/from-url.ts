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
  /**
   * EUR, and only ever EUR. A page printing £ or $ (the English-language
   * Spanish portals do) leaves this null with a note rather than converting:
   * a wrong price silently imported is far worse than a blank one, and the
   * portal has no business inventing an exchange rate on a scrape.
   */
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
 * Which currency a fragment is printed in, when it says so at all.
 *
 * `other` matters as much as `eur`: an English-language Spanish portal quoting
 * £395,000 must not have that number read as euros. A fragment with no marker
 * is `null` and the form asks the agent.
 */
type DetectedCurrency = "eur" | "other";

function detectCurrency(text: string): DetectedCurrency | null {
  if (/€|\b(eur|euros?)\b/i.test(text)) return "eur";
  if (/[£$]|\b(gbp|usd|sek|kr|libras|pounds|dollars?)\b/i.test(text))
    return "other";
  return null;
}

/**
 * Currency marker within ~40 chars of where this exact amount is printed.
 * Scanning the whole page instead attached one currency to another's price
 * because its symbol appeared *somewhere* on the page (audit F44). No nearby
 * marker → null, and the form asks the agent.
 */
function currencyNearAmount(
  text: string,
  amount: number,
): DetectedCurrency | null {
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

/** es-ES vocabulary → our enums. Order matters: the holiday let comes first. */
function detectOperation(text: string): Operation | null {
  const t = text.toLowerCase();
  if (
    /alquiler\s+(?:vacacional|tur[ií]stico|de\s+temporada)|temporada|por\s+d[ií]as?|holiday\s+rental|short\s+term/.test(
      t,
    )
  )
    return "alquiler_vacacional";
  if (/\balquil|\barrend|\brenta\b|for\s+rent|to\s+let/.test(t))
    return "alquiler";
  if (/\bventa\b|\bvende\b|en\s+venta|for\s+sale/.test(t)) return "venta";
  return null;
}

function detectPropertyType(text: string): PropertyType | null {
  const t = text.toLowerCase();
  // Most specific first — an "ático dúplex" is an ático, and a "casa adosada"
  // is an adosado rather than the villa "casa" alone would suggest.
  if (/\b[áa]tico|\bpenthouse\b/.test(t)) return "atico";
  if (/\badosad|\bparead|\btown\s?house\b/.test(t)) return "adosado";
  if (/\bd[úu]plex/.test(t)) return "duplex";
  if (/\bfinca\b|\bcortijo\b|\bmas[ií]a\b|\bc[áa]rmen\b/.test(t))
    return "finca";
  if (/\bterreno|\bparcela|\bsolar\b|\bplot\b|\bland\b/.test(t))
    return "terreno";
  if (/\blocal\b|\bcomercial|\boficina|\bnave\b/.test(t)) return "local";
  if (/\bpiso\b|\bapartamento|\bapart\b|\bestudio\b|\bflat\b|\bapartment\b/.test(t))
    return "apartamento";
  if (/\bvilla\b|\bchalet\b|\bcasa\b|\bvivienda\b|\bhouse\b/.test(t))
    return "villa";
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
  const priceCurrency: DetectedCurrency | null = currencyRaw
    ? /eur/i.test(currencyRaw)
      ? "eur"
      : "other"
    : null;

  // Price from visible text as a fallback: the first amount next to a currency
  // marker, which on a listing page is the headline price.
  let fallbackPrice: number | null = null;
  let fallbackCurrency: DetectedCurrency | null = null;
  if (priceAmount == null) {
    const m = text.match(
      /(?:€|EUR|£|\$)\s*([\d][\d.,]{2,})|([\d][\d.,]{4,})\s*(?:€|EUR|euros?)/i,
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

  // `built_m2` is the comparable figure, so "superficie construida" is what is
  // hunted first; `útil` is deliberately NOT accepted as a fallback for it,
  // because the two differ by 10–15% and filing one as the other understates
  // every property it happens to.
  const builtM2 =
    areaFrom(text, [
      "superficie construida",
      "construidos?",
      "constru[ií]da",
      "sup\\.? const",
      "built",
    ]) ?? areaFrom(text);
  const plotM2 = areaFrom(text, [
    "parcela",
    "terreno",
    "solar",
    "superficie de parcela",
    "plot",
  ]);

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

  /**
   * A price is kept only when the page said euros. An unmarked amount could be
   * anything, and a marked non-euro one is a real number in the wrong
   * currency — converting it here would invent a rate, and storing it as EUR
   * would be a straightforwardly wrong price on a €400 000 purchase. Both go
   * to the agent as a blank field and a note.
   */
  const priceEur = finalCurrency === "eur" ? finalAmount : null;
  if (finalAmount != null && finalCurrency == null) {
    notes.push("No pudimos determinar la moneda del precio — confirmalo.");
  } else if (finalCurrency === "other") {
    notes.push(
      "El precio de la página no está en euros — cargalo en euros a mano.",
    );
  }

  return {
    sourceUrl,
    title,
    description,
    priceEur,
    operation,
    propertyType,
    bedrooms: countNear(text, ["dormitorios?", "dorm\\.?", "habitaciones?", "hab\\.?", "bedrooms?"]),
    bathrooms: countNear(text, ["ba[ñn]os?", "aseos?", "bathrooms?"]),
    parking: countNear(text, ["plazas? de garaje", "garajes?", "garages?", "parking"]),
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
