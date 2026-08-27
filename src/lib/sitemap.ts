/**
 * Sitemap builder (ARCHITECTURE.md §4). Emits listing detail URLs + every
 * INDEXABLE category page — using the SAME getIndexability() rule the page
 * templates use, so the sitemap and the pages can never disagree (that
 * agreement is what keeps this out of doorway-page territory).
 *
 * One query for listings + one for locations, aggregated in memory. At 15k
 * listings this is trivial.
 *
 * This module decides *what* is in the sitemap — the part that has to agree
 * with `getIndexability()` and `hostOwnsListingDetail()`. Caching, chunking
 * and the XML itself live in `sitemap-xml.ts` (audit F43).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  agencies,
  agents,
  developers,
  listings,
  locations,
  projects,
} from "../db/schema";
import { getIndexability } from "./indexability";
import { citiesWithPrices } from "./precios-queries";
import { categoryUrl, agencyUrl, agentUrl } from "./urls";
import { STATIC_SITEMAP_PATHS } from "../config/site-nav";
import { listPublishedPostSlugs } from "./post-queries";
import { listingUrl } from "./urls";
import type { Operation, PropertyType } from "./import/types";
import type { VerticalConfig } from "@/config/verticals";
import { verticalConds } from "./facet-sql";

export interface SitemapEntry {
  path: string;
  lastmod?: Date;
}

export interface SitemapOptions {
  /**
   * Whether to emit /bostad/{slug} URLs. False on a host whose listing
   * detail pages canonicalise to another domain (`ownsListingDetail: false` in
   * `src/config/verticals.ts`): such a host still owns its home, search,
   * category and guide pages, but submitting listing URLs it canonicalises
   * away earns "submitted URL not selected as canonical" in Search Console.
   * The caller passes `hostOwnsListingDetail()` from `src/lib/origin.ts`, so
   * the sitemap and the canonical tag are decided by the same predicate.
   */
  includeListingDetail?: boolean;
  /**
   * The door this sitemap is for. Its `filters` narrow the published rows the
   * same way they narrow every page on that host — a sitemap that lists URLs
   * the host would render empty is the same Search Console error as listing
   * URLs it canonicalises away, arrived at from the other direction.
   */
  vertical?: VerticalConfig | null;
}

