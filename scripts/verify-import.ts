/**
 * Verify the import pipeline's load-bearing promises:
 *
 *   1. Re-running the same file changes nothing (the M2 gate).
 *   2. Rows that are merely *similar* are never merged into one listing.
 *   3. A row carrying a `referencia_catastral` is matched on it EXACTLY, and
 *      a row without one falls back to the fuzzy key completely unchanged.
 *
 * (2) is the one that used to be false. `dedup_key` is bucketed to 5 000 € and
 * 10 m² so a re-listed flat still collapses, and the contact phone was the only
 * thing keeping those buckets from describing every unit in a building. A
 * spreadsheet with a blank phone column therefore folded twenty flats into one
 * and reported success. Types cannot catch that; only running it can.
 *
 * (3) is the Spain addition, and **both of its paths are exercised below** —
 * one fixture that dedups on the cadastral reference and one that dedups on
 * the phone bucket. Testing only the exact path would leave the fuzzy one, the
 * one that is actually dangerous, uncovered; testing only the fuzzy path would
 * not notice the exact one silently never firing.
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
import {
  canonPhone,
  contentHash,
  dedupKey,
  normalizeCatastral,
  toPriceEur,
} from "../src/lib/import/normalize";
import { parseCsvRecords, recordToRaw } from "../src/lib/import/csv";
import { readIntake } from "../src/lib/import/intake";
import { canPublish } from "../src/lib/publish-gate";
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
    builtM2: 60,
    locationName: "Marbella",
    ...over,
  };
}

/** A syntactically valid 20-character cadastral reference. */
const RC_A = "9872023VH5797S0001WX";
const RC_B = "1234567VH5797S0001WX";

