/**
 * Repair every listing's display coordinate (audit F38).
 *
 * `listings.display_lat/display_lng` are "the listing's own coordinate, else
 * its location's centroid", materialised at write time so the map's bounding
 * box can use `idx_geo` (src/lib/geo.ts explains why the old per-query
 * `coalesce` could not). Every writer that touches `lat`, `lng` or
 * `location_id` keeps its own row current, so this script exists for the one
 * staleness no row-level hook can see: **a centroid moved**, and every listing
 * borrowing it is now plotted at the old spot.
 *
 * Run it after `npm run seed:locations`, after any manual edit of
 * `locations.lat/lng`, and harmlessly whenever you are unsure — it recomputes
 * from the same expression the migration and the app use, so a table that is
 * already correct is left byte-identical.
 *
 *   DATABASE_URL="mysql://..." npm run cron:geo
 *   DATABASE_URL="mysql://..." npm run cron:geo -- --dry
 *
 * `--dry` reports how many published rows would change position without
 * writing, the same shape as `cron:resync`.
 */
import { eq, or, sql } from "drizzle-orm";
import { db } from "../src/db";
import { listings, locations } from "../src/db/schema";
import {
  countListingsWithoutPosition,
  syncAllDisplayCoords,
} from "../src/lib/geo";

const dry = process.argv.includes("--dry");

async function main() {
  /**
   * Rows whose stored display coordinate disagrees with what the rule says it
   * should be. `<=>` is MySQL's NULL-safe equality — plain `!=` would call
   * every NULL-to-NULL pair a difference and report the whole table as stale.
   */
  const [drift] = await db
    .select({ n: sql<number>`count(*)` })
    .from(listings)
    .innerJoin(locations, eq(locations.id, listings.locationId))
    .where(
      or(
        sql`not (${listings.displayLat} <=> coalesce(${listings.lat}, ${locations.lat}))`,
        sql`not (${listings.displayLng} <=> coalesce(${listings.lng}, ${locations.lng}))`,
      ),
    );

  const stale = Number(drift?.n ?? 0);
  console.log(`${stale} listing(s) plotted at a stale position.`);

  if (dry) {
    console.log("--dry: nothing written.");
  } else {
    await syncAllDisplayCoords(db);
    console.log("display coordinates recomputed.");
  }

  /**
   * Not an error, but worth saying out loud: these listings render everywhere
   * except the map, and nothing else in the app will ever mention it.
   */
  const orphans = await countListingsWithoutPosition(db);
  if (orphans > 0) {
    console.log(
      `\n${orphans} published listing(s) have no position at all — no coordinate\n` +
        "of their own and a location with no centroid. They are invisible on the\n" +
        "map. Fix by giving the location a lat/lng (seed:locations) or the\n" +
        "listing its own.",
    );
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
