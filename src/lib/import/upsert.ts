/**
 * Import pipeline (ARCHITECTURE.md §2.4, M2): normalize → dedup → upsert.
 * The one place that writes listings + listing_sources from an intake.
 *
 * Split in two halves on purpose:
 *
 *   planImport()   — reads only. Resolves locations, hashes, and decides what
 *                    every row *would* do.
 *   commitImport() — writes exactly the plan it is handed, and reports what it
 *                    overwrote so the batch can be rolled back.
 *
 * The dry run in /admin/importar is `planImport` with no commit, so the preview
 * an operator approves is produced by the same code that then runs — a dry run
 * that used a separate validation path would eventually disagree with reality,
 * and the whole point of the preview is that it does not.
 *
 * Decision tree per raw row:
 *   1. Same (source, scope, source_external_id) already seen?
 *        → content changed:  update listing + bump last_seen  [updated]
 *        → identical:        bump last_seen only              [unchanged]
 *   2. Row carries a `referencia_catastral`?
 *        → EXACT match against `listings.referencia_catastral`
 *          (`uq_catastral`), and the fuzzy path is skipped entirely
 *        → matched: attach a new listing_sources row to it    [deduped]
 *   3. Else dedup_key matches an existing listing in the same scope?
 *        → attach a new listing_sources row to it            [deduped]
 *   4. Else create a new pending_review listing + source      [created]
 *
 * Re-running the same file therefore lands entirely in (1) → zero duplicates,
 * which is the M2 gate.
 *
 * **Why (2) exists and why it comes before (3).** A referencia catastral is
 * the Catastro's identifier for the physical property: government-issued and
 * globally unique. When a row carries one there is nothing to guess, so the
 * bucketed price/area/phone key in (3) — which is guesswork, tuned to be safe
 * rather than exact — has no business being consulted. When a row does NOT
 * carry one, (3) is used completely unchanged, `null`-means-do-not-merge rule
 * and all. There is no fallback invented for the null in either path.
 *
 * Both paths run through this one planner. A separate validation path for the
 * catastral case would drift from what actually runs, and the preview an
 * operator approves being produced by the code that then executes is the whole
 * reason the feature is safe.
 */
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { db as Db } from "../../db";
import {
  importJobs,
  importRows,
  listingImages,
  listings,
  listingSources,
  locations,
} from "../../db/schema";
import { syncDisplayCoords } from "../geo";
import { slugify } from "../slug";
import {
  contentHash as computeContentHash,
  dedupKey as computeDedupKey,
  makePublicId,
  normalizeCatastral,
  toPriceEur,
  canon,
} from "./normalize";
import { canPublish, PUBLISH_BLOCK_MESSAGE } from "../publish-gate";
import type { ImportReport, RawListing } from "./types";

/**
 * The pool or a transaction handle — row writers take either, so commit can
 * make each row's writes atomic (F46: a listing_sources insert that threw
 * after the listing insert left a listing with no provenance, invisible to
 * dedup, resync and rollback).
 */
type DbConn = typeof Db | Parameters<Parameters<(typeof Db)["transaction"]>[0]>[0];

const LEVEL_RANK: Record<string, number> = {
  zona: 5,
  municipio: 4,
  provincia: 3,
  comunidad: 2,
  pais: 1,
};

/**
 * Which listing, if any, already holds this catastral reference.
 *
 * One indexed lookup on `uq_catastral`. Not folded into the location
 * resolver's one-shot map: `listings` is the table this pipeline is writing
 * to, and a snapshot taken at the start of a run would be stale for every row
 * after the first.
 */
async function catastralHolder(
  db: typeof Db,
  catastral: string,
): Promise<number | null> {
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.referenciaCatastral, catastral))
    .limit(1);
  return row?.id ?? null;
}

