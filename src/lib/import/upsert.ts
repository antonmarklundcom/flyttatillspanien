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
 *   2. Else dedup_key matches an existing listing in the same scope?
 *        → attach a new listing_sources row to it            [deduped]
 *   3. Else create a new pending_review listing + source      [created]
 *
 * Re-running the same file therefore lands entirely in (1) → zero duplicates,
 * which is the M2 gate.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
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
  toPriceUsd,
  canon,
} from "./normalize";
import type { ImportReport, RawListing } from "./types";

/**
 * The pool or a transaction handle — row writers take either, so commit can
 * make each row's writes atomic (F46: a listing_sources insert that threw
 * after the listing insert left a listing with no provenance, invisible to
 * dedup, resync and rollback).
 */
type DbConn = typeof Db | Parameters<Parameters<(typeof Db)["transaction"]>[0]>[0];

const LEVEL_RANK: Record<string, number> = {
  barrio: 4,
  ciudad: 3,
  departamento: 2,
  pais: 1,
};

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
    // On duplicate names, keep the most specific level (barrio > ciudad …).
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
  usdToPyg?: number;
  /** Publish new listings immediately instead of pending_review. Use for
   *  trusted white-glove batches / demo seeding; leave off for scraped sources. */
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
  /** Index into plan.rows of an earlier row this one duplicates, if any. */
  dedupeOfRow?: number;
  sourceRowId?: number; // listing_sources row matched in step (1)
  raw?: RawListing;
  priceUsd?: number;
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
  const usdToPyg = opts.usdToPyg ?? Number(process.env.USD_TO_PYG ?? 7300);
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

      const priceUsd = toPriceUsd(raw.priceAmount, raw.priceCurrency, usdToPyg);
      // Sanity floor: no property in this market sells for under US$1000, so a
      // venta row below it is a mangled number (wrong thousands separator,
      // truncated cell), and one bad price poisons the medians, /precios and
      // /tasacion. Rejecting loudly beats importing quietly.
      if (raw.operation === "venta" && priceUsd < 1000) {
        skip(
          `precio de venta sospechosamente bajo (US$ ${priceUsd}) — revisá el separador de miles`,
        );
        continue;
      }
      const cHash = computeContentHash(raw, priceUsd);
      const dKey = computeDedupKey(raw, priceUsd, locationId, scopeAgencyId);

      const base: PlannedRow = {
        rowNumber,
        outcome: "created",
        title: raw.title,
        raw,
        priceUsd,
        locationId,
        contentHash: cHash,
        dedupKey: dKey,
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

      // (2) Does this property already exist under a different source? Only
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

      // (3) Brand new listing.
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
  priceAmount: listings.priceAmount,
  priceCurrency: listings.priceCurrency,
  priceUsd: listings.priceUsd,
  bedrooms: listings.bedrooms,
  bathrooms: listings.bathrooms,
  parking: listings.parking,
  areaM2: listings.areaM2,
  landM2: listings.landM2,
  propertyState: listings.propertyState,
  locationId: listings.locationId,
  addressText: listings.addressText,
  lat: listings.lat,
  lng: listings.lng,
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

        // A cached cuota computed from the old operation/price is wrong money
        // on the card; clear it and let cron:cuotas recompute (audit F15).
        const moneyChanged =
          previous &&
          (previous.operation !== raw.operation ||
            Number(previous.priceUsd) !== row.priceUsd);
        await db.transaction(async (tx) => {
          await tx
            .update(listings)
            .set({
              ...listingFields(raw, row.priceUsd!, row.locationId!),
              ...(moneyChanged ? { cuotaGs: null } : {}),
            })
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
          row.priceUsd!,
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
      out.push(committed(row, listingId, null));
    } catch (e) {
      out.push({
        rowNumber: row.rowNumber,
        outcome: "skipped",
        listingId: null,
        title: row.title ?? null,
        error: String(e),
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

  // publishedAt is left alone: this is a restore, not a fresh publish.
  await db
    .update(listings)
    .set({ status: "published" })
    .where(and(inArray(listings.id, ids), eq(listings.status, "paused")));
}

function committed(
  row: PlannedRow,
  listingId: number,
  previous: Record<string, unknown> | null,
): CommittedRow {
  return {
    rowNumber: row.rowNumber,
    outcome: row.outcome,
    listingId,
    title: row.title ?? null,
    error: null,
    previous,
  };
}

/** Recount from what actually happened — commit can downgrade a row to skipped. */
export function reportFromCommitted(rows: CommittedRow[]): ImportReport {
  const report = emptyReport();
  for (const r of rows) {
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

/** Columns shared by insert and update (everything the source controls). */
function listingFields(raw: RawListing, priceUsd: number, locationId: number) {
  return {
    operation: raw.operation,
    propertyType: raw.propertyType,
    title: raw.title,
    descriptionEs: raw.descriptionEs,
    priceAmount: raw.priceAmount.toFixed(2),
    priceCurrency: raw.priceCurrency,
    priceUsd: priceUsd.toFixed(2),
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    parking: raw.parking,
    areaM2: raw.areaM2 != null ? raw.areaM2.toString() : undefined,
    landM2: raw.landM2 != null ? raw.landM2.toString() : undefined,
    propertyState: raw.propertyState,
    locationId,
    addressText: raw.addressText,
    lat: raw.lat != null ? raw.lat.toString() : undefined,
    lng: raw.lng != null ? raw.lng.toString() : undefined,
  };
}

async function insertListing(
  db: DbConn,
  raw: RawListing,
  priceUsd: number,
  locationId: number,
  opts: ImportOptions,
): Promise<number> {
  const publicId = makePublicId();
  const slug = slugify(raw.title);
  const publish = opts.publish ?? false;
  const [res] = await db.insert(listings).values({
    publicId,
    slug,
    status: publish ? "published" : "pending_review",
    publishedAt: publish ? new Date() : undefined,
    // Ownership is stamped at creation, never inferred later.
    agencyId: opts.agencyId ?? undefined,
    agentId: opts.agentId ?? undefined,
    ownerUserId: opts.ownerUserId ?? undefined,
    ...listingFields(raw, priceUsd, locationId),
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
