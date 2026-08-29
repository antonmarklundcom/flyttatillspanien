/**
 * Normalization + hashing (ARCHITECTURE.md §2.4) — the heart of dedup.
 * Pure functions, no DB, so the "re-runs produce zero duplicates" guarantee
 * (M2 gate) is unit-testable in isolation.
 *
 * Two hashes, two jobs:
 *  - contentHash: did THIS source row change? → decides update vs unchanged.
 *  - dedupKey: is this the SAME property as one we already have (from any
 *    source)? → decides create vs attach-as-another-source. Deliberately
 *    fuzzy (bucketed price/area) so the same flat re-listed at a slightly
 *    different price still collapses to one listing.
 *
 * And one identifier that is neither: `normalizeCatastral()`. A referencia
 * catastral is government-issued and globally unique, so when a feed carries
 * one there is nothing to guess — the pipeline matches on it EXACTLY and never
 * consults `dedupKey()` at all. The fuzzy key is what the pipeline falls back
 * to when Spain's own identifier is absent, which it will be for most rows.
 */
import { createHash } from "node:crypto";
import type { RawListing } from "./types";

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

/** Normalize free text for hashing: lowercase, strip accents, collapse ws. */
export function canon(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Digits only — phone formatting (`+34 952 12 34 56`, `952123456`,
 * `070-123 45 67`) varies by who typed it.
 *
 * Two countries share this portal: Spanish agencies and Swedish relocation
 * intermediaries. Spain has no trunk prefix and nine national digits (mobiles
 * 6/7, landlines 8/9), so a leading `0` never belongs to a Spanish number and
 * stripping it is unambiguous — it is Sweden's trunk prefix and nothing else.
 *
 * A country code is only stripped when what follows is the right length for
 * that country. Under-matching is the safe direction here: two numbers that
 * fail to collapse produce two listings and a review-queue decision, while two
 * that collapse wrongly merge two properties and the data is gone. Swedish
 * landlines written in full international form (`+46 8 …`) are short enough to
 * be indistinguishable from a national number and are deliberately left alone.
 */
export function canonPhone(s: string | undefined | null): string {
  if (!s) return "";
  let d = s.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2); // 0034…, 0046…
  if (d.startsWith("34") && d.length === 11) {
    d = d.slice(2); // +34 + 9 national digits
  } else if (d.startsWith("46") && d.length >= 11 && d.length <= 12) {
    d = d.slice(2); // +46 + national number, which may itself carry the 0
  }
  if (d.startsWith("0")) d = d.slice(1); // Sweden's trunk prefix
  return d;
}

/**
 * Parse a printed amount. Spain writes `285.000 €` and `1.250.000,50 €` — '.'
 * as the thousands separator and ',' as the decimal, the opposite of the en-US
 * assumption, and getting it backwards would turn 285 000 euros into 285.
 * Sweden writes `3 250 000 kr`, which the non-digit strip below handles on its
 * way in. Shared by the link importer and the CSV adapter so both intakes read
 * money the same way (F3: they used to disagree, and the CSV side wrote €85
 * rows).
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const afterComma = lastComma === -1 ? -1 : cleaned.length - lastComma - 1;
  let normalized: string;

  if (lastComma > lastDot && afterComma === 3) {
    // '185,000' — a comma with exactly three digits after it and no dot in
    // sight is the en-US thousands separator, which the English-language
    // Spanish portals aimed at foreign buyers do use. Reading it as a decimal
    // turned 185 000 into 185.
    normalized = cleaned.replace(/,/g, "");
  } else if (lastComma > lastDot) {
    // '1.250.000,50' → decimal comma (the Spanish form)
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > -1 && cleaned.length - lastDot - 1 === 2 && lastComma === -1) {
    // '285000.50' → a genuine decimal point
    normalized = cleaned;
  } else {
    // '1.250.000' / '285.000' / '3 250 000' / '1,250,000' → separators only
    normalized = cleaned.replace(/[.,]/g, "");
  }

  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The stored EUR price, to two decimals. There is no conversion step any more:
 * Spain is EUR-only, so the amount a feed prints is the amount that is stored.
 * Cents are kept (not rounded to whole euros) because the sync report compares
 * the snapshotted price to the new one, and truncating cents made a ±€0.40
 * feed move invisible to it (F59).
 */