/** In-memory location resolver built once per import run. */
async function buildLocationResolver(db: typeof Db) {
  const rows = await db
    .select({
      id: locations.id,
      fullSlug: locations.fullSlug,
      name: locations.name,
      level: locations.level,
    })
    .from(locations);

  const bySlug = new Map<string, number>();
  const byName = new Map<string, { id: number; rank: number }>();
  for (const r of rows) {
    bySlug.set(r.fullSlug, r.id);
    const key = canon(r.name);
    const rank = LEVEL_RANK[r.level] ?? 0;
    const prev = byName.get(key);
    // On duplicate names, keep the most specific level (zona > municipio …).
    if (!prev || rank > prev.rank) byName.set(key, { id: r.id, rank });
  }
  return (raw: RawListing): number | null => {
    if (raw.locationFullSlug) {
      const id = bySlug.get(raw.locationFullSlug);
      if (id) return id;
    }
    if (raw.locationName) {
      const hit = byName.get(canon(raw.locationName));
      if (hit) return hit.id;
    }
    return null;
  };
}

export interface ImportOptions {
  /**
   * Publish new listings immediately instead of pending_review. Use for
   * trusted white-glove batches / demo seeding; leave off for scraped sources.
   *
   * A request, not a guarantee: a row with no `energy_rating` is created as
   * `pending_review` whatever this says, because Spanish law requires the
   * rating to appear in the advertisement (src/lib/publish-gate.ts). The
   * report names every row that was downgraded.
   */
  publish?: boolean;
  /**
   * Who the imported listings belong to. Bulk imports used to set none of
   * this, so every CSV-imported listing was an orphan: it appeared in no
   * agency's panel, and a lead against it could not be attributed to anyone.
   * `agencyId` doubles as the dedup/external-id scope.
   */
  agencyId?: number | null;
  agentId?: number | null;
  ownerUserId?: number | null;
}

export type RowOutcome =
  | "created"
  | "updated"
  | "unchanged"
  | "deduped"
  | "skipped";

/** One row's decision, with everything commit needs to act on it. */
export interface PlannedRow {
  rowNumber: number; // 1-based, matching what the spreadsheet shows
  outcome: RowOutcome;
  title?: string;
  reason?: string; // why it was skipped
  listingId?: number; // the listing it matched (updated / unchanged / deduped)
  /**
   * The normalized referencia catastral, when the row carried a well-formed
   * one. Present ⇒ this row took the EXACT dedup path and `dedupKey` is null
   * by construction.
   */
  catastral?: string | null;
  /** Index into plan.rows of an earlier row this one duplicates, if any. */
  dedupeOfRow?: number;
  sourceRowId?: number; // listing_sources row matched in step (1)
  raw?: RawListing;
  priceEur?: number;
  locationId?: number;
  contentHash?: string;
  dedupKey?: string | null;
}

export interface ImportPlan {
  rows: PlannedRow[];
  report: ImportReport;
  scopeAgencyId: number;
}

/** What a committed row actually did — the input to the rollback log. */
export interface CommittedRow {
  rowNumber: number;
  outcome: RowOutcome;
  listingId: number | null;
  title: string | null;
  error: string | null;
  /**
   * Something the operator has to act on, on a row that otherwise succeeded —
   * today, only "you asked for this to be published and the publish gate
   * downgraded it to pending_review". It rides into `report.errors` rather
   * than a new field of its own: the batch did not do what was asked, the
   * import panel already renders that list, and a silently-not-published
   * listing is exactly the outcome nobody would notice otherwise.
   */
  note: string | null;
  /** Listing columns as they were before an `updated` row overwrote them. */
  previous: Record<string, unknown> | null;
}

function emptyReport(): ImportReport {
  return {
    created: 0,
    updated: 0,
    unchanged: 0,
    deduped: 0,
    skipped: 0,
    errors: [],
  };
}

/* ------------------------------------------------------------------ */
/* Plan — read-only                                                    */
/* ------------------------------------------------------------------ */