function pureChecks() {
  console.log("\nhashing");

  const noPhone = dedupKey(raw(), 285000, 7);
  check("no contact phone → no dedup key", noPhone === null, String(noPhone));

  const a = dedupKey(raw({ contactPhone: "952123456" }), 285000, 7);
  const b = dedupKey(raw({ contactPhone: "+34 952 12 34 56" }), 285000, 7);
  check("phone formatting does not change the key", a !== null && a === b);

  // The bug, stated as a test: two different flats, same building, no phone.
  const flat1 = dedupKey(raw({ title: "Piso 3A" }), 285000, 7);
  const flat2 = dedupKey(raw({ title: "Piso 7B" }), 286000, 7);
  check(
    "two phone-less flats in one building do not collide",
    flat1 === null && flat2 === null,
  );

  // With a phone they still collapse — the bucketing is intentional.
  const same1 = dedupKey(raw({ contactPhone: "952123456" }), 285000, 7);
  const same2 = dedupKey(raw({ contactPhone: "952123456" }), 286000, 7);
  check("same property re-listed 1k higher still collapses", same1 === same2);

  const scoped1 = dedupKey(raw({ contactPhone: "952123456" }), 285000, 7, 1);
  const scoped2 = dedupKey(raw({ contactPhone: "952123456" }), 285000, 7, 2);
  check("different agencies get different keys", scoped1 !== scoped2);
  check("unscoped differs from scoped", scoped1 !== same1);

  check("+34 is stripped", canonPhone("+34 952 12 34 56") === "952123456");
  check("00 34 is stripped too", canonPhone("0034952123456") === "952123456");
  check(
    "Sweden's trunk 0 is stripped, at home and abroad",
    canonPhone("070-123 45 67") === "701234567" &&
      canonPhone("+46 70 123 45 67") === "701234567",
  );
  check(
    "a Spanish national number keeps all nine digits",
    canonPhone("952 12 34 56") === "952123456",
  );

  console.log("\nreferencia catastral");

  check(
    "spaces and case are normalized away",
    normalizeCatastral(" 9872023vh5797s0001wx ") === RC_A,
    String(normalizeCatastral(" 9872023vh5797s0001wx ")),
  );
  /**
   * The important half. A 19-character value is NOT a cadastral reference, and
   * handing it to the EXACT path would turn a typo into a strong claim that
   * two properties are the same one. It must fall through to the fuzzy path.
   */
  check(
    "a value that is not 20 characters is not a reference",
    normalizeCatastral("9872023VH5797S0001W") === null &&
      normalizeCatastral("9872023VH5797S0001WXY") === null &&
      normalizeCatastral("") === null &&
      normalizeCatastral(undefined) === null,
  );

  console.log("\npublish gate");

  check(
    "a row with no energy rating cannot be published",
    !canPublish(raw()),
  );
  check(
    "en_tramite and exento are answers, not silence",
    canPublish(raw({ energyRating: "en_tramite" })) &&
      canPublish(raw({ energyRating: "exento" })) &&
      canPublish(raw({ energyRating: "D" })),
  );

  console.log("\ncontent hash");

  const h1 = contentHash(raw(), 285000);
  const h2 = contentHash(raw(), 285000);
  const h3 = contentHash(raw({ priceEur: 290000 }), 290000);
  check("content hash is stable", h1 === h2);
  check("content hash moves with the price", h1 !== h3);
  /**
   * A seller obtaining the energy certificate, or an agency correcting
   * `legal_status` from `desconocido` to `sin_lpo`, has changed what the
   * advertisement says about the property. If the hash ignored the legal
   * block, the most consequential corrections on the portal would arrive as
   * "unchanged" and never reach the row.
   */
  check(
    "content hash moves with the legal block",
    contentHash(raw({ energyRating: "D" }), 285000) !== h1 &&
      contentHash(raw({ legalStatus: "sin_lpo" }), 285000) !== h1 &&
      contentHash(raw({ referenciaCatastral: RC_A }), 285000) !== h1,
  );

  check("the euro price keeps its cents", toPriceEur(285_000.4) === 285_000.4);

  console.log("\nparsing");

  const csv =
    "operation,property_type,title,price_eur,location_name,energy_rating,legal_status\n" +
    'venta,villa,"Villa ""La Loma"", con jardín",485000,Marbella,D,escritura_registrada\n' +
    "alquiler,apartamento,Piso céntrico,1500,Málaga,,\n";
  const recs = parseCsvRecords(csv);
  check("csv row count", recs.length === 2, String(recs.length));
  check(
    "escaped quotes and embedded commas survive",
    recs[0].title === 'Villa "La Loma", con jardín',
    recs[0].title,
  );

  const parsed = recordToRaw(recs[0], "whiteglove");
  check("the legal block reads through", parsed.energyRating === "D");
  check(
    "an empty legal cell is absence, not a value",
    recordToRaw(recs[1], "whiteglove").energyRating === undefined,
  );
  /**
   * A stated-but-unrecognised value is a different fact from an absent one: a
   * feed spelling `legal_status` as "sin licencia" is telling us something,
   * and storing the `desconocido` default instead would turn a stated problem
   * into "nobody said".
   */
  let badEnum = false;
  try {
    recordToRaw({ ...recs[0], legal_status: "sin licencia" }, "whiteglove");
  } catch {
    badEnum = true;
  }
  check("an unrecognised enum value is rejected, not defaulted", badEnum);

  // es-ES thousands separators — `285.000` is 285 000, not a JS decimal (F3).
  const dotted = recordToRaw(
    { ...recs[0], price_eur: "285.000", built_m2: "1.200" },
    "whiteglove",
  );
  check("'285.000' parses as 285000, not 285", dotted.priceEur === 285000, String(dotted.priceEur));
  check("'1.200' m² parses as 1200, not 1.2", dotted.builtM2 === 1200, String(dotted.builtM2));
  const grouped = recordToRaw({ ...recs[0], price_eur: "1.250.000" }, "whiteglove");
  check("'1.250.000' parses as 1250000", grouped.priceEur === 1_250_000, String(grouped.priceEur));
  const enUs = recordToRaw({ ...recs[0], price_eur: "185,000" }, "whiteglove");
  check("'185,000' parses as 185000", enUs.priceEur === 185_000, String(enUs.priceEur));

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
    Buffer.from("title,price_eur\nVilla,100\n", "utf8"),
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
    title: `${MARKER} Flat ${n}`,
    priceEur: 285000,
    builtM2: 60,
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
    .where(like(listings.title, `${MARKER} Flat%`));
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

  /* ---------------------------------------------------------------- */
  /* The two dedup paths, both exercised.                               */
  /* ---------------------------------------------------------------- */

  /**
   * The EXACT path. Two rows for one physical property, from two different
   * sources (so the external-id branch cannot claim them), carrying the same
   * cadastral reference written two different ways. Nothing else about them
   * matches: different title, different price bucket, no phone at all — so a
   * merge here can only have come from the reference.
   */
  const catastralA: RawListing = {
    source: "whiteglove",
    sourceExternalId: "rc-1",
    operation: "venta",
    propertyType: "villa",
    title: `${MARKER} Villa con RC`,
    priceEur: 495000,
    builtM2: 210,
    referenciaCatastral: RC_A,
    locationName: loc.name,
  };
  const catastralB: RawListing = {
    ...catastralA,
    source: "import_idealista",
    sourceExternalId: "rc-2",
    title: `${MARKER} Villa con RC (otro portal)`,
    priceEur: 519000, // a different 5 000 € bucket
    builtM2: 245, // a different 10 m² bucket
    referenciaCatastral: ` ${RC_A.toLowerCase()} `,
  };

  const planRc1 = reportFromCommitted(
    await commitImport(
      db,
      await planImport(db, [catastralA], { agencyId: agencyA }),
      { agencyId: agencyA },
    ),
  );
  check("a row with a cadastral reference creates a listing", planRc1.created === 1);

  const planRc2 = reportFromCommitted(
    await commitImport(
      db,
      await planImport(db, [catastralB], { agencyId: agencyA }),
      { agencyId: agencyA },
    ),
  );
  check(
    "a second source with the same referencia catastral dedups onto it",
    planRc2.deduped === 1 && planRc2.created === 0,
    `deduped=${planRc2.deduped} created=${planRc2.created}`,
  );

  const rcRows = await db
    .select({ id: listings.id, rc: listings.referenciaCatastral })
    .from(listings)
    .where(like(listings.title, `${MARKER} Villa con RC%`));
  check(
    "…as one listing, holding the normalized reference",
    rcRows.length === 1 && rcRows[0].rc === RC_A,
    JSON.stringify(rcRows),
  );

  /**
   * The FUZZY path, unchanged. Same physical flat re-listed by the same agent
   * at a slightly different price, no cadastral reference anywhere — so the
   * bucketed phone key is the only thing that can match it, and it must still
   * do so. This is the fallback the exact path skips, not a replacement for it.
   */
  const phoneA: RawListing = {
    source: "whiteglove",
    sourceExternalId: "ph-1",
    operation: "venta",
    propertyType: "apartamento",
    title: `${MARKER} Piso sin RC`,
    priceEur: 312000,
    builtM2: 95,
    contactPhone: "+34 952 99 88 77",
    locationName: loc.name,
  };
  const phoneB: RawListing = {
    ...phoneA,
    source: "import_fotocasa",
    sourceExternalId: "ph-2",
    title: `${MARKER} Piso sin RC (otro portal)`,
    priceEur: 311000, // same 5 000 € bucket (both round to 310 000)
    builtM2: 96, // same 10 m² bucket
    contactPhone: "0034952998877", // same number, written differently
  };

  const planPh1 = reportFromCommitted(
    await commitImport(
      db,
      await planImport(db, [phoneA], { agencyId: agencyA }),
      { agencyId: agencyA },
    ),
  );
  check("a row with no cadastral reference creates a listing", planPh1.created === 1);

  const planPh2 = reportFromCommitted(
    await commitImport(
      db,
      await planImport(db, [phoneB], { agencyId: agencyA }),
      { agencyId: agencyA },
    ),
  );
  check(
    "the phone-bucket fallback still dedups when there is no reference",
    planPh2.deduped === 1 && planPh2.created === 0,
    `deduped=${planPh2.deduped} created=${planPh2.created}`,
  );

  /**
   * And the rule that makes the two paths safe together: a row carrying a
   * reference must not ALSO leave a bucketed key on its provenance row, or a
   * later reference-less row could match the fuzzy key of a property the fuzzy
   * path was explicitly skipped for.
   */
  const rcSources = await db
    .select({ dedupKey: listingSources.dedupKey })
    .from(listingSources)
    .where(inArray(listingSources.listingId, rcRows.map((r) => r.id)));
  check(
    "a catastral row carries no fuzzy key alongside its exact one",
    rcSources.length > 0 && rcSources.every((r) => r.dedupKey === null),
    JSON.stringify(rcSources),
  );

  /* ---------------------------------------------------------------- */
  /* The publish gate, at the one transition that matters.             */
  /* ---------------------------------------------------------------- */

  const gated: RawListing = {
    source: "whiteglove",
    sourceExternalId: "gate-1",
    operation: "venta",
    propertyType: "villa",
    title: `${MARKER} Villa sin energia`,
    priceEur: 400000,
    builtM2: 180,
    locationName: loc.name,
  };
  const gatedReport = reportFromCommitted(
    await commitImport(
      db,
      await planImport(db, [gated], { agencyId: agencyA }),
      { agencyId: agencyA, publish: true },
    ),
  );
  const [gatedRow] = await db
    .select({ status: listings.status })
    .from(listings)
    .where(like(listings.title, `${MARKER} Villa sin energia%`));
  check(
    "publish:true does not publish a row with no energy rating",
    gatedRow?.status === "pending_review",
    String(gatedRow?.status),
  );
  check(
    "…and the report says so rather than reporting a clean import",
    gatedReport.errors.some((e) => e.reason.includes("Energiklass")),
    JSON.stringify(gatedReport.errors),
  );

  const publishable: RawListing = {
    ...gated,
    sourceExternalId: "gate-2",
    title: `${MARKER} Villa con energia`,
    energyRating: "en_tramite",
  };
  await commitImport(
    db,
    await planImport(db, [publishable], { agencyId: agencyA }),
    { agencyId: agencyA, publish: true },
  );
  const [publishedRow] = await db
    .select({ status: listings.status })
    .from(listings)
    .where(like(listings.title, `${MARKER} Villa con energia%`));
  check(
    "…while `en_tramite` is an answer and publishes",
    publishedRow?.status === "published",
    String(publishedRow?.status),
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
    .where(like(listings.title, `${MARKER} Flat%`));
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
