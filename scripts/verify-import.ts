/**
 * Verify the import pipeline's two load-bearing promises:
 *
 *   1. Re-running the same file changes nothing (the M2 gate).
 *   2. Rows that are merely *similar* are never merged into one listing.
 *
 * (2) is the one that used to be false. `dedup_key` is bucketed to 5k EUR and
 * 10 m² so a re-listed flat still collapses, and the contact phone was the only
 * thing keeping those buckets from describing every unit in a building. A
 * spreadsheet with a blank phone column therefore folded twenty flats into one
 * and reported success. Types cannot catch that; only running it can.
 *
 * Two halves:
 *
 *   npm run verify:import
 *     Pure checks only — hashing and parsing. No database needed.
 *
 *   docker compose up -d && npm run db:migrate
 *   DATABASE_URL="mysql://ftse:ftse@127.0.0.1:3306/ftse" npm run verify:import
 *     Also exercises plan → commit → re-run → rollback against real SQL.
 *
 * Refuses a non-local DATABASE_URL: it creates and deletes listings.
 */
import { inArray, like } from "drizzle-orm";
import { canonPhone, contentHash, dedupKey } from "../src/lib/import/normalize";
import { parseCsvRecords, recordToRaw } from "../src/lib/import/csv";
import { readIntake } from "../src/lib/import/intake";
import type { RawListing } from "../src/lib/import/types";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------ */
/* Pure checks                                                         */
/* ------------------------------------------------------------------ */

function raw(over: Partial<RawListing> = {}): RawListing {
  return {
    source: "whiteglove",
    operation: "venta",
    propertyType: "apartamento",
    title: "Piso en Nueva Andalucía",
    priceEur: 285000,
    builtM2: 90,
    locationName: "Nueva Andalucía",
    ...over,
  };
}