export async function planImport(
  db: typeof Db,
  rows: RawListing[],
  opts: ImportOptions = {},
): Promise<ImportPlan> {
  const scopeAgencyId = opts.agencyId ?? 0;
  const resolveLocation = await buildLocationResolver(db);
  const report = emptyReport();
  const planned: PlannedRow[] = [];

  /**
   * Within-batch bookkeeping. The old single-pass version read the DB per row
   * and so saw its own earlier writes; a read-only plan cannot, and without
   * these two maps a file listing the same property twice would plan two
   * `created` rows and produce the duplicate the pipeline exists to prevent.
   */
  const seenExternal = new Map<string, number>(); // externalId → index in planned
  const seenDedup = new Map<string, number>();
  /** referencia catastral → index in planned. The exact path's in-batch half. */
  const seenCatastral = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNumber = i + 1;

    const skip = (reason: string) => {
      planned.push({ rowNumber, outcome: "skipped", reason, title: raw?.title });
      report.skipped++;
      report.errors.push({ row: rowNumber, reason });
    };

    try {
      const locationId = resolveLocation(raw);
      if (locationId === null) {
        skip(
          `unresolved location '${raw.locationFullSlug ?? raw.locationName ?? ""}'`,
        );
        continue;
      }

      const priceEur = toPriceEur(raw.priceEur);
      // Sanity floor: no property in this market sells for under €1 000, so a
      // venta row below it is a mangled number (wrong thousands separator,
      // truncated cell), and one bad price poisons the medians, /precios and
      // /tasacion. Rejecting loudly beats importing quietly.
      if (raw.operation === "venta" && priceEur < 1000) {
        skip(
          `precio de venta sospechosamente bajo (€ ${priceEur}) — revisá el separador de miles`,
        );
        continue;
      }
      const cHash = computeContentHash(raw, priceEur);
      const catastral = normalizeCatastral(raw.referenciaCatastral);
      /**
       * The fuzzy key is computed only when there is no exact one. Computing
       * both and preferring one would leave a bucketed key on the provenance
       * row that a later, catastral-less row could match against — which is
       * the fuzzy path reaching a property it was explicitly skipped for.
       */
      const dKey = catastral
        ? null
        : computeDedupKey(raw, priceEur, locationId, scopeAgencyId);

      const base: PlannedRow = {
        rowNumber,
        outcome: "created",
        title: raw.title,
        raw,
        priceEur,
        locationId,
        contentHash: cHash,
        dedupKey: dKey,
        catastral,
      };

      // (1) Have we seen this exact source row before — in this batch, or in
      //     the database?
      if (raw.sourceExternalId) {
        const inBatch = seenExternal.get(raw.sourceExternalId);
        if (inBatch !== undefined) {
          skip(
            `duplicate source_external_id '${raw.sourceExternalId}' (also on row ${planned[inBatch].rowNumber})`,
          );
          continue;
        }
        seenExternal.set(raw.sourceExternalId, planned.length);

        const [existing] = await db
          .select({
            id: listingSources.id,
            listingId: listingSources.listingId,
            contentHash: listingSources.contentHash,
          })
          .from(listingSources)
          .where(
            and(
              eq(listingSources.source, raw.source),
              eq(listingSources.scopeAgencyId, scopeAgencyId),
              eq(listingSources.sourceExternalId, raw.sourceExternalId),
            ),
          )
          .limit(1);

        if (existing) {
          /**
           * The same source row, now claiming a catastral reference that
           * already belongs to a DIFFERENT listing. `uq_catastral` would
           * refuse the write anyway; refusing it here means the operator reads
           * what happened instead of a MySQL duplicate-key string. Two rows
           * claiming one physical property is exactly the case this column
           * exists to surface, so it is a skip and a report line, never a
           * silent merge of two listings that may belong to two agencies.
           */
          if (catastral) {
            const holder = await catastralHolder(db, catastral);
            if (holder != null && holder !== existing.listingId) {
              skip(
                `referencia catastral ${catastral} ya pertenece a otro aviso (#${holder})`,
              );
              continue;
            }
          }
          const unchanged = existing.contentHash === cHash;
          planned.push({
            ...base,
            outcome: unchanged ? "unchanged" : "updated",
            listingId: existing.listingId,
            sourceRowId: existing.id,
          });
          if (unchanged) report.unchanged++;
          else report.updated++;
          continue;
        }
      }

      /**
       * (2) The EXACT path. A referencia catastral identifies the physical
       * property, so a match is not a guess and the fuzzy path below is not
       * consulted at all.
       */
      if (catastral) {
        const inBatch = seenCatastral.get(catastral);
        if (inBatch !== undefined) {
          planned.push({ ...base, outcome: "deduped", dedupeOfRow: inBatch });
          report.deduped++;
          continue;
        }
        seenCatastral.set(catastral, planned.length);

        const holder = await catastralHolder(db, catastral);
        if (holder != null) {
          planned.push({ ...base, outcome: "deduped", listingId: holder });
          report.deduped++;
          continue;
        }

        // No holder: a brand-new property, and its reference goes on the row.
        planned.push(base);
        report.created++;
        continue;
      }

      // (3) Does this property already exist under a different source? Only
      //     ever asked when the row carried enough identity to have a key —
      //     see dedupKey() for why a blank one must not fall through to here.
      if (dKey) {
        const inBatch = seenDedup.get(dKey);
        if (inBatch !== undefined) {
          planned.push({ ...base, outcome: "deduped", dedupeOfRow: inBatch });
          report.deduped++;
          continue;
        }

        const [dup] = await db
          .select({ listingId: listingSources.listingId })
          .from(listingSources)
          .where(eq(listingSources.dedupKey, dKey))
          .limit(1);

        if (dup) {
          // Memoise the DB hit too: a second batch row with this key should
          // resolve in-batch instead of re-querying and re-attaching (F60).
          seenDedup.set(dKey, planned.length);
          planned.push({
            ...base,
            outcome: "deduped",
            listingId: dup.listingId,
          });
          report.deduped++;
          continue;
        }
        seenDedup.set(dKey, planned.length);
      }

      // (4) Brand new listing.
      planned.push(base);
      report.created++;
    } catch (e) {
      skip(String(e));
    }
  }

  return { rows: planned, report, scopeAgencyId };
}

