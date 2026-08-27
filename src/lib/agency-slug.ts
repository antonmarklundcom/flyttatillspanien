/**
 * A unique `agencies.slug`. Shared by the two code paths that create an
 * agency: public self-registration (`src/lib/registration.ts`) and the
 * super-admin "create agency" form (`/admin/inmobiliarias`).
 *
 * The column is unique and slugs are never recomputed later, so a collision
 * has to be resolved *here* — "Inmobiliaria Central" twice becomes central and
 * central-2, and the second agency keeps that URL for good.
 */
import "server-only";
import { like } from "drizzle-orm";
import { db } from "@/db";
import { agencies } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { startsWithPattern } from "@/lib/sql-like";

export async function uniqueAgencySlug(name: string): Promise<string> {
  const base = slugify(name) || "inmobiliaria";
  const taken = new Set(
    (
      await db
        .select({ slug: agencies.slug })
        .from(agencies)
        .where(like(agencies.slug, startsWithPattern(base)))
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Pathological case only; the timestamp keeps the insert from failing.
  return `${base}-${Date.now()}`;
}