function pureChecks() {
  console.log("\nhashing");

  const noPhone = dedupKey(raw(), 285000, 7);
  check("no contact phone → no dedup key", noPhone === null, String(noPhone));

  const a = dedupKey(raw({ contactPhone: "611223344" }), 285000, 7);
  const b = dedupKey(raw({ contactPhone: "+34 611 22 33 44" }), 285000, 7);
  check("phone formatting does not change the key", a !== null && a === b);

  // The bug, stated as a test: two different flats, same building, no phone.
  const flat1 = dedupKey(raw({ title: "Piso 3A" }), 285000, 7);
  const flat2 = dedupKey(raw({ title: "Piso 7B" }), 286000, 7);
  check(
    "two phone-less flats in one building do not collide",
    flat1 === null && flat2 === null,
  );

  // With a phone they still collapse — the bucketing is intentional.
  const same1 = dedupKey(raw({ contactPhone: "611223344" }), 285000, 7);
  const same2 = dedupKey(raw({ contactPhone: "611223344" }), 286000, 7);
  check("same property re-listed 1k higher still collapses", same1 === same2);

  const scoped1 = dedupKey(raw({ contactPhone: "611223344" }), 285000, 7, 1);
  const scoped2 = dedupKey(raw({ contactPhone: "611223344" }), 285000, 7, 2);
  check("different agencies get different keys", scoped1 !== scoped2);
  check("unscoped differs from scoped", scoped1 !== same1);

  check("34 country code is stripped", canonPhone("+34611223344") === "611223344");
  check("leading zero is stripped", canonPhone("0611 223-344") === "611223344");

  const h1 = contentHash(raw(), 285000);
  const h2 = contentHash(raw(), 285000);
  const h3 = contentHash(raw({ priceEur: 290000 }), 290000);
  check("content hash is stable", h1 === h2);
  check("content hash moves with the price", h1 !== h3);

  console.log("\nparsing");

  const csv =
    "operation,property_type,title,price_eur,location_name\n" +
    'venta,villa,"Villa ""La Loma"", con jardín",485000,Marbella\n' +
    "alquiler,apartamento,Piso céntrico,900,Malaga\n";
  const recs = parseCsvRecords(csv);
  check("csv row count", recs.length === 2, String(recs.length));
  check(
    "escaped quotes and embedded commas survive",
    recs[0].title === 'Villa "La Loma", con jardín',
    recs[0].title,
  );

  const parsed = recordToRaw(recs[1], "whiteglove");
  check("price passes through", parsed.priceEur === 900);

  // Spanish thousands separators — `285.000` is 285 000, not a JS decimal.
  const dotted = recordToRaw(
    { ...recs[0], price_eur: "285.000", built_m2: "1.200" },
    "whiteglove",
  );
  check("'285.000' parses as 285000, not 285", dotted.priceEur === 285000, String(dotted.priceEur));
  check("'1.200' m² parses as 1200, not 1.2", dotted.builtM2 === 1200, String(dotted.builtM2));
  const grouped = recordToRaw(
    { ...recs[0], price_eur: "1.250.000" },
    "whiteglove",
  );
  check("'1.250.000' parses as 1250000", grouped.priceEur === 1_250_000, String(grouped.priceEur));
  const enUs = recordToRaw({ ...recs[0], price_eur: "485,000" }, "whiteglove");
  check("'485,000' parses as 485000", enUs.priceEur === 485_000, String(enUs.priceEur));

  let threw = false;
  try {
    recordToRaw({ ...recs[0], price_eur: "0" }, "whiteglove");
  } catch {
    threw = true;
  }
  check("a zero price is rejected, not imported", threw);

  // The BOM Excel writes when you "Save as CSV UTF-8".
  const withBom = Buffer.from(`﻿${csv}`, "utf8");
  const intake = readIntake(withBom, "agencia.csv", "whiteglove");
  check("a BOM does not break the first column", intake.rows.length === 2);
  check("no unknown columns reported", intake.unknownColumns.length === 0);

  const missing = readIntake(
    Buffer.from("title,price_eur\nCasa,100\n", "utf8"),
    "x.csv",
    "whiteglove",
  );
  check(
    "missing required columns are named",
    missing.missingRequired.includes("operation") &&
      missing.missingRequired.includes("property_type"),
  );
}

/* ------------------------------------------------------------------ */
/* Database checks                                                     */
/* ------------------------------------------------------------------ */

const MARKER = "ZZ-verify-import";