/* ------------------------------------------------------------------ */
/* Commit — the only writer                                            */
/* ------------------------------------------------------------------ */

/** Columns we snapshot before an update, so a rollback can restore them. */
const SNAPSHOT_COLUMNS = {
  operation: listings.operation,
  propertyType: listings.propertyType,
  title: listings.title,
  descriptionEs: listings.descriptionEs,
  priceEur: listings.priceEur,
  bedrooms: listings.bedrooms,
  bathrooms: listings.bathrooms,
  parking: listings.parking,
  builtM2: listings.builtM2,
  usableM2: listings.usableM2,
  plotM2: listings.plotM2,
  yearBuilt: listings.yearBuilt,
  propertyState: listings.propertyState,
  locationId: listings.locationId,
  addressText: listings.addressText,
  lat: listings.lat,
  lng: listings.lng,
  /**
   * The legal block is snapshotted for the same reason the scalars are: an
   * update overwrites it, and a rollback that restored the price but left a
   * bad import's `legal_status` standing would leave the most consequential
   * field on the listing wrong with no trace.
   */
  referenciaCatastral: listings.referenciaCatastral,
  energyRating: listings.energyRating,
  energyEmissions: listings.energyEmissions,
  energyKwhM2: listings.energyKwhM2,
  energyCo2M2: listings.energyCo2M2,
  legalStatus: listings.legalStatus,
  chargesStatus: listings.chargesStatus,
  ibiAnnualEur: listings.ibiAnnualEur,
  communityMonthlyEur: listings.communityMonthlyEur,
  isVpo: listings.isVpo,
  landClassification: listings.landClassification,
  buildableM2: listings.buildableM2,
  touristLicence: listings.touristLicence,
};

