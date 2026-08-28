/**
 * Fill `listings.title_sv` / `description_sv` from the agency feed's Spanish.
 *
 *   DATABASE_URL="mysql://..." ANTHROPIC_API_KEY="sk-..." npm run cron:translate
 *   ... npm run cron:translate -- --dry            # what would run, no API calls
 *   ... npm run cron:translate -- --limit 25       # bound the spend of one run
 *   ... npm run cron:translate -- --id 1234        # one listing, ignores the hash
 *   ... npm run cron:translate -- --force          # re-translate everything
 *
 * **What needs translating** is decided by `translation_hash_sv`: the sha256 of
 * the title and Spanish description the stored Swedish was made from. A row
 * needs work when the hash is missing (never translated) or no longer matches
 * (the seller rewrote something). That is why the job can run on a schedule
 * and cost nothing on a quiet day, and why an edit is picked up without any
 * hook in the publish path — see src/lib/translate.ts for why there is no hook.
 *
 * Only `published` rows with `source_lang = 'es'` are translated: a draft is
 * still being written, and a listing a Swedish relocation agent wrote in
 * Swedish is already in the served language — machine-translating it would
 * overwrite a human's words with a round trip through Spanish it never took.
 *
 * **Failure is per row and never fatal.** A row that throws keeps its old hash,
 * so the next run tries it again; the run reports every failure and exits
 * non-zero if any occurred, so a cron that mails its output says something
 * went wrong without pretending the whole batch died.
 */
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "../src/db";
import { listings } from "../src/db/schema";
import {
  isTranslationConfigured,
  translateListing,
  translationSourceHash,
} from "../src/lib/translate";

/** Rows fetched per round trip. The API call dominates; this is just paging. */
const PAGE = 500;

function flagValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const dry = process.argv.includes("--dry");
const force = process.argv.includes("--force");
const onlyId = Number(flagValue("--id") ?? 0) || null;
const limit = Number(flagValue("--limit") ?? 0) || Infinity;

interface Candidate {
  id: number;
  title: string;
  descriptionEs: string | null;
  translationHashSv: string | null;
}

/**
 * Published rows that need work, paged by id.
 *
 * The hash comparison happens here rather than in SQL on purpose: hashing in
 * the database means `SHA2()`, which is MySQL's spelling and not Postgres's,
 * and ARCHITECTURE.md keeps that escape hatch open. Four columns over the
 * published set is a cron-shaped cost, not a request-shaped one.
 */
async function* candidates(): AsyncGenerator<Candidate> {
  let after = 0;
  for (;;) {
    const rows = await db
      .select({
        id: listings.id,
        title: listings.title,
        descriptionEs: listings.descriptionEs,
        translationHashSv: listings.translationHashSv,
      })
      .from(listings)
      .where(
        and(
          eq(listings.status, "published"),
          eq(listings.sourceLang, "es"),
          gt(listings.id, after),
          onlyId ? eq(listings.id, onlyId) : undefined,
        ),
      )
      .orderBy(asc(listings.id))
      .limit(PAGE);

    if (rows.length === 0) return;
    after = rows[rows.length - 1].id;

    for (const row of rows) {
      const wanted = translationSourceHash(row);
      if (force || onlyId || row.translationHashSv !== wanted) yield row;
    }
    if (rows.length < PAGE) return;
  }
}

async function main() {
  if (!isTranslationConfigured() && !dry) {
    console.error(
      "ANTHROPIC_API_KEY is not set — nothing was translated.\n" +
        "This is a disabled feature, not a failure: the site reads\n" +
        "title_sv/description_sv straight from the row and falls back to the\n" +
        "Spanish title until they are filled. Re-run with the key set, or with\n" +
        "--dry to see what a run would do.",
    );
    process.exit(1);
  }

  let done = 0;
  let failed = 0;
  let pending = 0;

  for await (const row of candidates()) {
    pending++;
    if (done >= limit) continue; // keep counting so the tail is reported
    if (dry) {
      console.log(`  would translate #${row.id}  ${row.title.slice(0, 60)}`);
      done++;
      continue;
    }

    try {
      const t = await translateListing(row);
      /**
       * The hash is written from the same row we translated, in the same
       * statement as the text. If the seller edits the description while this
       * call is in flight, the hash we store is the *old* source's — which is
       * exactly right: it no longer matches, so the next run redoes it. The
       * opposite (hash the row as it is now) would silently keep a
       * translation of text nobody can see any more.
       */
      await db
        .update(listings)
        .set({
          titleSv: t.titleSv,
          descriptionSv: t.descriptionSv,
          translationHashSv: translationSourceHash(row),
        })
        .where(eq(listings.id, row.id));
      done++;
      console.log(`  #${row.id}  ${t.titleSv.slice(0, 60)}`);
    } catch (err) {
      failed++;
      console.error(`  #${row.id} FAILED: ${(err as Error).message}`);
    }
  }

  const skipped = Math.max(0, pending - done - failed);
  console.log(
    `\n${pending} listing(s) needed translation, ${done} ${dry ? "would run" : "written"}, ${failed} failed` +
      (skipped > 0 ? `, ${skipped} left for the next run (--limit)` : ""),
  );

  /**
   * Coverage, because "how much of the site is actually in Swedish" should be
   * a number someone can read rather than a feeling. Spanish-source rows only:
   * a `source_lang = 'sv'` listing is already Swedish and would flatter it.
   */
  const [cov] = await db
    .select({
      total: sql<number>`count(*)`,
      translated: sql<number>`sum(case when ${listings.titleSv} is not null then 1 else 0 end)`,
    })
    .from(listings)
    .where(and(eq(listings.status, "published"), eq(listings.sourceLang, "es")));

  const total = Number(cov?.total ?? 0);
  const translated = Number(cov?.translated ?? 0);
  const pct = total === 0 ? 0 : Math.round((translated / total) * 100);
  console.log(
    `coverage: ${translated}/${total} Spanish-source published listings have Swedish copy (${pct}%).`,
  );

  if (failed > 0) process.exit(1);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
