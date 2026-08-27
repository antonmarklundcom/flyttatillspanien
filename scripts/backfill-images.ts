/**
 * Pull remote listing photos into R2 (ARCHITECTURE.md M0/M6).
 *
 * The CSV importer parks the *source URL* in listing_images.r2_key and defers
 * the fetch — so today the site hotlinks other people's servers (and the demo
 * rows point at picsum.photos, which is why next.config.ts had to whitelist
 * it). This walks every row whose key is still a URL, downloads it, runs it
 * through the same processing the panel upload uses, stores it under a real
 * R2 key and rewrites the row.
 *
 *   $env:DATABASE_URL="..."   # tsx does not auto-load .env
 *   npx tsx scripts/backfill-images.ts --dry-run
 *   npx tsx scripts/backfill-images.ts --limit 50
 *   npx tsx scripts/backfill-images.ts --include-placeholders
 *
 * Idempotent: rows already holding an R2 key are skipped, so a re-run only
 * picks up what failed or arrived since. Placeholder picsum rows are skipped
 * by default — copying fake stock photos into the bucket is not the point.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { listingImages, listings } from "../src/db/schema";
import { isPlaceholderPhoto } from "../src/lib/photos";
import {
  buildImageKey,
  processListingImage,
  STORED_CONTENT_TYPE,
  thumbKey,
} from "../src/lib/images";
import { isR2Configured, putObject } from "../src/lib/r2";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const includePlaceholders = args.includes("--include-placeholders");
const limitArg = args.indexOf("--limit");
const limit =
  limitArg !== -1 && args[limitArg + 1] ? Number(args[limitArg + 1]) : 0;

/** A key that is still a URL has never been stored by us. */
function isRemoteUrl(key: string): boolean {
  return /^https?:\/\//i.test(key);
}

const FETCH_TIMEOUT_MS = 20_000;

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // Some source sites 403 an unidentified client.
    headers: { "user-agent": "propia-image-backfill/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!dryRun && !isR2Configured()) {
    console.error(
      "R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY and R2_BUCKET, or pass --dry-run.",
    );
    process.exit(1);
  }

  const rows = await db
    .select({
      id: listingImages.id,
      r2Key: listingImages.r2Key,
      publicId: listings.publicId,
    })
    .from(listingImages)
    .innerJoin(listings, eq(listingImages.listingId, listings.id));

  const pending = rows.filter((row) => {
    if (!isRemoteUrl(row.r2Key)) return false; // already ours
    if (!includePlaceholders && isPlaceholderPhoto(row.r2Key)) return false;
    return true;
  });

  const work = limit > 0 ? pending.slice(0, limit) : pending;
  console.log(
    `${rows.length} image rows, ${pending.length} still remote, ` +
      `processing ${work.length}${dryRun ? " (dry run)" : ""}.`,
  );

  let done = 0;
  const failures: string[] = [];

  // Sequential on purpose: sharp is CPU-bound and the source hosts are
  // someone else's. A backfill has all night; it must not look like a scrape.
  for (const row of work) {
    if (dryRun) {
      console.log(`would fetch ${row.r2Key} → listings/${row.publicId}/…`);
      continue;
    }
    try {
      const processed = await processListingImage(await download(row.r2Key));
      const key = buildImageKey(row.publicId);

      await putObject(key, processed.full, STORED_CONTENT_TYPE);
      await putObject(thumbKey(key), processed.thumb, STORED_CONTENT_TYPE);

      // Rewrite last: if anything above threw, the row still points at the
      // source and the next run retries it.
      await db
        .update(listingImages)
        .set({ r2Key: key, width: processed.width, height: processed.height })
        .where(eq(listingImages.id, row.id));

      done += 1;
      if (done % 25 === 0) console.log(`  ${done}/${work.length}…`);
    } catch (err) {
      failures.push(`#${row.id} ${row.r2Key}: ${String(err)}`);
    }
  }

  if (!dryRun) {
    console.log(`Stored ${done} image(s) in R2.`);
    if (failures.length) {
      console.log(`${failures.length} failed (safe to re-run):`);
      for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
