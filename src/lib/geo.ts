/**
 * The display coordinate: one rule, one expression, one place.
 *
 * A listing is plotted at its own lat/lng when it has one and at its barrio or
 * city centroid when it does not (src/lib/map-queries.ts explains why borrowing
 * beats dropping the pin). That used to be a `coalesce(listings.lat,
 * locations.lat)` inside the bounding-box WHERE, which is correct and
 * unindexable: a function of two columns — one of them on a joined table — is
 * not a range MySQL can seek, so `idx_geo` sat unused and every map pan scanned
 * the published set (audit F38).
 *
 * So the coalesce moved to write time. `listings.display_lat` / `display_lng`
 * hold the answer, `idx_geo` covers `(status, display_lat, display_lng)`, and
 * the bbox query is a plain range scan over one table.
 *
 * The cost of materialising is staleness, and it has exactly two sources:
 *
 *  1. **A listing's own `lat`/`lng`/`location_id` changed.** Every writer that
 *     touches one of those calls `syncDisplayCoords()` immediately after, in
 *     the same transaction where there is one. A writer that only changes
 *     status, price or ownership does not need it.
 *  2. **A location's centroid moved** (`scripts/seed-locations.ts`, or an
 *     operator fixing a barrio). That invalidates every listing borrowing it,
 *     which no single-row hook can see — `npm run cron:geo`
 *     (`syncAllDisplayCoords`) repairs the table in one statement.
 *
 * Both paths run the same SQL, below, so they cannot drift apart.
 */
import "server-only";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { db as Db } from "@/db";
import { listings, locations } from "@/db/schema";

/**
 * Anything that can run a statement: the pool, or a transaction handle. Taken
 * as a parameter — and `db` imported as a *type* — so that importing this
 * module never builds the connection pool. `src/db/index.ts` creates the pool
 * at module load, and the import pipeline is reachable from CLI scripts that
 * have no database at all.
 */
type DbConn = typeof Db | Parameters<Parameters<(typeof Db)["transaction"]>[0]>[0];

/**
 * The rule itself. `UPDATE ... JOIN` rather than a correlated subquery because
 * it reads identically for one row and for the whole table, and because the
 * join is on `locations.id` — a primary-key lookup either way.
 *
 * Written as raw SQL rather than through drizzle's `.update()` on purpose:
 * `listings.updatedAt` carries a JS-side `$onUpdate`, so an ORM update here
 * would bump `updated_at` and move the row's sitemap `lastmod` for a
 * recomputation the visitor cannot see. The same reasoning as the
 * `published_at` COALESCE in panel-queries.ts.
 */
function syncStatement(where: SQL): SQL {
  return sql`
    update ${listings}
      join ${locations} on ${locations.id} = ${listings.locationId}
       set ${listings.displayLat} = coalesce(${listings.lat}, ${locations.lat}),
           ${listings.displayLng} = coalesce(${listings.lng}, ${locations.lng})
     where ${where}`;
}

/**
 * Recompute one listing's display coordinate. Call it after any write that
 * touched `lat`, `lng` or `location_id` — including a rollback that restores
 * them.
 *
 * A listing whose `location_id` points at no row keeps whatever it had: the
 * join drops it. That is the same set the map has always shown, because the
 * bbox query joined `locations` too.
 */
export async function syncDisplayCoords(
  conn: DbConn,
  listingId: number,
): Promise<void> {
  await conn.execute(syncStatement(eq(listings.id, listingId)));
}

/**
 * Recompute the whole table. Cheap enough to run unconditionally at this
 * inventory (one indexed join, no round-trip per row) and the only repair for
 * a centroid that moved. `npm run cron:geo`, and the last step of
 * `npm run seed:locations`.
 */
export async function syncAllDisplayCoords(conn: DbConn): Promise<void> {
  await conn.execute(syncStatement(sql`1 = 1`));
}

/**
 * Rows the map would silently drop: no own coordinate and no centroid to
 * borrow. Reported by `cron:geo` and `db:status` because the failure mode is
 * invisible — the listing renders everywhere except the map.
 */
export async function countListingsWithoutPosition(
  conn: DbConn,
): Promise<number> {
  const [row] = await conn
    .select({ n: sql<number>`count(*)` })
    .from(listings)
    .where(and(eq(listings.status, "published"), isNull(listings.displayLat)));
  return Number(row?.n ?? 0);
}
