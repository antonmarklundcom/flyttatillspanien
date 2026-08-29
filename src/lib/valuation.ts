/**
 * Valuation estimate (ARCHITECTURE.md M7 — the seller-side lead magnet).
 *
 * Answers "¿cuánto vale mi casa?" from the medians the nightly job already
 * computes, and it is the only thing on the site that puts a number on a
 * property nobody has seen. So the rules here are about restraint:
 *
 *  1. **A range, never a single number.** A point estimate from a median price
 *     per m² would be false precision, and an owner who anchors on it and then
 *     lists 20% high sits unsold for months.
 *  2. **The band widens as the data thins.** With 60 comparable listings the
 *     range is tight; with 9 it is wide, because that is the truth.
 *  3. **Below MIN_RELIABLE_SAMPLE we refuse.** No estimate at all beats an
 *     estimate we would not defend — the form says so and offers a human.
 *  4. It is an asking-price estimate from *published* listings, not a closing
 *     price and not an official appraisal. The copy says that too.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { marketMedians } from "@/db/schema";
import { citySubtreeIds, resolveCity } from "@/lib/queries";
import { MIN_RELIABLE_SAMPLE } from "@/lib/precios-queries";
import type { Operation, PropertyType } from "@/lib/import/types";

export interface ValuationRequest {
  citySlug: string;
  propertyType: PropertyType;
  operation: Operation;
  /** Built area for structures, lot area for terreno. */
  areaM2: number;
}

export type ValuationResult =
  | {
      ok: true;
      /** Mid-point, only ever shown alongside the range. */
      midUsd: number;
      lowEur: number;
      highEur: number;
      pricePerM2Eur: number;
      sampleSize: number;
      period: string;
      cityName: string;
      /** How wide the band is, as a percentage — surfaced in the copy. */
      bandPct: number;
    }
  | {
      ok: false;
      reason: "unknown_city" | "no_data" | "thin_data" | "bad_area";
      cityName?: string;
      sampleSize?: number;
    };

/** Areas outside this are a typo, not a property. */
const MIN_AREA = 10;
const MAX_AREA = 100_000;

/**
 * Half-width of the range, by sample size. Not a statistical confidence
 * interval — we store medians, not distributions, so pretending to compute one
 * would be dressing up a guess. It is an explicit editorial choice: the more
 * comparables, the tighter we are willing to be.
 */
function bandFor(sampleSize: number): number {
  if (sampleSize >= 60) return 0.12;
  if (sampleSize >= 30) return 0.15;
  if (sampleSize >= 15) return 0.2;
  return 0.25;
}

async function estimateValueUncached(
  req: ValuationRequest,
): Promise<ValuationResult> {
  if (
    !Number.isFinite(req.areaM2) ||
    req.areaM2 < MIN_AREA ||
    req.areaM2 > MAX_AREA
  ) {
    return { ok: false, reason: "bad_area" };
  }

  const city = await resolveCity(req.citySlug);
  if (!city) return { ok: false, reason: "unknown_city" };

  const [latest] = await db
    .select({ period: marketMedians.period })
    .from(marketMedians)
    .orderBy(desc(marketMedians.period))
    .limit(1);
  if (!latest) return { ok: false, reason: "no_data", cityName: city.name };

  const ids = await citySubtreeIds(city.id);
  const rows = await db
    .select({
      medianPriceM2Eur: marketMedians.medianPriceM2Eur,
      sampleSize: marketMedians.sampleSize,
      sampleSizeM2: marketMedians.sampleSizeM2,
    })
    .from(marketMedians)
    .where(
      and(
        eq(marketMedians.period, latest.period),
        inArray(marketMedians.locationId, ids),
        eq(marketMedians.propertyType, req.propertyType),
        eq(marketMedians.operation, req.operation),
      ),
    );

  // Sample-weighted, same as the price pages: a barrio with 40 comparables
  // should count for more than one with two. The whole estimate is derived
  // from price-per-m², so the sample that gates it and sizes the band is the
  // m² sample — counting area-less listings claimed 40 comparables behind a
  // number computed from 2 (audit F16). Rows written before sample_size_m2
  // existed carry 0 there; fall back to the old (inflated) count until the
  // medians cron re-runs, rather than refusing every estimate.
  let weighted = 0;
  let weight = 0;
  let sample = 0;
  for (const r of rows) {
    if (r.medianPriceM2Eur == null) continue;
    const n = r.sampleSizeM2 > 0 ? r.sampleSizeM2 : r.sampleSize;
    sample += n;
    weighted += Number(r.medianPriceM2Eur) * n;
    weight += n;
  }

  if (weight === 0) {
    return { ok: false, reason: "no_data", cityName: city.name };
  }
  if (sample < MIN_RELIABLE_SAMPLE) {
    return {
      ok: false,
      reason: "thin_data",
      cityName: city.name,
      sampleSize: sample,
    };
  }

  const pricePerM2 = weighted / weight;
  const mid = pricePerM2 * req.areaM2;
  const band = bandFor(sample);

  /** Round to something a person would say out loud, not to the cent. */
  const round = (n: number) => {
    const step = n >= 200_000 ? 5_000 : n >= 50_000 ? 1_000 : 500;
    return Math.round(n / step) * step;
  };

  return {
    ok: true,
    midUsd: round(mid),
    lowEur: round(mid * (1 - band)),
    highEur: round(mid * (1 + band)),
    pricePerM2Eur: Math.round(pricePerM2),
    sampleSize: sample,
    period: latest.period,
    cityName: city.name,
    bandPct: Math.round(band * 100),
  };
}

/**
 * Cached for an hour, keyed by the request shape. The inputs are a short list
 * of cities × types × operations × a rounded area, so the cache actually hits;
 * the underlying medians only change when the nightly job runs.
 */
export const estimateValue = unstable_cache(
  estimateValueUncached,
  ["valuation-estimate"],
  { revalidate: 3600, tags: [CACHE_TAGS.marketMedians] },
);
