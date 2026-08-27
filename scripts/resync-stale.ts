/**
 * Pause listings whose source feed has gone quiet.
 *
 *   npm run cron:resync -- --dry
 *   npm run cron:resync -- --days=45
 *
 * `--dry` lists what would be paused and writes nothing — run it first the
 * first time, because the right cutoff depends on how often the agencies
 * actually re-send their spreadsheets, and 30 days is a guess until you have
 * seen one full cycle.
 *
 * Everything it does is recorded as an import job and can be reverted from
 * /admin/importar, so a cutoff set too aggressively is one click to undo.
 */
import { DEFAULT_STALE_DAYS, runResync } from "../src/lib/import/resync";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry");
  const daysArg = args.find((a) => a.startsWith("--days="));
  const staleDays = daysArg
    ? Number(daysArg.slice("--days=".length))
    : Number(process.env.RESYNC_STALE_DAYS ?? DEFAULT_STALE_DAYS);

  if (!Number.isFinite(staleDays) || staleDays < 1) {
    console.error(`invalid --days value '${daysArg}'`);
    process.exit(1);
  }

  const result = await runResync(staleDays, { dryRun });

  console.log(
    `\nresync (cutoff ${staleDays} days${dryRun ? ", DRY RUN" : ""})\n` +
      `  stale listings: ${result.candidates.length}\n` +
      `  paused:         ${result.paused}` +
      (result.jobId ? `\n  job:            #${result.jobId}` : ""),
  );
  for (const c of result.candidates.slice(0, 50)) {
    console.log(
      `  - #${c.listingId} ${c.title} (last seen ${c.lastSeenAt
        .toISOString()
        .slice(0, 10)})`,
    );
  }
  if (result.candidates.length > 50)
    console.log(`  … and ${result.candidates.length - 50} more`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