export async function commitImport(
  db: typeof Db,
  plan: ImportPlan,
  opts: ImportOptions = {},
): Promise<CommittedRow[]> {
  const out: CommittedRow[] = [];
  const scopeAgencyId = plan.scopeAgencyId;
  /** Row index → the listing id it produced, for in-batch dedupe targets. */
  const producedListingId = new Map<number, number>();
  /**
   * Dedup keys whose provenance row was already written by this batch. Two
   * batch rows carrying the same key and no external id are the same source
   * saying the same thing twice — a second listing_sources row would be a
   * duplicate, not extra provenance (F60).
   */
  const writtenDedupKeys = new Set<string>();

  for (let i = 0; i < plan.rows.length; i++) {
    const row = plan.rows[i];

    if (row.outcome === "skipped") {
      out.push({
        rowNumber: row.rowNumber,
        outcome: "skipped",
        listingId: null,
        title: row.title ?? null,
        error: row.reason ?? null,
        note: null,
        previous: null,
      });
      continue;
    }

    const raw = row.raw!;
    const now = new Date();

    try {
      if (row.outcome === "unchanged") {
        await db
          .update(listingSources)
          .set({ lastSeenAt: now })
          .where(eq(listingSources.id, row.sourceRowId!));
        out.push(committed(row, row.listingId!, null));
        continue;
      }

      if (row.outcome === "updated") {
        const [previous] = await db
          .select(SNAPSHOT_COLUMNS)
          .from(listings)
          .where(eq(listings.id, row.listingId!))
          .limit(1);

        /**
         * The snapshot must cover everything this branch overwrites, not just
         * scalar columns. syncImages() below deletes and re-inserts the image
         * rows, and the source row's content_hash advances — without capturing
         * both, a rollback restored the scalars but left curated photos gone
         * and the hash pointing at the bad import, so re-uploading a corrected
         * file reported `unchanged` and never applied the fix.
         * The `_` keys ride along in previous_json; rollback splits them off.
         */
        const snapshot: Record<string, unknown> = { ...previous };
        if (raw.imageUrls && raw.imageUrls.length > 0) {
          const imageRows = await db
            .select({
              r2Key: listingImages.r2Key,
              position: listingImages.position,
              width: listingImages.width,
              height: listingImages.height,
              watermarkScore: listingImages.watermarkScore,
            })
            .from(listingImages)
            .where(eq(listingImages.listingId, row.listingId!));
          snapshot._images = imageRows;
        }
        const [prevSource] = await db
          .select({ contentHash: listingSources.contentHash })
          .from(listingSources)
          .where(eq(listingSources.id, row.sourceRowId!))
          .limit(1);
        if (prevSource) {
          snapshot._source = {
            id: row.sourceRowId!,
            contentHash: prevSource.contentHash,
          };
        }

        await db.transaction(async (tx) => {
          await tx
            .update(listings)
            .set(listingFields(raw, row.priceEur!, row.locationId!))
            .where(eq(listings.id, row.listingId!));
          // lat/lng/location_id are all in listingFields above.
          await syncDisplayCoords(tx, row.listingId!);
          await backfillOwnership(tx, row.listingId!, opts);
          await syncImages(tx, row.listingId!, raw.imageUrls);
          await tx
            .update(listingSources)
            .set({
              contentHash: row.contentHash!,
              dedupKey: row.dedupKey ?? null,
              lastSeenAt: now,
            })
            .where(eq(listingSources.id, row.sourceRowId!));
        });

        out.push(committed(row, row.listingId!, previous ? snapshot : null));
        continue;
      }

      if (row.outcome === "deduped") {
        const target =
          row.listingId ??
          (row.dedupeOfRow !== undefined
            ? producedListingId.get(row.dedupeOfRow)
            : undefined);
        if (target === undefined) {
          // The row it deduped against failed to commit. Falling through to a
          // create would be worse than saying so.
          out.push({
            rowNumber: row.rowNumber,
            outcome: "skipped",
            listingId: null,
            title: row.title ?? null,
            error: "duplicate of a row that could not be imported",
            note: null,
            previous: null,
          });
          continue;
        }
        producedListingId.set(i, target);
        if (
          row.dedupKey &&
          !raw.sourceExternalId &&
          writtenDedupKeys.has(row.dedupKey)
        ) {
          out.push(committed(row, target, null));
          continue;
        }
        const [srcRes] = await db.insert(listingSources).values({
          listingId: target,
          source: raw.source,
          scopeAgencyId,
          sourceUrl: raw.sourceUrl,
          sourceExternalId: raw.sourceExternalId,
          contentHash: row.contentHash!,
          dedupKey: row.dedupKey ?? null,
          firstSeenAt: now,
          lastSeenAt: now,
        });
        if (row.dedupKey) writtenDedupKeys.add(row.dedupKey);
        // The rollback needs to know exactly which provenance row this batch
        // attached: `first_seen_at >= job.createdAt` never matched (the job
        // header is written after commit), so deduped rollbacks were no-ops
        // that still claimed success (F12).
        out.push(
          committed(row, target, {
            _sourceRowId: Number(
              (srcRes as unknown as { insertId: number }).insertId,
            ),
          }),
        );
        continue;
      }

      // created — one transaction, so a failed listing_sources insert cannot
      // leave a listing with no provenance row (F46).
      const listingId = await db.transaction(async (tx) => {
        const id = await insertListing(
          tx,
          raw,
          row.priceEur!,
          row.locationId!,
          opts,
        );
        await syncDisplayCoords(tx, id);
        await syncImages(tx, id, raw.imageUrls);
        await tx.insert(listingSources).values({
          listingId: id,
          source: raw.source,
          scopeAgencyId,
          sourceUrl: raw.sourceUrl,
          sourceExternalId: raw.sourceExternalId,
          contentHash: row.contentHash!,
          dedupKey: row.dedupKey ?? null,
          firstSeenAt: now,
          lastSeenAt: now,
        });
        return id;
      });
      producedListingId.set(i, listingId);
      if (row.dedupKey) writtenDedupKeys.add(row.dedupKey);
      out.push(committed(row, listingId, null, publishGateNote(raw, opts)));
    } catch (e) {
      out.push({
        rowNumber: row.rowNumber,
        outcome: "skipped",
        listingId: null,
        title: row.title ?? null,
        error: String(e),
        note: null,
        previous: null,
      });
    }
  }

  await unpauseResurfaced(db, out);

  return out;
}