export function toPriceEur(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * The catastral reference, normalized, or NULL when the value is not a
 * well-formed one.
 *
 * A referencia catastral is exactly 20 alphanumeric characters. Feeds print it
 * with spaces or in lower case, so those are normalized away — but a value
 * that is not 20 characters after that is NOT a catastral reference, and
 * returning it anyway would hand the EXACT dedup path a key that is only
 * approximately an identity. A truncated or half-typed reference must fall
 * through to the fuzzy path, not become a strong claim that two properties are
 * the same one.
 */
export function normalizeCatastral(
  s: string | undefined | null,
): string | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return cleaned.length === 20 ? cleaned : null;
}

/** Coarse buckets absorb small listing-to-listing price/area differences. */
export function priceBucket(priceEur: number): number {
  return Math.round(priceEur / 5000) * 5000; // 5 000 € granularity
}
export function areaBucket(m2: number | undefined): number {
  if (!m2 || m2 <= 0) return 0;
  return Math.round(m2 / 10) * 10; // 10 m² granularity
}

/**
 * contentHash — change detection for a single source row. Any field that,
 * if edited at the source, should re-publish the listing goes in here.
 */
export function contentHash(raw: RawListing, priceEur: number): string {
  return sha1(
    [
      canon(raw.title),
      priceEur,
      raw.builtM2 ?? "",
      raw.usableM2 ?? "",
      raw.plotM2 ?? "",
      raw.bedrooms ?? "",
      raw.bathrooms ?? "",
      canon(raw.descriptionEs),
      raw.propertyState ?? "",
      // The legal block is content: a seller who obtains the energy
      // certificate, or an agency that corrects `legal_status` from
      // `desconocido` to `sin_lpo`, has changed what the advertisement says
      // about the property. Leaving these out would let the most consequential
      // corrections on the portal arrive as "unchanged".
      raw.referenciaCatastral ?? "",
      raw.energyRating ?? "",
      raw.legalStatus ?? "",
      raw.chargesStatus ?? "",
      raw.isVpo ? "vpo" : "",
      raw.landClassification ?? "",
      raw.touristLicence ?? "",
    ].join("|"),
  );
}

/**
 * dedupKey — cross-source identity of a property, or NULL when we do not have
 * enough identity to claim two rows are the same thing.
 *
 * Consulted ONLY when the row carries no `referencia_catastral`. When it does,
 * the pipeline has Spain's own globally-unique identifier for the physical
 * property and matches on that exactly — none of the guesswork below applies.
 *
 * Returns NULL when the contact phone is missing, and that is the whole point.
 * The key is bucketed on purpose (5 000 €, 10 m²) so a flat re-listed at a
 * slightly different price still collapses, and the phone is what stops those
 * coarse buckets from over-matching. Drop the phone and the key degenerates to
 * "price bucket + area bucket + location + operation + type" — which is a
 * perfect description of *every unit in the same building*. An agency
 * spreadsheet typically carries one phone for the whole agency or none at all,
 * so twenty 60 m² flats at €285k in one Marbella urbanisation hash
 * identically, and rows 2–20 were silently absorbed into row 1 as extra
 * `listing_sources` entries. The import reported success and 200 rows became
 * 40.
 *
 * A NULL key means "create it and let the review queue judge", which is the
 * recoverable failure. A false merge is not recoverable — the data is gone.
 *
 * `scopeAgencyId` keeps the fuzzy match inside one agency (0 = unscoped). Two
 * agencies co-broking the same property is a real thing, but resolving it by
 * silently folding agency B's listing into agency A's row would take listings
 * out of B's panel and misattribute B's leads. Cross-agency duplicates belong
 * in the review queue, not in a hash collision.
 */
export function dedupKey(
  raw: RawListing,
  priceEur: number,
  locationId: number,
  scopeAgencyId: number = 0,
): string | null {
  const phone = canonPhone(raw.contactPhone);
  if (!phone) return null;

  // `built_m2` is the comparable figure (design doc §3.1); `plot_m2` only
  // stands in for the types that have no building on them.
  const area = raw.builtM2 ?? raw.plotM2;
  return sha1(
    [
      scopeAgencyId,
      phone,
      priceBucket(priceEur),
      areaBucket(area),
      locationId,
      raw.operation,
      raw.propertyType,
    ].join("|"),
  );
}

const PUBLIC_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** 10-char URL id for /bostad/{slug}-{public_id}. Collisions are ~nil. */
export function makePublicId(): string {
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += PUBLIC_ID_ALPHABET[Math.floor(Math.random() * PUBLIC_ID_ALPHABET.length)];
  }
  return out;
}
