/**
 * The import audit trail: recording a batch, and undoing one.
 *
 * `ImportReport` used to be a console summary that vanished when the SSH
 * session closed. Everything here exists so two questions have answers a week
 * later: *what did that upload actually do*, and *can I take it back*.
 *
 * Rollback is deliberately conservative. It reverses what the batch wrote and
 * nothing else, and it refuses to delete a listing that has picked up a life of
 * its own since — a lead against it, a human edit, a published state. A
 * rollback that quietly destroyed a lead would be a worse outcome than the bad
 * import it was cleaning up, so those rows are left alone and named in
 * `rollback_note`.
 */
import "server-only";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agencies,
  importJobs,
  importRows,
  leads,
  listingImages,
  listings,
  listingSources,
  listingViewsDaily,
} from "@/db/schema";
import { syncDisplayCoords } from "../geo";
import type { ImportReport } from "./types";
import type { CommittedRow } from "./upsert";
import type { ListingSource } from "./types";

export type ImportJobKind = "csv" | "xlsx" | "url" | "resync";
export type ImportJobStatus = "dry_run" | "committed" | "rolled_back" | "failed";

export interface PermissionInput {
  granted: boolean;
  grantedBy: string | null;
  note: string | null;
}

export interface RecordJobInput {
  agencyId: number | null;
  source: ListingSource;
  kind: ImportJobKind;
  filename: string | null;
  status: ImportJobStatus;
  report: ImportReport;
  totalRows: number;
  permission: PermissionInput;
  createdByUserId: number | null;
}

/** Write the job header. Returns its id. */
export async function createImportJob(
  input: RecordJobInput,
): Promise<number> {
  const now = new Date();
  const [res] = await db.insert(importJobs).values({
    agencyId: input.agencyId ?? undefined,
    source: input.source,
    kind: input.kind,
    filename: input.filename?.slice(0, 255),
    status: input.status,
    totalRows: input.totalRows,
    createdCount: input.report.created,
    updatedCount: input.report.updated,
    unchangedCount: input.report.unchanged,
    dedupedCount: input.report.deduped,
    skippedCount: input.report.skipped,
    permissionGranted: input.permission.granted,
    permissionGrantedBy: input.permission.grantedBy?.slice(0, 160),
    permissionNote: input.permission.note?.slice(0, 500),
    // Only stamped when permission was actually claimed — a timestamp on an
    // unticked box would read like a grant that never happened.
    permissionGrantedAt: input.permission.granted ? now : undefined,
    createdByUserId: input.createdByUserId ?? undefined,
    finishedAt: now,
  });
  return Number((res as unknown as { insertId: number }).insertId);
}

