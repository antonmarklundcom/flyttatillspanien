/**
 * Per-listing stats for the people who own the listing (ARCHITECTURE.md M5
 * §3.3): views and leads, so the panel is worth logging into.
 *
 * Reads are scoped by the same `EditScope` predicate as everything else in the
 * panel — an agency sees its own numbers, an independent agent theirs, admin
 * all of them.
 */
import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, listings, listingViewsDaily } from "@/db/schema";
import { listingScopeWhere, type EditScope } from "@/lib/listing-edit";

/** Rolling window the panel reports on. */
export const STATS_WINDOW_DAYS = 30;

/** `YYYY-MM-DD` for a date, in UTC — the `day` column is a plain DATE. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function windowStart(days = STATS_WINDOW_DAYS): string {
  return dayKey(new Date(Date.now() - days * 86_400_000));
}

/**
 * Add one view to today's counter for a listing.
 *
 * UPDATE-then-INSERT rather than `INSERT … ON DUPLICATE KEY UPDATE`: that
 * syntax is MySQL-only and the schema's first rule is that the Postgres escape
 * hatch stays open. Two statements in the common case is still one round-trip
 * more than the dialect trick, which is why this runs *after* the response
 * (see the caller) rather than inside it.
 *
 * The race — two concurrent first-views of the same listing on the same day —
 * ends with one INSERT losing on the primary key. That is caught and retried as
 * an UPDATE, so the count is right and nothing is thrown at the caller.
 */
export async function recordListingView(listingId: number): Promise<void> {
  const day = dayKey(new Date());

  const [updated] = await db
    .update(listingViewsDaily)
    .set({ views: sql`${listingViewsDaily.views} + 1` })
    .where(
      and(
        eq(listingViewsDaily.listingId, listingId),
        eq(listingViewsDaily.day, day),
      ),
    );
  if (updated.affectedRows > 0) return;

  try {
    await db
      .insert(listingViewsDaily)
      .values({ listingId, day, views: 1 });
  } catch {
    // Lost the insert race (or the row appeared meanwhile) — the update now
    // finds a row. A dropped view is not worth surfacing an error for either.
    await db
      .update(listingViewsDaily)
      .set({ views: sql`${listingViewsDaily.views} + 1` })
      .where(
        and(
          eq(listingViewsDaily.listingId, listingId),
          eq(listingViewsDaily.day, day),
        ),
      )
      .catch(() => undefined);
  }
}

export interface ListingStats {
  listingId: number;
  /** Views inside the reporting window. */
  views: number;
  /** Leads inside the reporting window. */
  leads: number;
}

/**
 * Views and leads per listing for one scope, keyed by listing id.
 *
 * Two grouped queries rather than per-listing lookups, so a panel with 200
 * listings still costs two round-trips. Listings with no activity are simply
 * absent from the map — the caller renders 0.
 */
export async function getPanelListingStats(
  scope: EditScope,
): Promise<Map<number, ListingStats>> {
  const guard = listingScopeWhere(scope);
  const since = windowStart();

  const owned = await db
    .select({ id: listings.id })
    .from(listings)
    .where(guard);
  const ids = owned.map((r) => r.id);
  if (ids.length === 0) return new Map();

  const [viewRows, leadRows] = await Promise.all([
    db
      .select({
        listingId: listingViewsDaily.listingId,
        n: sql<number>`sum(${listingViewsDaily.views})`,
      })
      .from(listingViewsDaily)
      .where(
        and(
          inArray(listingViewsDaily.listingId, ids),
          gte(listingViewsDaily.day, since),
        ),
      )
      .groupBy(listingViewsDaily.listingId),
    db
      .select({
        listingId: leads.listingId,
        n: sql<number>`count(*)`,
      })
      .from(leads)
      .where(
        and(
          inArray(leads.listingId, ids),
          gte(leads.createdAt, new Date(`${since}T00:00:00Z`)),
        ),
      )
      .groupBy(leads.listingId),
  ]);

  const out = new Map<number, ListingStats>();
  const bump = (id: number): ListingStats => {
    const existing = out.get(id);
    if (existing) return existing;
    const fresh = { listingId: id, views: 0, leads: 0 };
    out.set(id, fresh);
    return fresh;
  };

  for (const row of viewRows) bump(row.listingId).views = Number(row.n);
  for (const row of leadRows) {
    if (row.listingId != null) bump(row.listingId).leads = Number(row.n);
  }
  return out;
}

export interface StatsTotals {
  views: number;
  leads: number;
  /** Listings that got at least one view in the window. */
  listingsSeen: number;
}

export function totalsFrom(stats: Map<number, ListingStats>): StatsTotals {
  let views = 0;
  let leads = 0;
  let listingsSeen = 0;
  for (const s of stats.values()) {
    views += s.views;
    leads += s.leads;
    if (s.views > 0) listingsSeen += 1;
  }
  return { views, leads, listingsSeen };
}

export interface DailyPoint {
  day: string;
  views: number;
}

/**
 * Daily views for one listing inside the caller's scope — the sparkline on its
 * edit page. Returns [] when the listing is out of reach, which is the same
 * answer as "no views", deliberately: a probe learns nothing either way.
 */
export async function getListingDailyViews(
  listingId: number,
  scope: EditScope,
): Promise<DailyPoint[]> {
  const guard = listingScopeWhere(scope);
  const [owned] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(guard ? and(eq(listings.id, listingId), guard) : eq(listings.id, listingId))
    .limit(1);
  if (!owned) return [];

  const rows = await db
    .select({ day: listingViewsDaily.day, views: listingViewsDaily.views })
    .from(listingViewsDaily)
    .where(
      and(
        eq(listingViewsDaily.listingId, listingId),
        gte(listingViewsDaily.day, windowStart()),
      ),
    )
    .orderBy(desc(listingViewsDaily.day));

  return rows.map((r) => ({ day: String(r.day), views: Number(r.views) }));
}