/**
 * The other half of the staleness sweep's promise. resync.ts pauses a listing
 * whose feed went quiet and says "one re-import that sees it again is enough to
 * put it back" — but nothing ever did (audit F14): updates never touch status
 * and the unchanged branch only bumps last_seen_at. So: any listing this batch
 * matched (updated or unchanged) that is currently paused *by a resync sweep*
 * goes back to published. Deliberately narrow — a listing paused by hand in the
 * panel stays paused; only sweep-paused rows (a non-reverted `paused` row under
 * a resync job) qualify, so a re-imported feed cannot override a human choice.
 */
async function unpauseResurfaced(db: typeof Db, out: CommittedRow[]) {
  const seenIds = [
    ...new Set(
      out
        .filter(
          (r) =>
            (r.outcome === "updated" || r.outcome === "unchanged") &&
            r.listingId != null,
        )
        .map((r) => r.listingId as number),
    ),
  ];
  if (seenIds.length === 0) return;

  const sweepPaused = await db
    .select({ listingId: importRows.listingId })
    .from(importRows)
    .innerJoin(importJobs, eq(importJobs.id, importRows.jobId))
    .innerJoin(listings, eq(listings.id, importRows.listingId))
    .where(
      and(
        inArray(importRows.listingId, seenIds),
        eq(importRows.outcome, "paused"),
        isNull(importRows.revertedAt),
        eq(importJobs.kind, "resync"),
        eq(listings.status, "paused"),
      ),
    );

  const ids = [
    ...new Set(
      sweepPaused
        .map((r) => r.listingId)
        .filter((id): id is number => id != null),
    ),
  ];
  if (ids.length === 0) return;

  // publishedAt is left alone: this is a restore, not a fresh publish. The
  // energy-rating predicate is the publish gate expressed in SQL, because this
  // is a set update rather than a row-at-a-time write: a listing that lost (or
  // never had) its rating stays paused rather than being restored into a
  // non-compliant advertisement.
  await db
    .update(listings)
    .set({ status: "published" })
    .where(
      and(
        inArray(listings.id, ids),
        eq(listings.status, "paused"),
        isNotNull(listings.energyRating),
      ),
    );
}

