/**
 * Seed `acquisition_costs` — the per-comunidad purchase-cost scale that
 * `src/lib/acquisition-cost.ts` turns into the estimate on every detail page.
 * Idempotent (upsert by `region`), safe to re-run by hand or from cron:
 *
 *   npm run seed:costs
 *
 * ⚠️ EVERY RATE BELOW IS A PLACEHOLDER. ⚠️
 *
 * These numbers print money figures next to real properties a real person is
 * deciding to buy. ITP in particular is set regionally, is revised with each
 * comunidad's budget, and several regions apply reduced rates by age, family
 * status or property value that a single percentage cannot express. Verifying
 * each figure against the comunidad's own published scale — and filling in
 * `source_url` so a reader can check us — is a research task, not a code task.
 * Until that is done, treat the totals as an order-of-magnitude answer to "is
 * it 3% or 13%?", which is still the question a Swedish buyer has never been
 * asked to consider.
 *
 * Notario / registro / gestoría+abogado are estimates by their nature: they
 * are scaled fees with minimums, so a percentage is an approximation at any
 * price and a bad one at the extremes.
 */
import { db } from "../src/db";
import { acquisitionCosts } from "../src/db/schema";

/** The seven comunidades where Swedish buyers actually buy (design §"Seeded regions"). */
const REGIONS = [
  { region: "AN", name: "Andalucía", itpPct: "7.00", ajdPct: "1.20" },
  { region: "VC", name: "Comunitat Valenciana", itpPct: "10.00", ajdPct: "1.50" },
  { region: "MC", name: "Región de Murcia", itpPct: "8.00", ajdPct: "1.50" },
  { region: "IB", name: "Illes Balears", itpPct: "8.00", ajdPct: "1.20" },
  { region: "CN", name: "Canarias", itpPct: "6.50", ajdPct: "0.75" },
  { region: "CT", name: "Catalunya", itpPct: "10.00", ajdPct: "1.50" },
  { region: "MD", name: "Comunidad de Madrid", itpPct: "6.00", ajdPct: "0.75" },
];

/** State-set, so identical everywhere; the fee estimates likewise. */
const COMMON = {
  ivaPct: "10.00",
  notaryPctEst: "0.50",
  registryPctEst: "0.40",
  legalPctEst: "1.20",
  // `date()` without `mode: "string"` maps to a Date — see schema.ts.
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  /**
   * The comunidad's own published scale, so a reader can check us. Empty until
   * the rates above stop being placeholders — a link next to a number nobody
   * verified would make the number look verified.
   */
  sourceUrl: null as string | null,
  active: true,
};

async function main() {
  for (const r of REGIONS) {
    const values = { ...r, ...COMMON, updatedAt: new Date() };
    await db
      .insert(acquisitionCosts)
      .values(values)
      .onDuplicateKeyUpdate({ set: values });
    console.log(`upserted ${r.region} (${r.name})`);
  }
  console.log(`seeded ${REGIONS.length} acquisition-cost regions (PLACEHOLDER rates)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
