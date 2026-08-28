/**
 * What a Spanish purchase actually costs on top of the asking price.
 *
 * This is the deterministic money figure on the card that no competitor
 * prints, and it is the slot the Paraguayan cuota engine vacates. A Swede who
 * has only ever bought a bostadsrätt — where the acquisition tax is
 * essentially nil — does not know the category exists, and then meets 10–14%
 * of the purchase price at the notary.
 *
 * Two structural rules, both inherited on purpose:
 *
 *  - **`null` means the UI omits the block entirely** — never a zero, never a
 *    "contact us". A region with no active `acquisition_costs` row has no
 *    honest estimate to give, so it gives none.
 *  - **Computed at render, never cached on a listing column.** The Paraguayan
 *    `cuota_gs` column existed because computing it needed a query per card;
 *    this is a pure function of `price_eur` over a seven-row table that is
 *    cached for a day, so there is no per-listing query to avoid. A cached
 *    column would import the whole class of "the cron did not run and the card
 *    is quoting a superseded ITP rate" bugs for no gain.
 *
 * Pure on purpose: no `next/*`, no drizzle. The caller holds the region row.
 */

/** One `acquisition_costs` row, decimals already parsed to numbers. */
export interface AcquisitionCostRates {
  region: string;
  name: string;
  /** Resale transfer tax (Impuesto de Transmisiones Patrimoniales), regional. */
  itpPct: number;
  /** New build only, state-set. */
  ivaPct: number;
  /** Stamp duty (Actos Jurídicos Documentados), new build only, regional. */
  ajdPct: number;
  notaryPctEst: number;
  registryPctEst: number;
  legalPctEst: number;
  active: boolean;
}

export interface AcquisitionCostLine {
  /** Stable key the dictionary translates — never a rendered label. */
  key: "itp" | "iva" | "ajd" | "notary" | "registry" | "legal";
  pct: number;
  amountEur: number;
}

export interface AcquisitionCostEstimate {
  region: string;
  regionName: string;
  /** Which tax set applied — a new build is IVA + AJD, a resale is ITP. */
  basis: "obra_nueva" | "segunda_mano";
  lines: AcquisitionCostLine[];
  /** Sum of the lines, excluding the property price itself. */
  totalEur: number;
  totalPct: number;
  /** Price + costs — the number the buyer actually has to fund. */
  grandTotalEur: number;
}

function line(
  key: AcquisitionCostLine["key"],
  pct: number,
  priceEur: number,
): AcquisitionCostLine | null {
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return { key, pct, amountEur: (priceEur * pct) / 100 };
}

/**
 * Itemised acquisition cost for one listing, or `null` when there is nothing
 * honest to say — no region row, the region switched off by an operator, or a
 * price that is not a usable number.
 *
 * `isNewBuild` decides the tax basis, not the property's age: a first
 * transmission from the developer is IVA + AJD, everything else is ITP. The
 * caller derives it from `property_state` (`obra_nueva` / `sobre_plano` /
 * `en_construccion`), which is the column that records that distinction.
 */
export function acquisitionCost(
  priceEur: number | string,
  rates: AcquisitionCostRates | null,
  isNewBuild: boolean,
): AcquisitionCostEstimate | null {
  if (!rates || !rates.active) return null;
  const price = Number(priceEur);
  if (!Number.isFinite(price) || price <= 0) return null;

  const lines = (
    isNewBuild
      ? [
          line("iva", rates.ivaPct, price),
          line("ajd", rates.ajdPct, price),
        ]
      : [line("itp", rates.itpPct, price)]
  )
    .concat([
      line("notary", rates.notaryPctEst, price),
      line("registry", rates.registryPctEst, price),
      line("legal", rates.legalPctEst, price),
    ])
    .filter((l): l is AcquisitionCostLine => l !== null);

  if (lines.length === 0) return null;

  const totalEur = lines.reduce((sum, l) => sum + l.amountEur, 0);
  return {
    region: rates.region,
    regionName: rates.name,
    basis: isNewBuild ? "obra_nueva" : "segunda_mano",
    lines,
    totalEur,
    totalPct: (totalEur / price) * 100,
    grandTotalEur: price + totalEur,
  };
}