function committed(
  row: PlannedRow,
  listingId: number,
  previous: Record<string, unknown> | null,
  note: string | null = null,
): CommittedRow {
  return {
    rowNumber: row.rowNumber,
    outcome: row.outcome,
    listingId,
    title: row.title ?? null,
    error: null,
    note,
    previous,
  };
}

/**
 * The line an operator reads when they ticked "publish" and the gate said no.
 * Null when nothing was downgraded — the row either was not asked to publish
 * or passed the gate.
 */
function publishGateNote(
  raw: RawListing,
  opts: ImportOptions,
): string | null {
  if (!opts.publish || canPublish(raw)) return null;
  return `${PUBLISH_BLOCK_MESSAGE.energy_rating_missing} Annonsen skapades som "pending_review" i stället för publicerad.`;
}

/** Recount from what actually happened — commit can downgrade a row to skipped. */
export function reportFromCommitted(rows: CommittedRow[]): ImportReport {
  const report = emptyReport();
  for (const r of rows) {
    if (r.note) report.errors.push({ row: r.rowNumber, reason: r.note });
    if (r.outcome === "skipped") {
      report.skipped++;
      if (r.error) report.errors.push({ row: r.rowNumber, reason: r.error });
    } else if (r.outcome === "created") report.created++;
    else if (r.outcome === "updated") report.updated++;
    else if (r.outcome === "unchanged") report.unchanged++;
    else if (r.outcome === "deduped") report.deduped++;
  }
  return report;
}

/**
 * Plan and commit in one call. The CLI and any caller that does not need a
 * preview uses this; the behaviour is identical to the pre-split version.
 */
export async function importListings(
  db: typeof Db,
  rows: RawListing[],
  opts: ImportOptions = {},
): Promise<ImportReport> {
  const plan = await planImport(db, rows, opts);
  const committedRows = await commitImport(db, plan, opts);
  return reportFromCommitted(committedRows);
}

/* ------------------------------------------------------------------ */
/* Row writers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Columns shared by insert and update (everything the source controls).
 *
 * The agency feed is Spanish, so its copy lands in `title`/`description_es`
 * with `source_lang` at its default. `title_sv`/`description_sv` are NOT
 * written here and must never be: they belong to `npm run cron:translate`
 * alone, and an importer that filled them would be a form writing derived
 * copy — the exact thing the translation column's contract forbids.
 */
function listingFields(raw: RawListing, priceEur: number, locationId: number) {
  return {
    operation: raw.operation,
    propertyType: raw.propertyType,
    title: raw.title,
    descriptionEs: raw.descriptionEs,
    priceEur: priceEur.toFixed(2),
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    parking: raw.parking,
    builtM2: raw.builtM2 != null ? raw.builtM2.toString() : undefined,
    usableM2: raw.usableM2 != null ? raw.usableM2.toString() : undefined,
    plotM2: raw.plotM2 != null ? raw.plotM2.toString() : undefined,
    yearBuilt: raw.yearBuilt,
    propertyState: raw.propertyState,
    locationId,
    addressText: raw.addressText,
    lat: raw.lat != null ? raw.lat.toString() : undefined,
    lng: raw.lng != null ? raw.lng.toString() : undefined,
    /* The Spain legal block, as the feed states it. */
    referenciaCatastral: normalizeCatastral(raw.referenciaCatastral),
    energyRating: raw.energyRating,
    energyEmissions: raw.energyEmissions,
    energyKwhM2: raw.energyKwhM2 != null ? raw.energyKwhM2.toString() : undefined,
    energyCo2M2: raw.energyCo2M2 != null ? raw.energyCo2M2.toString() : undefined,
    // `desconocido` is the honest default when a feed says nothing: the portal
    // must never imply a clean legal status nobody told it about.
    legalStatus: raw.legalStatus ?? "desconocido",
    chargesStatus: raw.chargesStatus ?? "desconocido",
    ibiAnnualEur:
      raw.ibiAnnualEur != null ? raw.ibiAnnualEur.toFixed(2) : undefined,
    communityMonthlyEur:
      raw.communityMonthlyEur != null
        ? raw.communityMonthlyEur.toFixed(2)
        : undefined,
    isVpo: raw.isVpo ?? false,
    landClassification: raw.landClassification,
    buildableM2:
      raw.buildableM2 != null ? raw.buildableM2.toString() : undefined,
    touristLicence:
      raw.operation === "alquiler_vacacional" ? raw.touristLicence : null,
    /**
     * `nota_simple_seen_at` is absent on purpose and must stay absent. It is
     * the portal's own attestation that a charges search was sighted; a feed
     * cannot set it, and an importer that let one would turn the portal's
     * verification into a seller's claim.
     */
  };
}

