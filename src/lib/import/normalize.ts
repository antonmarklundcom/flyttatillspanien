/**
 * Normalization + hashing — the heart of dedup.
 * Pure functions, no DB, so the "re-runs produce zero duplicates" guarantee
 * is unit-testable in isolation.
 *
 * Two hashes, two jobs:
 *  - contentHash: did THIS source row change? → decides update vs unchanged.
 *  - dedupKey: is this the SAME property as one we already have (from any
 *    source)? → decides create vs attach-as-another-source. Deliberately
 *    fuzzy (bucketed price/area) so the same flat re-listed at a slightly
 *    different price still collapses to one listing.
 *
 * Spain adds a third, stronger option: `referenciaCatastral` (§3.2 of
 * docs/SPAIN-PORTAL-DESIGN.md). When it is present on a raw listing, the
 * importer dedups on it exactly (see src/lib/import/upsert.ts) and this
 * module's fuzzy `dedupKey()` is skipped entirely — it stays here unchanged
 * for the (common) case where a feed carries no cadastral reference.
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

/** Digits only — phone formatting (+34 611 22 33 44 vs 611223344) varies. */
export function canonPhone(s: string | undefined | null): string {
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  // Normalize Spanish forms: strip country code 34 and a leading 0 so
  // 0611223344, 34611223344 and 611223344 all collapse to the same key.
  let d = digits;
  if (d.startsWith("34") && d.length > 9) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * Parse a printed EUR amount. Spanish feeds write `285.000 €` and
 * `1.250.000,50 €` — '.' as the thousands separator, ',' as the decimal —
 * the opposite of the en-US assumption, and getting it backwards would turn
 * 285 000 euros into 285.
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
    // sight is the en-US thousands separator, which bilingual feeds do use.
    // Reading it as a decimal turned 185 000 into 185.
    normalized = cleaned.replace(/,/g, "");
  } else if (lastComma > lastDot) {
    // '1.250.000,50' → decimal comma
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > -1 && cleaned.length - lastDot - 1 === 2 && lastComma === -1) {
    // '285000.50' → a genuine decimal point
    normalized = cleaned;
  } else {
    // '1.250.000' / '285.000' / '1,250,000' → separators only
    normalized = cleaned.replace(/[.,]/g, "");
  }

  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Coarse buckets absorb small listing-to-listing price/area differences. */
export function priceBucket(priceEur: number): number {
  return Math.round(priceEur / 5000) * 5000; // 5k EUR granularity
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
      raw.plotM2 ?? "",
      raw.bedrooms ?? "",
      raw.bathrooms ?? "",
      canon(raw.descriptionEs),
      raw.propertyState ?? "",
    ].join("|"),
  );
}

/**
 * dedupKey — cross-source identity of a property, or NULL when we do not have
 * enough identity to claim two rows are the same thing.
 *
 * Returns NULL when the contact phone is missing, and that is the whole point.
 * The key is bucketed on purpose (5k EUR, 10 m²) so a flat re-listed at a
 * slightly different price still collapses, and the phone is what stops those
 * coarse buckets from over-matching. Drop the phone and the key degenerates to
 * "price bucket + area bucket + location + operation + type" — which is a
 * perfect description of *every unit in the same building*. An agency
 * spreadsheet typically carries one phone for the whole agency or none at all,
 * so twenty 60 m² flats at €285k in the same urbanización hashed identically,
 * and rows 2–20 were silently absorbed into row 1 as extra `listing_sources`
 * entries. The import reported success and 200 rows became 40.
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
