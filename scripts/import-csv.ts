/**
 * White-glove CSV import CLI (ARCHITECTURE.md §2.4, M2).
 *
 *   npx tsx scripts/import-csv.ts <file.csv> [source] [--agency=12] [--publish]
 *   npm run import:csv -- data/agency-x.csv whiteglove --agency=12 --publish
 *
 * source defaults to 'whiteglove'. Without --publish, imported listings land
 * in pending_review. With --publish they go live immediately — for trusted
 * white-glove batches or demo seeding. Re-running the same file is safe
 * (dedup → all unchanged).
 *
 * `--agency` is worth passing every time. It stamps the listings' owner and
 * scopes the id-space, so two agencies numbering their rows 1, 2, 3 do not
 * collide. Without it the batch is unscoped and the listings belong to nobody,
 * which is how the leads they generate become unattributable.
 *
 * /admin/importar does the same thing with a preview, a permission record and
 * an undo button; prefer it unless the file is too big for an upload.
 */
import { readFileSync } from "node:fs";
import { db } from "../src/db";
import { parseCsvRecords, recordToRaw } from "../src/lib/import/csv";
import { importListings } from "../src/lib/import/upsert";
import type { ListingSource, RawListing } from "../src/lib/import/types";

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes("--publish");
  const positional = args.filter((a) => !a.startsWith("--"));
  const file = positional[0];
  const source = (positional[1] as ListingSource) || "whiteglove";
  if (!file) {
    console.error(
      "usage: tsx scripts/import-csv.ts <file.csv> [source] [--agency=<id>] [--publish]",
    );
    process.exit(1);
  }

  const agencyArg = args.find((a) => a.startsWith("--agency="));
  const agencyId = agencyArg ? Number(agencyArg.slice("--agency=".length)) : null;
  if (agencyArg && (!Number.isInteger(agencyId) || agencyId! <= 0)) {
    console.error(`invalid --agency value '${agencyArg}'`);
    process.exit(1);
  }
  if (!agencyArg) {
    console.warn(
      "warning: no --agency given. The listings will belong to no agency and " +
        "share the unscoped id-space with every other unscoped import.",
    );
  }

  const records = parseCsvRecords(readFileSync(file, "utf8"));
  const rows: RawListing[] = [];
  const parseErrors: string[] = [];
  records.forEach((rec, i) => {
    try {
      rows.push(recordToRaw(rec, source));
    } catch (e) {
      parseErrors.push(`row ${i + 1}: ${String(e)}`);
    }
  });

  const report = await importListings(db, rows, { publish, agencyId });
  console.log(
    `\nimport '${file}' (source=${source}${
      agencyId ? `, agency=${agencyId}` : ", unscoped"
    }${publish ? ", published" : ""})\n` +
      `  created:   ${report.created}\n` +
      `  updated:   ${report.updated}\n` +
      `  unchanged: ${report.unchanged}\n` +
      `  deduped:   ${report.deduped}\n` +
      `  skipped:   ${report.skipped + parseErrors.length}`,
  );
  for (const e of parseErrors) console.log(`  parse ${e}`);
  for (const e of report.errors) console.log(`  skip  row ${e.row}: ${e.reason}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
