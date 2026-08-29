/**
 * Staleness sweep — the other half of `last_seen_at`.
 *
 * Every import bumps `last_seen_at` on the source rows it saw. Nothing has ever
 * read it back, so a listing that vanished from the agency's spreadsheet stayed
 * published forever. A portal full of properties that sold three months ago
 * loses trust faster than a portal with fewer listings, so this pauses them.
 *
 * `paused`, never `removed`: the listing keeps its URL, its photos and its
 * history, and one re-import that sees it again is enough to put it back. The
 * sweep is judging *evidence of absence from a feed*, which is a weaker claim
 * than "this property is gone", and the action taken should match the strength
 * of the claim.
 *
 * Only listings whose provenance is an intake are eligible. A listing typed
 * into the panel by hand has no feed to disappear from, and pausing it because
 * nobody re-uploaded a file would be nonsense.
 */
import "server-only";
import { and, eq, gt, inArray, lt, max, min, sql } from "drizzle-orm";
import { db } from "@/db";
import { importJobs, importRows, listings, listingSources } from "@/db/schema";
import type { ListingSource } from "./types";

/** Sources that come from a feed, and can therefore go quiet. */
const FEED_SOURCES: ListingSource[] = [
  "whiteglove",
  "import_idealista",
  "import_fotocasa",
  "import_kyero",
  "import_agency_site",
];

export const DEFAULT_STALE_DAYS = 30;

export interface StaleListing {
  listingId: number;
  title: string;
  lastSeenAt: Date;
}

/**
 * Listings that are published, sourced from a feed, and whose *most recent*
 * sighting across every source is older than the cutoff.
 *
 * The max() matters: a property carried by two agencies is not stale because
 * one of them stopped listing it.
 */
export async function findStaleListings(
  staleDays: number = DEFAULT_STALE_DAYS,
): Promise<StaleListing[]> {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      listingId: listingSources.listingId,
      title: listings.title,
      lastSeenAt: max(listingSources.lastSeenAt),
    })
    .from(listingSources)
    .innerJoin(listings, eq(listings.id, listingSources.listingId))
    .where(
      and(
        eq(listings.status, "published"),
        inArray(listingSources.source, FEED_SOURCES),
      ),
    )
    .groupBy(listingSources.listingId, listings.title)
    .having(
      and(
        lt(max(listingSources.lastSeenAt), cutoff),
        // Only listings that a feed has actually re-confirmed at least once.
        // A one-shot sighting (an agent's link claim, a single upload never
        // repeated) has last_seen = first_seen forever — there is no feed
        // going quiet to detect, and sweeping those paused an agent's own
        // claimed listing 30 days after they published it (audit F13).
        gt(max(listingSources.lastSeenAt), min(listingSources.firstSeenAt)),
      ),
    );

  return rows
    .filter((r) => r.lastSeenAt != null)
    .map((r) => ({
      listingId: r.listingId,
      title: r.title,
      lastSeenAt: new Date(r.lastSeenAt as unknown as string),
    }));
}

export interface ResyncResult {
  jobId: number | null;
  paused: number;
  candidates: StaleListing[];
  staleDays: number;
  dryRun: boolean;
}

/**
 * Pause everything stale and record the sweep as an import job, so it shows up
 * in the same log as the uploads and can be reverted the same way.
 */
export async function runResync(
  staleDays: number = DEFAULT_STALE_DAYS,
  opts: { dryRun?: boolean; userId?: number | null } = {},
): Promise<ResyncResult> {
  const candidates = await findStaleListings(staleDays);
  const dryRun = opts.dryRun ?? false;

  if (dryRun || candidates.length === 0) {
    return {
      jobId: null,
      paused: 0,
      candidates,
      staleDays,
      dryRun,
    };
  }

  const ids = candidates.map((c) => c.listingId);
  await db
    .update(listings)
    .set({ status: "paused" })
    .where(inArray(listings.id, ids));

  const now = new Date();
  const [res] = await db.insert(importJobs).values({
    source: "whiteglove", // the enum has no "system" member; kind carries the truth
    kind: "resync",
    filename: null,
    status: "committed",
    totalRows: candidates.length,
    skippedCount: 0,
    permissionGranted: false,
    createdByUserId: opts.userId ?? undefined,
    finishedAt: now,
    rollbackNote: `Pausadas por no aparecer en ninguna fuente desde hace ${staleDays} días.`,
  });
  const jobId = Number((res as unknown as { insertId: number }).insertId);

  const CHUNK = 200;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    await db.insert(importRows).values(
      candidates.slice(i, i + CHUNK).map((c, n) => ({
        jobId,
        rowNumber: i + n + 1,
        outcome: "paused" as const,
        listingId: c.listingId,
        title: c.title.slice(0, 200),
        error: `sin señal desde ${c.lastSeenAt.toISOString().slice(0, 10)}`,
        // The undo buffer, in the same shape rollback restores for an update.
        previousJson: { status: "published" },
      })),
    );
  }

  return { jobId, paused: candidates.length, candidates, staleDays, dryRun };
}

/** Price movements recorded by imports, newest first — the sync report. */
export interface PriceChange {
  listingId: number;
  title: string | null;
  before: string | null;
  after: string;
  at: Date;
}

export async function recentPriceChanges(limit = 50): Promise<PriceChange[]> {
  const rows = await db
    .select({
      listingId: importRows.listingId,
      title: importRows.title,
      previousJson: importRows.previousJson,
      after: listings.priceEur,
      at: importJobs.createdAt,
    })
    .from(importRows)
    .innerJoin(importJobs, eq(importJobs.id, importRows.jobId))
    .innerJoin(listings, eq(listings.id, importRows.listingId))
    .where(eq(importRows.outcome, "updated"))
    .orderBy(sql`${importJobs.createdAt} desc`)
    .limit(limit);

  return rows
    .map((r) => {
      const before = (r.previousJson as { priceEur?: string } | null)?.priceEur;
      return {
        listingId: r.listingId as number,
        title: r.title,
        before: before ?? null,
        after: r.after,
        at: r.at,
      };
    })
    .filter((c) => c.before != null && c.before !== c.after);
}
