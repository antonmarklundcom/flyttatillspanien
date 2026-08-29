/**
 * The two reference tables the money on a page is computed from: the EUR/SEK
 * rate (`fx_rates`) and the per-comunidad purchase taxes and fees
 * (`acquisition_costs`).
 *
 * They live here rather than in `queries.ts` because they are not listing
 * reads: both are tiny, slow-moving tables written by a cron or an operator
 * and read by every price on the site, and both have their own cache tag and
 * TTL (`src/lib/cache.ts`). Splitting them out is what lets the FX rate be
 * invalidated by an operator override without dropping the listing cache.
 *
 * **Neither value is ever stored on a listing.** There is no `price_sek` and
 * no cached acquisition-cost column — the design doc says never, not "later".
 * The rate is read here and applied at render by `formatSek()`; the costs are
 * read here and applied at render by `acquisitionCost()`. A snapshot on a row
 * goes stale invisibly, and a card confidently printing a superseded kronor
 * figure or an old ITP rate is a lie rather than a rounding error.
 *
 * **Dates do not survive the cache boundary.** `unstable_cache` serializes, so
 * a `Date` comes back as an ISO string; every exported wrapper below re-wraps
 * its own, rather than leaving each consumer to discover it. `observed_on` is
 * deliberately a `'YYYY-MM-DD'` string in the schema and stays one.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { acquisitionCosts, fxRates } from "@/db/schema";
import { CACHE_TAGS, CACHE_TTL } from "./cache";
import type { FxRate } from "./format";
import type { AcquisitionCostRates } from "./acquisition-cost";

/* ------------------------------------------------------------------ */
/* EUR/SEK                                                             */
/* ------------------------------------------------------------------ */

/** The stored row, before the decimals are parsed. */
type FxRow = typeof fxRates.$inferSelect;

const cachedFx = unstable_cache(
  async (): Promise<FxRow | null> => {
    const [row] = await db
      .select()
      .from(fxRates)
      .where(and(eq(fxRates.base, "EUR"), eq(fxRates.quote, "SEK")))
      .limit(1);
    return row ?? null;
  },
  ["reference:fx-eur-sek"],
  { revalidate: CACHE_TTL.fx, tags: [CACHE_TAGS.fx] },
);

/**
 * The newest EUR/SEK observation, or `null` when the table is empty — which is
 * every deployment until `npm run cron:fx` has run once.
 *
 * `null` is a first-class answer, not an error: `formatSek()` returns `null`
 * for it and the caller omits the kronor line entirely. The same happens when
 * the rate is merely *stale* (`isFxFresh()`), and for the same reason — a
 * missing SEK figure is a small disappointment, a confidently wrong one is a
 * complaint.
 */
export async function getFxRate(): Promise<FxRate | null> {
  const row = await cachedFx();
  if (!row) return null;
  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return { rate, observedOn: row.observedOn };
}

/** The rate plus its provenance — the /admin FX panel, not a public page. */
export interface FxRateDetail extends FxRate {
  source: FxRow["source"];
  fetchedAt: Date;
}

export async function getFxRateDetail(): Promise<FxRateDetail | null> {
  const row = await cachedFx();
  if (!row) return null;
  return {
    rate: Number(row.rate),
    observedOn: row.observedOn,
    source: row.source,
    // Re-wrapped: the cache handed this back as an ISO string.
    fetchedAt: new Date(row.fetchedAt),
  };
}

/**
 * The operator's manual override — the one in-process writer of `fx_rates`.
 *
 * Stamped `source: "manual"` so the panel can say where the number came from,
 * and so the next `cron:fx` run overwriting it with `ecb` is visible rather
 * than mysterious. The caller must follow this with `revalidateFx()`: the
 * whole point of an override is that it takes effect now rather than at the
 * end of the hour-long TTL.
 */
export async function setManualFxRate(params: {
  rate: number;
  /** 'YYYY-MM-DD'. Defaults to today — an override IS today's observation. */
  observedOn?: string;
}): Promise<boolean> {
  if (!Number.isFinite(params.rate) || params.rate <= 0) return false;
  const observedOn =
    params.observedOn ?? new Date().toISOString().slice(0, 10);

  await db
    .insert(fxRates)
    .values({
      base: "EUR",
      quote: "SEK",
      rate: params.rate.toFixed(6),
      observedOn,
      source: "manual",
      fetchedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        rate: params.rate.toFixed(6),
        observedOn,
        source: "manual",
        fetchedAt: new Date(),
      },
    });
  return true;
}

/* ------------------------------------------------------------------ */
/* Acquisition costs                                                   */
/* ------------------------------------------------------------------ */