/** Write the per-row log for a committed job. */
export async function recordImportRows(
  jobId: number,
  rows: CommittedRow[],
): Promise<void> {
  if (rows.length === 0) return;
  // Chunked: a 2 000-row spreadsheet in one INSERT exceeds max_allowed_packet
  // on Hostinger's default MySQL config.
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(importRows).values(
      rows.slice(i, i + CHUNK).map((r) => ({
        jobId,
        rowNumber: r.rowNumber,
        outcome: r.outcome,
        listingId: r.listingId ?? undefined,
        title: r.title?.slice(0, 200),
        error: r.error?.slice(0, 500),
        previousJson: r.previous ?? undefined,
      })),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export interface ImportJobSummary {
  id: number;
  agencyId: number | null;
  agencyName: string | null;
  source: string;
  kind: string;
  filename: string | null;
  status: ImportJobStatus;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  dedupedCount: number;
  skippedCount: number;
  permissionGranted: boolean;
  permissionGrantedBy: string | null;
  permissionNote: string | null;
  createdAt: Date;
  rolledBackAt: Date | null;
  rollbackNote: string | null;
}

export async function listImportJobs(limit = 50): Promise<ImportJobSummary[]> {
  const rows = await db
    .select({
      id: importJobs.id,
      agencyId: importJobs.agencyId,
      agencyName: agencies.name,
      source: importJobs.source,
      kind: importJobs.kind,
      filename: importJobs.filename,
      status: importJobs.status,
      totalRows: importJobs.totalRows,
      createdCount: importJobs.createdCount,
      updatedCount: importJobs.updatedCount,
      unchangedCount: importJobs.unchangedCount,
      dedupedCount: importJobs.dedupedCount,
      skippedCount: importJobs.skippedCount,
      permissionGranted: importJobs.permissionGranted,
      permissionGrantedBy: importJobs.permissionGrantedBy,
      permissionNote: importJobs.permissionNote,
      createdAt: importJobs.createdAt,
      rolledBackAt: importJobs.rolledBackAt,
      rollbackNote: importJobs.rollbackNote,
    })
    .from(importJobs)
    .leftJoin(agencies, eq(agencies.id, importJobs.agencyId))
    .orderBy(desc(importJobs.createdAt))
    .limit(limit);
  return rows as ImportJobSummary[];
}

export async function getImportJob(
  jobId: number,
): Promise<ImportJobSummary | null> {
  const [row] = await db
    .select({
      id: importJobs.id,
      agencyId: importJobs.agencyId,
      agencyName: agencies.name,
      source: importJobs.source,
      kind: importJobs.kind,
      filename: importJobs.filename,
      status: importJobs.status,
      totalRows: importJobs.totalRows,
      createdCount: importJobs.createdCount,
      updatedCount: importJobs.updatedCount,
      unchangedCount: importJobs.unchangedCount,
      dedupedCount: importJobs.dedupedCount,
      skippedCount: importJobs.skippedCount,
      permissionGranted: importJobs.permissionGranted,
      permissionGrantedBy: importJobs.permissionGrantedBy,
      permissionNote: importJobs.permissionNote,
      createdAt: importJobs.createdAt,
      rolledBackAt: importJobs.rolledBackAt,
      rollbackNote: importJobs.rollbackNote,
    })
    .from(importJobs)
    .leftJoin(agencies, eq(agencies.id, importJobs.agencyId))
    .where(eq(importJobs.id, jobId))
    .limit(1);
  return (row as ImportJobSummary) ?? null;
}

export interface ImportRowView {
  id: number;
  rowNumber: number;
  outcome: string;
  listingId: number | null;
  title: string | null;
  error: string | null;
  revertedAt: Date | null;
}

export async function listImportRows(
  jobId: number,
  limit = 500,
): Promise<ImportRowView[]> {
  return (await db
    .select({
      id: importRows.id,
      rowNumber: importRows.rowNumber,
      outcome: importRows.outcome,
      listingId: importRows.listingId,
      title: importRows.title,
      error: importRows.error,
      revertedAt: importRows.revertedAt,
    })
    .from(importRows)
    .where(eq(importRows.jobId, jobId))
    .orderBy(importRows.rowNumber)
    .limit(limit)) as ImportRowView[];
}

/** How many rows a job logged, so the detail page can say what it truncated. */
export async function countImportRows(jobId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(importRows)
    .where(eq(importRows.jobId, jobId));
  return row?.n ?? 0;
}

/* ------------------------------------------------------------------ */
/* Rollback                                                            */
/* ------------------------------------------------------------------ */

export interface RollbackResult {
  ok: boolean;
  deleted: number;
  restored: number;
  kept: number;
  note: string;
}

/**
 * Undo a committed batch.
 *
 *  - `created` rows  → delete the listing, its images and its source rows
 *  - `updated` rows  → restore the snapshot taken before the overwrite
 *  - `deduped` rows  → drop only the extra listing_sources row it attached
 *  - everything else → nothing was written, nothing to undo
 *
 * A created listing is kept, not deleted, when a lead points at it or when it
 * has been published — at that point it is a thing the business has acted on,
 * and a batch undo is the wrong instrument for removing it.
 */
export async function rollbackImportJob(
  jobId: number,
): Promise<RollbackResult> {
  const job = await getImportJob(jobId);
  if (!job) return fail("ese lote no existe");
  if (job.status === "rolled_back")
    return fail("ese lote ya fue revertido");
  if (job.status !== "committed")
    return fail("solo se puede revertir un lote confirmado");

  const rows = await db
    .select({
      id: importRows.id,
      outcome: importRows.outcome,
      listingId: importRows.listingId,
      previousJson: importRows.previousJson,
      revertedAt: importRows.revertedAt,
    })
    .from(importRows)
    .where(
      and(
        eq(importRows.jobId, jobId),
        inArray(importRows.outcome, ["created", "updated", "deduped", "paused"]),
      ),
    );

  const createdIds = rows
    .filter((r) => r.outcome === "created" && r.listingId != null)
    .map((r) => r.listingId as number);

  // Which created listings must survive, and why.
  const protectedIds = new Set<number>();
  const reasons: string[] = [];
  if (createdIds.length > 0) {
    const withLeads = await db
      .select({ listingId: leads.listingId, n: count() })
      .from(leads)
      .where(inArray(leads.listingId, createdIds))
      .groupBy(leads.listingId);
    for (const r of withLeads) {
      if (r.listingId != null) protectedIds.add(r.listingId);
    }
    if (withLeads.length > 0)
      reasons.push(`${withLeads.length} con consultas recibidas`);

    const published = await db
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(inArray(listings.id, createdIds), eq(listings.status, "published")),
      );
    for (const r of published) protectedIds.add(r.id);
    if (published.length > 0) reasons.push(`${published.length} ya publicadas`);
  }

  const deletableIds = createdIds.filter((id) => !protectedIds.has(id));
  let deleted = 0;
  let restored = 0;
  /**
   * Only the rows actually undone get stamped. Marking the whole job's rows
   * reverted would claim a protected listing had been removed and a skipped
   * row had been un-skipped — and the detail page reads this flag to decide
   * whether the listing it names still exists.
   */
  const revertedRowIds: number[] = [];

  if (deletableIds.length > 0) {
    // Children first — the schema has no FK constraints doing this for us, so
    // anything keyed by listing_id that is left behind is an orphan row.
    await db
      .delete(listingImages)
      .where(inArray(listingImages.listingId, deletableIds));
    await db
      .delete(listingSources)
      .where(inArray(listingSources.listingId, deletableIds));
    await db
      .delete(listingViewsDaily)
      .where(inArray(listingViewsDaily.listingId, deletableIds));
    await db.delete(listings).where(inArray(listings.id, deletableIds));
    deleted = deletableIds.length;
  }

  const deletedSet = new Set(deletableIds);

  for (const row of rows) {
    if (row.revertedAt) continue;
    if (row.listingId == null) continue;

    if (row.outcome === "created") {
      if (deletedSet.has(row.listingId)) revertedRowIds.push(row.id);
      continue;
    }

    // `paused` is a resync sweep's outcome and its snapshot is just the status
    // it had, so the same restore puts it back.
    if (
      (row.outcome === "updated" || row.outcome === "paused") &&
      row.previousJson
    ) {
      // The snapshot carries two non-column keys the commit rode along:
      // `_images` (the image rows syncImages replaced) and `_source` (the
      // content_hash the commit advanced). Restoring only the scalar columns
      // left curated photos deleted and — because the hash still described the
      // bad import — re-importing a *corrected* file reported `unchanged`.
      const { _images, _source, ...columns } = row.previousJson as {
        _images?: {
          r2Key: string;
          position: number;
          width: number | null;
          height: number | null;
          watermarkScore: number | null;
        }[];
        _source?: { id: number; contentHash: string | null };
      } & Record<string, unknown>;

      if (Object.keys(columns).length > 0) {
        await db
          .update(listings)
          .set(columns as Record<string, never>)
          .where(eq(listings.id, row.listingId));
        // The snapshot carries lat, lng and location_id (SNAPSHOT_COLUMNS in
        // upsert.ts), so restoring it moves the pin back too. Derived from the
        // restored row, never snapshotted itself — one source of truth.
        await syncDisplayCoords(db, row.listingId);
      }
      if (Array.isArray(_images)) {
        await db
          .delete(listingImages)
          .where(eq(listingImages.listingId, row.listingId));
        if (_images.length > 0) {
          await db.insert(listingImages).values(
            _images.map((img) => ({ ...img, listingId: row.listingId as number })),
          );
        }
      }
      if (_source && typeof _source.id === "number") {
        await db
          .update(listingSources)
          .set({ contentHash: _source.contentHash ?? "" })
          .where(eq(listingSources.id, _source.id));
      }
      restored++;
      revertedRowIds.push(row.id);
    }

    if (row.outcome === "deduped") {
      // Only the extra provenance row this batch attached goes; the listing it
      // attached to predates the batch and is not ours to remove. Newer jobs
      // recorded the exact row id at commit (F12: the timestamp predicate never
      // matched, because the job header is written after commit).
      const sourceRowId = (
        row.previousJson as { _sourceRowId?: number } | null
      )?._sourceRowId;
      if (typeof sourceRowId === "number") {
        await db
          .delete(listingSources)
          .where(eq(listingSources.id, sourceRowId));
      } else {
        // Legacy jobs committed before the id was recorded: best effort.
        await db
          .delete(listingSources)
          .where(
            and(
              eq(listingSources.listingId, row.listingId),
              eq(listingSources.source, job.source as never),
              sql`${listingSources.firstSeenAt} >= ${job.createdAt}`,
            ),
          );
      }
      revertedRowIds.push(row.id);
    }
  }

  const now = new Date();
  if (revertedRowIds.length > 0) {
    await db
      .update(importRows)
      .set({ revertedAt: now })
      .where(inArray(importRows.id, revertedRowIds));
  }

  const note =
    protectedIds.size > 0
      ? `${protectedIds.size} propiedades se conservaron (${reasons.join(", ")}).`
      : "";

  await db
    .update(importJobs)
    .set({
      status: "rolled_back",
      rolledBackAt: now,
      rollbackNote: note.slice(0, 500) || null,
    })
    .where(eq(importJobs.id, jobId));

  return {
    ok: true,
    deleted,
    restored,
    kept: protectedIds.size,
    note,
  };
}

function fail(note: string): RollbackResult {
  return { ok: false, deleted: 0, restored: 0, kept: 0, note };
}
