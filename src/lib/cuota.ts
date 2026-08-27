/**
 * Cuota engine (ARCHITECTURE.md §2.6) — the card differentiator.
 *
 * Standard French amortization against the best active financing program the
 * listing qualifies for. Result is CACHED on listings.cuota_gs by the nightly
 * cron so rendering "Gs 2.1M/mes con Che Róga Porã" costs zero query time.
 */

export interface FinancingProgram {
  code: string;
  name: string;
  annualRate: number; // e.g. 6.5 (percent)
  maxTermMonths: number;
  maxAmountGs: number | null;
  minDownPct: number; // e.g. 10 (percent)
  active: boolean;
}

export interface CuotaResult {
  programCode: string;
  programName: string;
  monthlyGs: number;
  termMonths: number;
  financedGs: number;
  downPaymentGs: number;
}

/** French amortization: P·r / (1 − (1+r)^−n), r = monthly rate. */
export function frenchAmortization(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/**
 * Best cuota for a sale price in Gs across the active programs.
 * "Best" = lowest monthly payment among programs the listing qualifies for
 * (financed amount within the program cap after minimum down payment).
 * Returns null when no program fits — the card simply omits the cuota line.
 */
export function bestCuota(
  priceGs: number,
  programs: FinancingProgram[],
  termMonths?: number,
): CuotaResult | null {
  let best: CuotaResult | null = null;

  for (const p of programs) {
    if (!p.active) continue;
    const down = priceGs * (p.minDownPct / 100);
    const financed = priceGs - down;
    if (p.maxAmountGs !== null && financed > p.maxAmountGs) continue;

    const n = Math.min(termMonths ?? p.maxTermMonths, p.maxTermMonths);
    const monthly = frenchAmortization(financed, p.annualRate, n);
    if (monthly <= 0) continue;

    if (!best || monthly < best.monthlyGs) {
      best = {
        programCode: p.code,
        programName: p.name,
        monthlyGs: Math.round(monthly),
        termMonths: n,
        financedGs: Math.round(financed),
        downPaymentGs: Math.round(down),
      };
    }
  }
  return best;
}
