/**
 * Seed acquisition_costs with the seven comunidades in the Spain portal
 * handoff (docs/SPAIN-PORTAL-DESIGN.md §3.5 / "Seeded regions"). Idempotent
 * (upsert by region) — safe to re-run from cron or by hand:
 *   npx tsx scripts/seed-acquisition-costs.ts
 *
 * RATES ARE PLACEHOLDERS — verify against each comunidad's published ITP/AJD
 * scale before launch and whenever a comunidad's budget changes; every card
 * showing a total acquisition cost (src/lib/acquisition-cost.ts) reads this
 * table. Verifying them is a research task, not a code task — same warning,
 * same place, as the old seed-financing.ts carried for the AFD rate.
 */
import { db } from "../src/db";
import { acquisitionCosts } from "../src/db/schema";

const TODAY = new Date().toISOString().slice(0, 10);

const REGIONS = [
  {
    region: "AN",
    name: "Andalucía",
    itpPct: "7.00",
    ivaPct: "10.00",
    ajdPct: "1.20",
    notaryPctEst: "0.50",
    registryPctEst: "0.25",
    legalPctEst: "1.00",
  },
  {
    region: "VC",
    name: "Comunitat Valenciana",
    itpPct: "10.00",
    ivaPct: "10.00",
    ajdPct: "1.50",
    notaryPctEst: "0.50",
    registryPctEst: "0.25",
    legalPctEst: "1.00",
  },
  {
    region: "MC",
    name: "Región de Murcia",
    itpPct: "8.00",
    ivaPct: "10.00",
    ajdPct: "1.50",
    notaryPctEst: "0.50",
    registryPctEst: "0.25",
    legalPctEst: "1.00",
  },
  {
    region: "IB",
    name: "Illes Balears",
    itpPct: "8.00",
    ivaPct: "10.00",
    ajdPct: "1.20",
    notaryPctEst: "0.50",
    registryPctEst: "0.25",
    legalPctEst: "1.00",
  },
  {
    region: "CN",
    name: "Canarias",
    itpPct: "6.50",
    ivaPct: "7.00", // IGIC, not mainland IVA — placeholder pending verification
    ajdPct: "1.00",
    notaryPctEst: "0.50",
    registryPctEst: "0.25",
    legalPctEst: "1.00",
  },
  {
    region: "CT",
    name: "Catalunya",
    itpPct: "10.00",
    ivaPct: "10.00",
    ajdPct: "1.50",
    notaryPctEst: "0.50",
    registryPctEst: "0.25",
    legalPctEst: "1.00",
  },
  {
    region: "MD",
    name: "Comunidad de Madrid",
    itpPct: "6.00",
    ivaPct: "10.00",
    ajdPct: "0.75",
    notaryPctEst: "0.50",
    registryPctEst: "0.25",
    legalPctEst: "1.00",
  },
] as const;

async function main() {
  for (const r of REGIONS) {
    await db
      .insert(acquisitionCosts)
      .values({ ...r, effectiveFrom: TODAY, active: true, updatedAt: new Date() })
      .onDuplicateKeyUpdate({
        set: {
          name: r.name,
          itpPct: r.itpPct,
          ivaPct: r.ivaPct,
          ajdPct: r.ajdPct,
          notaryPctEst: r.notaryPctEst,
          registryPctEst: r.registryPctEst,
          legalPctEst: r.legalPctEst,
          effectiveFrom: TODAY,
          active: true,
          updatedAt: new Date(),
        },
      });
    console.log(`  upserted ${r.region} (${r.name})`);
  }
  console.log(`\n${REGIONS.length} comunidades seeded. Rates are PLACEHOLDERS — verify before launch.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