export async function buildSitemapEntries(
  opts: SitemapOptions = {},
): Promise<SitemapEntry[]> {
  const { includeListingDetail = true, vertical = null } = opts;
  const locs = await db
    .select({
      id: locations.id,
      slug: locations.slug,
      level: locations.level,
      parentId: locations.parentId,
    })
    .from(locations);
  const locById = new Map(locs.map((l) => [l.id, l]));

  const pub = await db
    .select({
      slug: listings.slug,
      publicId: listings.publicId,
      updatedAt: listings.updatedAt,
      locationId: listings.locationId,
      operation: listings.operation,
      propertyType: listings.propertyType,
      agencyId: listings.agencyId,
      agentId: listings.agentId,
    })
    .from(listings)
    .where(
      and(
        eq(listings.status, "published"),
        ...(vertical ? verticalConds(vertical) : []),
      ),
    );

  // 0. Hand-authored pages (home, company, sales, guides, legal). Listed in
  //    src/config/site-nav.ts next to the nav that links them, so a new page
  //    can't be added to the menu and forgotten by the sitemap.
  const entries: SitemapEntry[] = STATIC_SITEMAP_PATHS.map((path) => ({ path }));

  // 1. Listing detail pages — always indexable when published, but only on a
  //    host that actually owns them. The published rows are still read either
  //    way: the category, agency and agent sections below count them to decide
  //    what IS indexable here, and those pages are this host's own.
  if (includeListingDetail) {
    for (const l of pub) {
      entries.push({
        path: listingUrl({ slug: l.slug, publicId: l.publicId }),
        lastmod: l.updatedAt,
      });
    }
  }

  // 2. Aggregate category counts (city, city-type, barrio-type).
  const cityCount = new Map<string, number>();
  const cityTypeCount = new Map<string, number>();
  const barrioTypeCount = new Map<string, number>();

  const cityOf = (locationId: number) => {
    const loc = locById.get(locationId);
    if (!loc) return null;
    if (loc.level === "ciudad") return loc;
    if (loc.level === "barrio" && loc.parentId)
      return locById.get(loc.parentId) ?? null;
    return null;
  };

  for (const l of pub) {
    const loc = locById.get(l.locationId);
    const city = cityOf(l.locationId);
    if (!city) continue;
    const op = l.operation as Operation;
    const type = l.propertyType as PropertyType;

    cityCount.set(`${op}|${city.id}`, (cityCount.get(`${op}|${city.id}`) ?? 0) + 1);
    cityTypeCount.set(
      `${op}|${city.id}|${type}`,
      (cityTypeCount.get(`${op}|${city.id}|${type}`) ?? 0) + 1,
    );
    if (loc && loc.level === "barrio") {
      barrioTypeCount.set(
        `${op}|${loc.id}|${type}`,
        (barrioTypeCount.get(`${op}|${loc.id}|${type}`) ?? 0) + 1,
      );
    }
  }

  for (const [key, n] of cityCount) {
    const [op, cityId] = key.split("|");
    const city = locById.get(Number(cityId));
    if (!city) continue;
    if (getIndexability({ listingCount: n }).state === "index") {
      entries.push({
        path: categoryUrl({ operation: op as Operation, citySlug: city.slug }),
      });
    }
  }

  const cityTypeIndexable = new Set<string>();
  for (const [key, n] of cityTypeCount) {
    const [op, cityId, type] = key.split("|");
    const city = locById.get(Number(cityId));
    if (!city) continue;
    if (getIndexability({ listingCount: n }).state === "index") {
      cityTypeIndexable.add(key);
      entries.push({
        path: categoryUrl({
          operation: op as Operation,
          citySlug: city.slug,
          type: type as PropertyType,
        }),
      });
    }
  }

  for (const [key, n] of barrioTypeCount) {
    const [op, barrioId, type] = key.split("|");
    const barrio = locById.get(Number(barrioId));
    if (!barrio || !barrio.parentId) continue;
    const city = locById.get(barrio.parentId);
    if (!city) continue;
    // Barrio pages require an indexable parent — and the parent the PAGE
    // checks is the city+type page (count ≥ 3 for the same type), not the
    // all-types city page. Keying this on the city count submitted URLs the
    // template rendered noindex — Search Console's "submitted URL not
    // selected as canonical" (audit F8).
    const parentIndexable = cityTypeIndexable.has(`${op}|${city.id}|${type}`);
    if (
      getIndexability({ listingCount: n, parentIndexable }).state === "index"
    ) {
      entries.push({
        path: categoryUrl({
          operation: op as Operation,
          citySlug: city.slug,
          barrioSlug: barrio.slug,
          type: type as PropertyType,
        }),
      });
    }
  }

  // 3. Price pages — only cities with a defensible sample, which is the same
  //    rule the page's own robots meta applies. Sitemap and page must agree.
  const priceCities = await citiesWithPrices();
  for (const city of priceCities) {
    entries.push({ path: `/precios/${city.slug}` });
  }

  // 4. Agency profile pages — same MIN_INDEXABLE rule as everything else
  //    (src/lib/indexability.ts), so a brand-new agency with 1-2 listings
  //    isn't a thin page in the sitemap even though its own page still renders.
  const agencyCount = new Map<number, number>();
  for (const l of pub) {
    if (l.agencyId == null) continue;
    agencyCount.set(l.agencyId, (agencyCount.get(l.agencyId) ?? 0) + 1);
  }
  const indexableAgencyIds = [...agencyCount.entries()]
    .filter(([, n]) => getIndexability({ listingCount: n }).state === "index")
    .map(([id]) => id);
  if (indexableAgencyIds.length > 0) {
    const agencySlugs = await db
      .select({ slug: agencies.slug })
      .from(agencies)
      .where(inArray(agencies.id, indexableAgencyIds));
    for (const a of agencySlugs) {
      entries.push({ path: agencyUrl(a.slug) });
    }
  }

  // 5. Agent profile pages — same MIN_INDEXABLE rule, same reasoning as
  //    agencies above (§4 keeps sitemap and page in agreement).
  const agentCount = new Map<number, number>();
  for (const l of pub) {
    if (l.agentId == null) continue;
    agentCount.set(l.agentId, (agentCount.get(l.agentId) ?? 0) + 1);
  }
  const indexableAgentIds = [...agentCount.entries()]
    .filter(([, n]) => getIndexability({ listingCount: n }).state === "index")
    .map(([id]) => id);
  if (indexableAgentIds.length > 0) {
    const agentSlugs = await db
      .select({ slug: agents.slug })
      .from(agents)
      .where(inArray(agents.id, indexableAgentIds));
    for (const a of agentSlugs) {
      entries.push({ path: agentUrl(a.slug) });
    }
  }

  // 6. Projects and developers. Unlike listings and categories these have no
  //    thin-page risk to gate on — a project page carries its own units and a
  //    developer page its own projects — but a developer with no project at
  //    all is excluded, matching the noindex its page sets for that case.
  const projectRows = await db
    .select({ slug: projects.slug, developerId: projects.developerId })
    .from(projects);
  for (const p of projectRows) {
    entries.push({ path: `/proyecto/${p.slug}` });
  }

  const developerIds = [
    ...new Set(
      projectRows
        .map((p) => p.developerId)
        .filter((id): id is number => id != null),
    ),
  ];
  if (developerIds.length > 0) {
    const devSlugs = await db
      .select({ slug: developers.slug })
      .from(developers)
      .where(inArray(developers.id, developerIds));
    for (const d of devSlugs) {
      entries.push({ path: `/desarrolladora/${d.slug}` });
    }
  }

  // 7. Editorial posts. listPublishedPostSlugs() is fail-soft on a missing
  //    table, so a sitemap request between deploy and `db:migrate` returns the
  //    rest of the site rather than erroring.
  for (const post of await listPublishedPostSlugs()) {
    entries.push({
      path: `/guias/${post.slug}`,
      lastmod: post.updatedAt ?? undefined,
    });
  }

  return entries;
}