async function insertListing(
  db: DbConn,
  raw: RawListing,
  priceEur: number,
  locationId: number,
  opts: ImportOptions,
): Promise<number> {
  const publicId = makePublicId();
  const slug = slugify(raw.title);
  /**
   * `publish` is a request, and the publish gate is what answers it. A feed
   * row with no energy rating cannot become an advertisement under
   * RD 390/2021, so it is created as `pending_review` instead — the operator
   * sees it in the review queue with the missing field, rather than the portal
   * quietly running a non-compliant ad. `commitImport` reports every
   * downgrade; see publishGateDowngrade() below.
   */
  const publish = (opts.publish ?? false) && canPublish(raw);
  const [res] = await db.insert(listings).values({
    publicId,
    slug,
    status: publish ? "published" : "pending_review",
    publishedAt: publish ? new Date() : undefined,
    // Ownership is stamped at creation, never inferred later.
    agencyId: opts.agencyId ?? undefined,
    agentId: opts.agentId ?? undefined,
    ownerUserId: opts.ownerUserId ?? undefined,
    ...listingFields(raw, priceEur, locationId),
  });
  // mysql2 returns insertId on the ResultSetHeader.
  return Number((res as unknown as { insertId: number }).insertId);
}

/**
 * Fill in ownership on a listing that has none — never overwrite it.
 *
 * A row only reaches an update because it matched this agency's own id-space,
 * so attributing it here is safe; reassigning a listing that already belongs to
 * someone would let one import move another agency's inventory.
 */
async function backfillOwnership(
  db: DbConn,
  listingId: number,
  opts: ImportOptions,
) {
  if (opts.agencyId == null && opts.agentId == null) return;
  const [current] = await db
    .select({ agencyId: listings.agencyId, agentId: listings.agentId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!current) return;

  const patch: { agencyId?: number; agentId?: number } = {};
  if (current.agencyId == null && opts.agencyId != null)
    patch.agencyId = opts.agencyId;
  if (current.agentId == null && opts.agentId != null)
    patch.agentId = opts.agentId;
  if (Object.keys(patch).length === 0) return;

  await db.update(listings).set(patch).where(eq(listings.id, listingId));
}

/**
 * Replace a listing's images from the source URLs. INTERIM: we store the
 * source URL in r2Key so photos render immediately (imageUrl() passes the key
 * through when R2_PUBLIC_BASE_URL is unset). The later R2 fetch pass (M6)
 * downloads these, watermark-scores them, and rewrites r2Key to real R2 keys.
 * Empty/absent list → leave existing images untouched.
 */
async function syncImages(
  db: DbConn,
  listingId: number,
  urls: string[] | undefined,
) {
  if (!urls || urls.length === 0) return;
  await db.delete(listingImages).where(eq(listingImages.listingId, listingId));
  await db.insert(listingImages).values(
    urls.slice(0, 20).map((url, i) => ({
      listingId,
      r2Key: url,
      position: i,
    })),
  );
}
