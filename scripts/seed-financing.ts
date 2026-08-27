/**
 * Seed financing_programs with current Che Róga Porã / AFD terms.
 * Idempotent (upsert by code) — safe to re-run from cron or by hand:
 *   npx tsx scripts/seed-financing.ts
 *
 * RATES ARE PLACEHOLDERS — verify against AFD/MUVH published terms before
 * launch and whenever they change; the nightly cuota cron reads this table.
 *
 * Che Róga Porã ships `active: false` (see below). Applying that to a live
 * database is two commands, in this order — the seed flips the flag, the cron
 * clears every cuota that was quoting it:
 *
 *   npm run seed:financing && npm run cron:cuotas
 *
 * Skipping the second one leaves stale cuota_gs values cached on listings,
 * which is worse than either state on its own: the card keeps printing a
 * Che Róga Porã monthly payment that nothing can reproduce.
 */
import { db } from "../src/db";
import { financingPrograms } from "../src/db/schema";

const PROGRAMS = [
  {
    code: "che_roga_pora",
    name: "Che Róga Porã",
    annualRate: "6.50",
    maxTermMonths: 360,
    maxAmountGs: "900000000",
    minDownPct: "0.00",
    /**
     * OFF BY DEFAULT (founder decision, 2026-08-16). Che Róga Porã is approved
     * per development, not per portal: quoting it on every venta listing
     * implies an eligibility the seller has not established. With this false,
     * `bestCuota()` skips it entirely and listings quote AFD or no cuota at
     * all — see src/lib/cuota.ts.
     *
     * The rate below stays because it is the programme's real term, not
     * because it is in use; it is still a PLACEHOLDER pending verification
     * against MUVH/AFD published terms (CLAUDE.md backlog 6). Re-enabling it
     * site-wide by flipping this to true is NOT the intended path — the
     * intended path is per-project opt-in.
     */
    active: false,
  },
  {
    code: "afd_primera_vivienda",
    name: "AFD Mi Primera Vivienda",
    annualRate: "9.00",
    maxTermMonths: 300,
    maxAmountGs: "700000000",
    minDownPct: "10.00",
    active: true,
  },
];

async function main() {
  for (const p of PROGRAMS) {
    await db
      .insert(financingPrograms)
      .values({ ...p, updatedAt: new Date() })
      .onDuplicateKeyUpdate({
        set: { ...p, updatedAt: new Date() },
      });
    console.log(`upserted ${p.code}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