function toRates(
  row: typeof acquisitionCosts.$inferSelect,
): AcquisitionCostRates {
  return {
    region: row.region,
    name: row.name,
    itpPct: Number(row.itpPct),
    ivaPct: Number(row.ivaPct),
    ajdPct: Number(row.ajdPct),
    notaryPctEst: Number(row.notaryPctEst),
    registryPctEst: Number(row.registryPctEst),
    legalPctEst: Number(row.legalPctEst),
    active: row.active,
  };
}

const cachedAcquisitionCosts = unstable_cache(
  async () => db.select().from(acquisitionCosts).orderBy(asc(acquisitionCosts.name)),
  ["reference:acquisition-costs"],
  {
    revalidate: CACHE_TTL.acquisitionCosts,
    tags: [CACHE_TAGS.acquisitionCosts],
  },
);

/**
 * Every comunidad's rates, keyed by its ISO-3166-2:ES code.
 *
 * The whole table, in one read, because it is seven rows: a per-listing lookup
 * would be a query per card for a table that changes with an annual budget.
 * `locations.acquisition_region` is materialised down the tree for exactly
 * this join, so a caller holding a listing's location chain already has the
 * key it needs.
 */
export async function getAcquisitionRates(): Promise<
  Map<string, AcquisitionCostRates>
> {
  const rows = await cachedAcquisitionCosts();
  return new Map(rows.map((r) => [r.region, toRates(r)]));
}

/**
 * One comunidad's rates, or `null` when the region is unknown or switched off.
 *
 * `null` is what makes the acquisition-cost block disappear rather than render
 * a zero — see `acquisitionCost()`. An inactive region is deliberately
 * indistinguishable from a missing one here: both mean "we have no estimate we
 * would stand behind for this place".
 */
export async function getAcquisitionRatesFor(
  region: string | null | undefined,
): Promise<AcquisitionCostRates | null> {
  if (!region) return null;
  const rates = (await getAcquisitionRates()).get(region);
  return rates && rates.active ? rates : null;
}

/** The rows as stored, including inactive ones — the /admin table view. */
export interface AcquisitionCostRow extends AcquisitionCostRates {
  effectiveFrom: string;
  /** NULL on every seeded row on purpose: an unverified number must not
   *  render a source link next to it, which would make it look verified. */
  sourceUrl: string | null;
  updatedAt: Date | null;
}

export async function listAcquisitionCosts(): Promise<AcquisitionCostRow[]> {
  const rows = await cachedAcquisitionCosts();
  return rows.map((r) => ({
    ...toRates(r),
    effectiveFrom: String(r.effectiveFrom),
    sourceUrl: r.sourceUrl,
    // Re-wrapped: the cache handed this back as an ISO string.
    updatedAt: r.updatedAt == null ? null : new Date(r.updatedAt),
  }));
}

/**
 * The operator's override for one comunidad. Only the fields an operator can
 * responsibly change — the region key and its name are seed data.
 *
 * Every seeded rate is a PLACEHOLDER (`scripts/seed-acquisition-costs.ts`), so
 * this is the path by which a researched number replaces a guess. Setting
 * `sourceUrl` alongside is the point: a figure with the comunidad's own
 * published scale behind it is checkable, and one without has to stay
 * unlinked. The caller must follow this with `revalidateAcquisitionCosts()`.
 *
 * Returns false when the region does not exist, so a caller can say so rather
 * than reporting a save that changed nothing.
 */
export async function updateAcquisitionCost(
  region: string,
  patch: Partial<{
    itpPct: number;
    ivaPct: number;
    ajdPct: number;
    notaryPctEst: number;
    registryPctEst: number;
    legalPctEst: number;
    sourceUrl: string | null;
    active: boolean;
  }>,
): Promise<boolean> {
  const pct = (v: number | undefined) =>
    v !== undefined && Number.isFinite(v) && v >= 0 ? v.toFixed(2) : undefined;

  const [res] = await db
    .update(acquisitionCosts)
    .set({
      itpPct: pct(patch.itpPct),
      ivaPct: pct(patch.ivaPct),
      ajdPct: pct(patch.ajdPct),
      notaryPctEst: pct(patch.notaryPctEst),
      registryPctEst: pct(patch.registryPctEst),
      legalPctEst: pct(patch.legalPctEst),
      ...(patch.sourceUrl !== undefined && { sourceUrl: patch.sourceUrl }),
      ...(patch.active !== undefined && { active: patch.active }),
      updatedAt: new Date(),
    })
    .where(eq(acquisitionCosts.region, region));
  return res.affectedRows > 0;
}