async function dbChecks() {
  const { db } = await import("../src/db");
  const { agencies, listings, listingSources, locations } = await import(
    "../src/db/schema"
  );
  const { planImport, commitImport, reportFromCommitted } = await import(
    "../src/lib/import/upsert"
  );
  const { createImportJob, recordImportRows, rollbackImportJob } = await import(
    "../src/lib/import/jobs"
  );

  console.log("\ndatabase");

  const [loc] = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .limit(1);
  if (!loc) {
    console.log("  SKIP  no locations seeded — run `npm run seed:locations`");
    return;
  }

  const cleanup = async () => {
    const rows = await db
      .select({ id: listings.id })
      .from(listings)
      .where(like(listings.title, `${MARKER}%`));
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      await db.delete(listingSources).where(inArray(listingSources.listingId, ids));
      await db.delete(listings).where(inArray(listings.id, ids));
    }
    await db.delete(agencies).where(like(agencies.name, `${MARKER}%`));
  };
  await cleanup();

  const [agA] = await db.insert(agencies).values({
    name: `${MARKER} A`,
    slug: `zz-verify-a-${Date.now()}`,
  });
  const [agB] = await db.insert(agencies).values({
    name: `${MARKER} B`,
    slug: `zz-verify-b-${Date.now()}`,
  });
  const agencyA = Number((agA as unknown as { insertId: number }).insertId);
  const agencyB = Number((agB as unknown as { insertId: number }).insertId);

  /** Three near-identical flats, no phone — the exact shape that used to merge. */
  const flats: RawListing[] = [1, 2, 3].map((n) => ({
    source: "whiteglove",
    sourceExternalId: String(n),
    operation: "venta",
    propertyType: "apartamento",
    title: `${MARKER} Piso ${n}`,
    priceEur: 285000,
    builtM2: 90,
    locationName: loc.name,
  }));

  const plan1 = await planImport(db, flats, { agencyId: agencyA });
  const committed1 = await commitImport(db, plan1, { agencyId: agencyA });
  const report1 = reportFromCommitted(committed1);
  check(
    "three phone-less flats create three listings",
    report1.created === 3,
    `created=${report1.created} deduped=${report1.deduped}`,
  );

  // Re-run the identical file: the M2 gate.
  const plan2 = await planImport(db, flats, { agencyId: agencyA });
  const report2 = reportFromCommitted(await commitImport(db, plan2, { agencyId: agencyA }));
  check(
    "re-importing the same file changes nothing",
    report2.unchanged === 3 && report2.created === 0,
    `unchanged=${report2.unchanged} created=${report2.created}`,
  );

  // Ownership.
  const owned = await db
    .select({ id: listings.id, agencyId: listings.agencyId })
    .from(listings)
    .where(like(listings.title, `${MARKER} Piso%`));
  check(
    "imported listings belong to the agency",
    owned.length === 3 && owned.every((l) => l.agencyId === agencyA),
    JSON.stringify(owned.map((l) => l.agencyId)),
  );

  // A second agency reusing the same external ids 1,2,3.
  const planB = await planImport(db, flats, { agencyId: agencyB });
  const reportB = reportFromCommitted(await commitImport(db, planB, { agencyId: agencyB }));
  check(
    "another agency's ids 1-3 do not overwrite the first agency's",
    reportB.created === 3,
    `created=${reportB.created} updated=${reportB.updated}`,
  );

  // A price change is an update, and the old price is captured for rollback.
  const changed = flats.map((f) => ({ ...f, priceEur: 299000 }));
  const planC = await planImport(db, changed, { agencyId: agencyA });
  const committedC = await commitImport(db, planC, { agencyId: agencyA });
  const reportC = reportFromCommitted(committedC);
  check("a changed price updates, not duplicates", reportC.updated === 3);
  check(
    "the previous price is snapshotted",
    committedC.every((r) => (r.previous as { priceEur?: string })?.priceEur === "285000.00"),
    JSON.stringify(committedC.map((r) => (r.previous as { priceEur?: string })?.priceEur)),
  );

  // Rollback: restore the updates, delete what agency B created.
  const jobId = await createImportJob({
    agencyId: agencyA,
    source: "whiteglove",
    kind: "csv",
    filename: "verify.csv",
    status: "committed",
    report: reportC,
    totalRows: 3,
    permission: { granted: true, grantedBy: "verify", note: null },
    createdByUserId: null,
  });
  await recordImportRows(jobId, committedC);
  const rollback = await rollbackImportJob(jobId);
  check("rollback reports success", rollback.ok, rollback.note);

  const afterRollback = await db
    .select({ priceEur: listings.priceEur })
    .from(listings)
    .where(like(listings.title, `${MARKER} Piso%`));
  check(
    "rollback restored the old prices",
    afterRollback.every((l) => l.priceEur === "285000.00"),
    JSON.stringify(afterRollback.map((l) => l.priceEur)),
  );

  const second = await rollbackImportJob(jobId);
  check("a job cannot be rolled back twice", !second.ok, second.note);

  await cleanup();
  console.log("  cleaned up");
}

/* ------------------------------------------------------------------ */

async function main() {
  pureChecks();

  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.log("\nDATABASE_URL not set — skipping the database half.");
  } else if (!/@(localhost|127\.0\.0\.1|mysql)[:/]/.test(url)) {
    console.log(
      "\nRefusing the database half: DATABASE_URL must point at a local " +
        "database (this creates and deletes listings).",
    );
  } else {
    await dbChecks();
  }

  console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
