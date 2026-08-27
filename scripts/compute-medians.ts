/**
 * Market medians job (ARCHITECTURE.md §2.6, §4) — powers the "precio mediano
 * en {barrio}" context module and the /precios pages. Computes the median
 * price and price/m² per (location × property_type × operation) for the
 * current month from published listings.
 *
 * Median is computed in JS (trivial at 14.5k-row scale, keeps the SQL
 * portable — no MySQL-specific window/percentile functions). The context
 * module only renders a group when sample_size >= 8, but we store every
 * non-empty group so /precios can show sparser cells with a caveat.
 *
 *   npx tsx scripts/compute-medians.ts
 *
 * Wire as a Hostinger cron (daily/weekly) once M0 deploy is live.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { listings, marketMedians } from "../src/db/schema";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface Bucket {
  locationId: number;
  propertyType: string;
  operation: string;
  prices: number[];
  pricesM2: number[];
}

async function main() {
  const period = currentPeriod();

  const rows = await db
    .select({
      locationId: listings.locationId,
      propertyType: listings.propertyType,
      operation: listings.operation,
      priceUsd: listings.priceUsd,
      areaM2: listings.areaM2,
      landM2: listings.landM2,
    })
    .from(listings)
    .where(eq(listings.status, "published"));

  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    const key = `${r.locationId}|${r.propertyType}|${r.operation}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        locationId: r.locationId,
        propertyType: r.propertyType,
        operation: r.operation,
        prices: [],
        pricesM2: [],
      };
      buckets.set(key, b);
    }
    const price = Number(r.priceUsd);
    b.prices.push(price);
    // Built area for structures, lot area for terreno; skip when area unknown.
    const area = r.areaM2 != null ? Number(r.areaM2) : Number(r.landM2 ?? 0);
    if (area > 0) b.pricesM2.push(price / area);
  }

  let written = 0;
  for (const b of buckets.values()) {
    const medianPriceUsd = median(b.prices);
    const medianPriceM2Usd = median(b.pricesM2);
    const values = {
      period,
      locationId: b.locationId,
      propertyType: b.propertyType,
      operation: b.operation,
      medianPriceUsd: medianPriceUsd != null ? medianPriceUsd.toFixed(2) : null,
      medianPriceM2Usd:
        medianPriceM2Usd != null ? medianPriceM2Usd.toFixed(2) : null,
      sampleSize: b.prices.length,
      // The m² median's own sample — only listings that had an area. Reusing
      // the price count claimed 40 data points behind a number from 2 (F16).
      sampleSizeM2: b.pricesM2.length,
      source: "own" as const,
    };
    await db
      .insert(marketMedians)
      .values(values)
      .onDuplicateKeyUpdate({
        set: {
          medianPriceUsd: values.medianPriceUsd,
          medianPriceM2Usd: values.medianPriceM2Usd,
          sampleSize: values.sampleSize,
          sampleSizeM2: values.sampleSizeM2,
          source: values.source,
        },
      });
    written++;
  }

  console.log(`wrote ${written} median rows for ${period}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
