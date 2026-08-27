/**
 * Total acquisition cost estimate — occupies the slot the Paraguayan cuota
 * engine's `bestCuota()` vacated (docs/SPAIN-PORTAL-DESIGN.md §4).
 *
 * Pure function of `(priceEur, acquisition_costs[region] row, isNewBuild)`.
 * **Computed at render, never cached on a listing column** — unlike
 * `cuota_gs`, this needs no per-listing query to avoid: the reference table
 * is seven rows, cached for a day (`CACHE_TTL.acquisitionCosts`), so there is
 * nothing expensive here to memoize per row. A cached column would only
 * import "the cron didn't run and the card is quoting a superseded ITP rate"
 * bugs for no gain.
 *
 * Returns `null` when the region has no active row — same discipline as
 * `bestCuota()` returning `null`: the UI omits the line entirely, never a
 * zero and never an invented number.
 */

export interface AcquisitionCostRow {
  region: string;
  name: string;
  itpPct: string | number;
  ivaPct: string | number;
  ajdPct: string | number;
  notaryPctEst: string | number;
  registryPctEst: string | number;
  legalPctEst: string | number;
  active: boolean;
}

export interface AcquisitionCostBreakdown {
  region: string;
  regionName: string;
  isNewBuild: boolean;
  /** ITP (resale) or IVA+AJD (new build) — the transfer-tax line. */
  transferTaxLabel: "itp" | "iva_ajd";
  transferTaxEur: number;
  notaryEur: number;
  registryEur: number;
  legalEur: number;
  totalEur: number;
  totalPct: number;
}

export function estimateAcquisitionCost(
  priceEur: number,
  row: AcquisitionCostRow | null | undefined,
  isNewBuild: boolean,
): AcquisitionCostBreakdown | null {
  if (!row || !row.active || priceEur <= 0) return null;

  const pct = (v: string | number) => Number(v);

  const transferPct = isNewBuild ? pct(row.ivaPct) + pct(row.ajdPct) : pct(row.itpPct);
  const notaryPct = pct(row.notaryPctEst);
  const registryPct = pct(row.registryPctEst);
  const legalPct = pct(row.legalPctEst);

  const transferTaxEur = round2((priceEur * transferPct) / 100);
  const notaryEur = round2((priceEur * notaryPct) / 100);
  const registryEur = round2((priceEur * registryPct) / 100);
  const legalEur = round2((priceEur * legalPct) / 100);
  const totalEur = round2(transferTaxEur + notaryEur + registryEur + legalEur);
  const totalPct = round2(transferPct + notaryPct + registryPct + legalPct);

  return {
    region: row.region,
    regionName: row.name,
    isNewBuild,
    transferTaxLabel: isNewBuild ? "iva_ajd" : "itp",
    transferTaxEur,
    notaryEur,
    registryEur,
    legalEur,
    totalEur,
    totalPct,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
