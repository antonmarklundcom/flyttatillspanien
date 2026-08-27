/**
 * Read queries for the public site (ARCHITECTURE.md §4). All filtering runs
 * on indexed scalar columns (idx_search, idx_location) and normalized
 * price_usd — no MySQL-only cleverness, so the Postgres escape hatch stays
 * open. JSON columns are display-only and never filtered here.
 */
import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../db";
import {
  agencies,
  agents,
  developers,
  financingPrograms,
  listingImages,
  listings,
  locations,
  projects,
  users,
} from "../db/schema";
import type { Operation, PropertyType } from "./import/types";
import { CACHE_TAGS, CACHE_TTL } from "./cache";
import type { VerticalConfig } from "@/config/verticals";
import { facetConds, verticalConds } from "./facet-sql";
import type { ListingFacets, SortOption } from "./facets";

export type { SortOption } from "./facets";

export type LocationRow = typeof locations.$inferSelect;

/**
 * All ciudad-level locations, alphabetical — populates the search bar's city
 * select.
 *
 * The hottest query in the app: the home page, both category routes,
 * /tasacion and the 404 page all render a SearchBar, so before caching this
 * every one of those requests paid a round-trip for a table that only changes
 * when someone runs the seed. Cached under `locations` (src/lib/cache.ts);
 * plain scalars, so nothing to re-wrap on the way out.
 */
const cachedCities = unstable_cache(
  async (): Promise<Pick<LocationRow, "id" | "name" | "slug">[]> =>
    db
      .select({ id: locations.id, name: locations.name, slug: locations.slug })
      .from(locations)
      .where(eq(locations.level, "municipio"))
      .orderBy(asc(locations.name)),
  ["queries:listCities"],
  { revalidate: CACHE_TTL.locations, tags: [CACHE_TAGS.locations] },
);

export async function listCities(): Promise<
  Pick<LocationRow, "id" | "name" | "slug">[]
> {
  return cachedCities();
}

/** A ciudad by slug (slugs are unique per level in our seed). */
export async function resolveCity(citySlug: string): Promise<LocationRow | null> {
  const [row] = await db
    .select()
    .from(locations)
    .where(and(eq(locations.slug, citySlug), eq(locations.level, "municipio")))
    .limit(1);
  return row ?? null;
}

/** A barrio by slug, scoped to its parent ciudad. */
export async function resolveBarrio(
  cityId: number,
  barrioSlug: string,
): Promise<LocationRow | null> {
  const [row] = await db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.slug, barrioSlug),
        eq(locations.level, "zona"),
        eq(locations.parentId, cityId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * City + its barrio children — the location set a city page covers. Served from
 * the same one-read map as locationChain(), so a category page no longer pays a
 * query per subtree lookup.
 */
export async function citySubtreeIds(cityId: number): Promise<number[]> {
  const byId = await locationsById();
  const children: number[] = [];
  for (const row of byId.values()) {
    if (row.parentId === cityId) children.push(row.id);
  }
  return [cityId, ...children];
}

/**
 * The whole `locations` table, keyed by id, loaded once per request.
 *
 * It is a small, slow-changing table (país → departamento → ciudad → barrio;
 * tens of rows, not thousands), and walking a parent chain used to cost one
 * round-trip per level. One read serves every chain on the page instead —
 * cache() dedupes it across generateMetadata and the page body.
 */
const locationsById = cache(async (): Promise<Map<number, LocationRow>> => {
  const rows: LocationRow[] = await db.select().from(locations);
  return new Map(rows.map((row) => [row.id, row]));
});

export async function locationChain(locationId: number): Promise<LocationRow[]> {
  const byId = await locationsById();
  const chain: LocationRow[] = [];
  let currentId: number | null = locationId;
  // The depth guard also stops a cycle from hanging the request, which a
  // hand-edited parent_id could otherwise cause.
  for (let guard = 0; guard < 6 && currentId != null; guard++) {
    const row = byId.get(currentId);
    if (!row) break;
    chain.unshift(row);
    currentId = row.parentId;
  }
  return chain;
}

export interface CategoryQuery {
  operation: Operation;
  locationIds: number[];
  type?: PropertyType;
  limit?: number;
  offset?: number;
  /**
   * The door this request arrived through. Its `filters` narrow every listing
   * query on that domain (`verticalConds`), so the page, its count and its map
   * all describe the same set. Omitted = no hard filter, which is what both
   * live hosts declare today.
   */
  vertical?: VerticalConfig | null;
}

/** The path-level narrowing, as facets. */
function categoryFacets(q: CategoryQuery): ListingFacets {
  return {
    operation: q.operation,
    propertyType: q.type,
    locationIds: q.locationIds,
  };
}

/** Conditions shared by the list query and the count query. */
function categoryConds(q: CategoryQuery) {
  return and(
    eq(listings.status, "published"),
    ...facetConds(categoryFacets(q)),
    ...(q.vertical ? verticalConds(q.vertical) : []),
  );
}

/**
 * User-chosen narrowing on a category page (price/bedrooms/sort). These are
 * NEVER folded into countCategory()/getIndexability() — that SEO signal is
 * about the canonical (operation × location × type) page, not a visitor's
 * transient filter choice (ARCHITECTURE.md §4.3).
 */
export interface CategoryFilters {
  priceMin?: number;
  priceMax?: number;
  minBedrooms?: number;
  sort?: SortOption;
}

/**
 * categoryConds() narrowed by the visitor's own price/bedroom choices.
 *
 * The visitor's fields are named one by one rather than spread: a spread would
 * let a `locationIds` key that happened to be present-and-undefined on `f`
 * overwrite the category's own location set with nothing, which reads as "this
 * city page suddenly lists the whole country".
 */
function filterConds(q: CategoryQuery, f: CategoryFilters) {
  return and(
    eq(listings.status, "published"),
    ...facetConds({
      ...categoryFacets(q),
      priceMin: f.priceMin,
      priceMax: f.priceMax,
      minBedrooms: f.minBedrooms,
    }),
    ...(q.vertical ? verticalConds(q.vertical) : []),
  );
}

function sortOrder(sort: SortOption | undefined) {
  if (sort === "precio_asc") return asc(listings.priceUsd);
  if (sort === "precio_desc") return desc(listings.priceUsd);
  return desc(listings.publishedAt);
}

export type ListingCard = Pick<
  typeof listings.$inferSelect,
  | "id"
  | "publicId"
  | "slug"
  | "title"
  | "operation"
  | "propertyType"
  | "priceUsd"
  | "priceAmount"
  | "priceCurrency"
  | "cuotaGs"
  | "bedrooms"
  | "bathrooms"
  | "areaM2"
  | "landM2"
  | "locationId"
  | "featuredUntil"
> & { coverKey: string | null };

/**
 * Listings for a category page's grid, narrowed by user-chosen filters.
 * filteredCount is ONLY for the page's own "no matches for these filters"
 * empty state — it must never be passed to getIndexability().
 */
export async function getFilteredCategoryListings(
  q: CategoryQuery,
  filters: CategoryFilters = {},
): Promise<{ listings: ListingCard[]; filteredCount: number }> {
  const where = filterConds(q, filters);

  // The grid page and its "no matches" counter do not depend on each other,
  // so they go out together rather than one after the other.
  const [rows, filteredCount] = await Promise.all([
    db
      .select({
        id: listings.id,
        publicId: listings.publicId,
        slug: listings.slug,
        title: listings.title,
        operation: listings.operation,
        propertyType: listings.propertyType,
        priceUsd: listings.priceUsd,
        priceAmount: listings.priceAmount,
        priceCurrency: listings.priceCurrency,
        cuotaGs: listings.cuotaGs,
        bedrooms: listings.bedrooms,
        bathrooms: listings.bathrooms,
        areaM2: listings.areaM2,
        landM2: listings.landM2,
        locationId: listings.locationId,
        featuredUntil: listings.featuredUntil,
      })
      .from(listings)
      .where(where)
      .orderBy(sortOrder(filters.sort))
      .limit(q.limit ?? 48)
      .offset(q.offset ?? 0),
    countRows(where),
  ]);

  const cards = await attachCovers(rows);
  return { listings: cards, filteredCount };
}

/**
 * One COUNT(*) on `listings`. Every counter in this file goes through here:
 * the previous shape selected every matching id and took `rows.length`, which
 * means MySQL streamed the whole result set to Node so we could throw it away —
 * fine at 200 listings, a real cost at 20 000, and it never used the index-only
 * path a COUNT can.
 */
async function countRows(where: SQL | undefined): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(listings)
    .where(where);
  return Number(row?.n ?? 0);
}

/** COUNT for indexability — the single number getIndexability() consumes. */
export async function countCategory(q: CategoryQuery): Promise<number> {
  return countRows(categoryConds(q));
}

/** Attach cover image (position 0) to a set of listing cards in one query. */
async function attachCovers(
  rows: Omit<ListingCard, "coverKey">[],
): Promise<ListingCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const imgs = await db
    .select({
      listingId: listingImages.listingId,
      r2Key: listingImages.r2Key,
      position: listingImages.position,
    })
    .from(listingImages)
    .where(inArray(listingImages.listingId, ids))
    .orderBy(asc(listingImages.position));
  const coverByListing = new Map<number, string>();
  for (const img of imgs) {
    if (!coverByListing.has(img.listingId))
      coverByListing.set(img.listingId, img.r2Key);
  }
  return rows.map((r) => ({ ...r, coverKey: coverByListing.get(r.id) ?? null }));
}

/** Total published listings — the homepage "propiedades activas" stat. */
export async function countPublished(
  vertical?: VerticalConfig | null,
): Promise<number> {
  return countRows(
    and(
      eq(listings.status, "published"),
      ...(vertical ? verticalConds(vertical) : []),
    ),
  );
}

/**
 * Recent published listings, optionally narrowed by operation/type — powers
 * the homepage category rows ("Departamentos en venta", "Alquileres", …).
 */
export async function getRecentListingsBy(
  by: {
    operation?: Operation;
    type?: PropertyType;
    vertical?: VerticalConfig | null;
  },
  limit = 8,
): Promise<ListingCard[]> {
  const rows = await db
    .select(cardColumns())
    .from(listings)
    .where(
      and(
        eq(listings.status, "published"),
        ...facetConds({ operation: by.operation, propertyType: by.type }),
        ...(by.vertical ? verticalConds(by.vertical) : []),
      ),
    )
    .orderBy(desc(listings.publishedAt))
    .limit(limit);
  return attachCovers(rows);
}

/**
 * Other published listings from the same agency — "Más de esta inmobiliaria"
 * (listing detail page) and the agency's own public profile (excludeId
 * omitted there, since there's no one listing to leave out).
 */
export async function getAgencyListings(params: {
  agencyId: number;
  excludeId?: number;
  limit?: number;
}): Promise<ListingCard[]> {
  const conds = [
    eq(listings.status, "published"),
    eq(listings.agencyId, params.agencyId),
  ];
  if (params.excludeId != null) conds.push(ne(listings.id, params.excludeId));
  const rows = await db
    .select(cardColumns())
    .from(listings)
    .where(and(...conds))
    .orderBy(desc(listings.publishedAt))
    .limit(params.limit ?? 4);
  return attachCovers(rows);
}

export type AgencyRow = typeof agencies.$inferSelect;

/** Public agency profile lookup by slug — null if unknown or unverified-empty. */
export async function getAgencyBySlug(slug: string): Promise<AgencyRow | null> {
  const [row] = await db
    .select()
    .from(agencies)
    .where(eq(agencies.slug, slug))
    .limit(1);
  return row ?? null;
}

/** How many published listings an agency has — drives the profile page's indexability. */
export async function countAgencyListings(agencyId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(listings)
    .where(and(eq(listings.status, "published"), eq(listings.agencyId, agencyId)));
  return Number(row?.n ?? 0);
}

export type AgentRow = typeof agents.$inferSelect;

/** Public agent profile lookup by slug — null if unknown. */
export async function getAgentBySlug(slug: string): Promise<AgentRow | null> {
  const [row] = await db
    .select()
    .from(agents)
    .where(eq(agents.slug, slug))
    .limit(1);
  return row ?? null;
}

/** How many published listings an agent has — drives the profile page's indexability. */
export async function countAgentListings(agentId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(listings)
    .where(and(eq(listings.status, "published"), eq(listings.agentId, agentId)));
  return Number(row?.n ?? 0);
}

/**
 * Published listings for an agent's own public profile — mirrors
 * getAgencyListings above (no excludeId there either, for the same reason:
 * there's no one listing to leave out on a profile page).
 */
export async function getAgentListings(params: {
  agentId: number;
  excludeId?: number;
  limit?: number;
}): Promise<ListingCard[]> {
  const conds = [
    eq(listings.status, "published"),
    eq(listings.agentId, params.agentId),
  ];
  if (params.excludeId != null) conds.push(ne(listings.id, params.excludeId));
  const rows = await db
    .select(cardColumns())
    .from(listings)
    .where(and(...conds))
    .orderBy(desc(listings.publishedAt))
    .limit(params.limit ?? 4);
  return attachCovers(rows);
}

/** The agency an agent belongs to (for linking back), or null if independent. */
export async function getAgencyById(agencyId: number): Promise<AgencyRow | null> {
  const [row] = await db
    .select()
    .from(agencies)
    .where(eq(agencies.id, agencyId))
    .limit(1);
  return row ?? null;
}

/** The card-shaped column set — shared by every query that feeds <ListingCard>. */
function cardColumns() {
  return {
    id: listings.id,
    publicId: listings.publicId,
    slug: listings.slug,
    title: listings.title,
    operation: listings.operation,
    propertyType: listings.propertyType,
    priceUsd: listings.priceUsd,
    priceAmount: listings.priceAmount,
    priceCurrency: listings.priceCurrency,
    cuotaGs: listings.cuotaGs,
    bedrooms: listings.bedrooms,
    bathrooms: listings.bathrooms,
    areaM2: listings.areaM2,
    landM2: listings.landM2,
    locationId: listings.locationId,
    featuredUntil: listings.featuredUntil,
  };
}

/** Most recent published listings for the homepage grid. */
export async function getRecentListings(
  limit = 12,
  vertical?: VerticalConfig | null,
): Promise<ListingCard[]> {
  const rows = await db
    .select(cardColumns())
    .from(listings)
    .where(
      and(
        eq(listings.status, "published"),
        ...(vertical ? verticalConds(vertical) : []),
      ),
    )
    .orderBy(desc(listings.publishedAt))
    .limit(limit);
  return attachCovers(rows);
}

/**
 * The publisher of an FSBO ("particular") listing. Not a `users` row: only the
 * three fields the detail page may show, so a query that widens later cannot
 * leak an email or a password hash onto a public page.
 */
export interface ListingOwner {
  name: string | null;
  whatsapp: string | null;
  whatsappVerifiedAt: Date | null;
}

export interface ListingDetail {
  listing: typeof listings.$inferSelect;
  images: (typeof listingImages.$inferSelect)[];
  chain: LocationRow[];
  agency: typeof agencies.$inferSelect | null;
  agent: typeof agents.$inferSelect | null;
  /**
   * Set only for a listing published through /publicar by someone who belongs
   * to no agency. It is the third link in the contact chain (agent → agency →
   * owner); without it a self-published listing renders no way to reach the
   * seller at all (audit F4).
   */
  ownerUser: ListingOwner | null;
}

/** Full listing for the detail page, by public_id. Null if not published. */
export async function getListingByPublicId(
  publicId: string,
): Promise<ListingDetail | null> {
  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.publicId, publicId))
    .limit(1);
  if (!listing || listing.status !== "published") return null;

  // Images, location chain, agency and agent depend only on the listing row,
  // never on each other — awaiting them in sequence made one detail page up
  // to four serial round-trips where one suffices.
  const [images, chain, agency, agent, ownerUser] = await Promise.all([
    db
      .select()
      .from(listingImages)
      .where(eq(listingImages.listingId, listing.id))
      .orderBy(asc(listingImages.position)),
    locationChain(listing.locationId),
    listing.agencyId
      ? db
          .select()
          .from(agencies)
          .where(eq(agencies.id, listing.agencyId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    listing.agentId
      ? db
          .select()
          .from(agents)
          .where(eq(agents.id, listing.agentId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    // Only when nobody professional owns the row: an agency's or agent's own
    // number always wins, so this query never runs for the common case.
    listing.ownerUserId && !listing.agentId && !listing.agencyId
      ? db
          .select({
            name: users.name,
            whatsapp: users.whatsapp,
            whatsappVerifiedAt: users.whatsappVerifiedAt,
          })
          .from(users)
          .where(eq(users.id, listing.ownerUserId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  return { listing, images, chain, agency, agent, ownerUser };
}

/** Same operación + tipo, same city subtree, excluding the listing itself. */
export async function getSimilarListings(params: {
  excludeId: number;
  operation: Operation;
  type: PropertyType;
  locationIds: number[];
  limit?: number;
  vertical?: VerticalConfig | null;
}): Promise<ListingCard[]> {
  const rows = await db
    .select(cardColumns())
    .from(listings)
    .where(
      and(
        eq(listings.status, "published"),
        ...facetConds({
          operation: params.operation,
          propertyType: params.type,
          locationIds: params.locationIds,
        }),
        ne(listings.id, params.excludeId),
        ...(params.vertical ? verticalConds(params.vertical) : []),
      ),
    )
    .orderBy(desc(listings.publishedAt))
    .limit(params.limit ?? 4);
  return attachCovers(rows);
}

/* ------------------------------------------------------------------ */
/* Projects (preventas / edificios) — homepage carousel + /proyecto    */
/* ------------------------------------------------------------------ */

export interface ProjectCard {
  id: number;
  name: string;
  slug: string;
  projectType: string;
  stage: string | null;
  deliveryDate: string | Date | null;
  heroImageUrl: string | null;
  developerName: string | null;
  cityName: string | null;
  minPriceUsd: number | null;
  availableUnits: number;
}

/** Aggregate unit facts (min price / count) for a set of project ids. */
async function projectUnitStats(projectIds: number[]) {
  if (projectIds.length === 0)
    return new Map<number, { minPriceUsd: number; units: number }>();
  const rows = await db
    .select({
      projectId: listings.projectId,
      minPriceUsd: sql<string>`MIN(${listings.priceUsd})`,
      units: sql<number>`COUNT(*)`,
    })
    .from(listings)
    .where(
      and(
        eq(listings.status, "published"),
        inArray(listings.projectId, projectIds),
      ),
    )
    .groupBy(listings.projectId);
  return new Map(
    rows
      .filter((r) => r.projectId != null)
      .map((r) => [
        r.projectId as number,
        { minPriceUsd: Number(r.minPriceUsd), units: Number(r.units) },
      ]),
  );
}

/** Newest projects with developer + city + unit stats — homepage carousel. */
export async function getFeaturedProjects(limit = 6): Promise<ProjectCard[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      projectType: projects.projectType,
      stage: projects.stage,
      deliveryDate: projects.deliveryDate,
      heroImageUrl: projects.heroImageUrl,
      developerName: developers.name,
      cityName: locations.name,
    })
    .from(projects)
    .leftJoin(developers, eq(projects.developerId, developers.id))
    .leftJoin(locations, eq(projects.locationId, locations.id))
    .orderBy(desc(projects.id))
    .limit(limit);
  return projectCardsFrom(rows);
}

/**
 * Attach unit stats to project rows already selected with the ProjectCard
 * columns. Shared so the /proyectos index (directory-queries.ts) produces
 * cards identical to the homepage carousel's.
 */
export async function projectCardsFrom(
  rows: Omit<ProjectCard, "minPriceUsd" | "availableUnits">[],
): Promise<ProjectCard[]> {
  const stats = await projectUnitStats(rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    minPriceUsd: stats.get(r.id)?.minPriceUsd ?? null,
    availableUnits: stats.get(r.id)?.units ?? 0,
  }));
}

export interface DeveloperCard {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  projectCount: number;
}

/** Developers with at least one project — "Desarrolladoras destacadas". */
export async function getFeaturedDevelopers(limit = 8): Promise<DeveloperCard[]> {
  const rows = await db
    .select({
      id: developers.id,
      name: developers.name,
      slug: developers.slug,
      logoUrl: developers.logoUrl,
      projectCount: sql<number>`COUNT(${projects.id})`,
    })
    .from(developers)
    .innerJoin(projects, eq(projects.developerId, developers.id))
    .groupBy(developers.id, developers.name, developers.slug, developers.logoUrl)
    .orderBy(desc(sql`COUNT(${projects.id})`))
    .limit(limit);
  return rows.map((r) => ({ ...r, projectCount: Number(r.projectCount) }));
}

export interface ProjectUnit {
  id: number;
  publicId: string;
  slug: string;
  title: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaM2: string | null;
  priceUsd: string;
  priceAmount: string;
  priceCurrency: "USD" | "PYG";
  propertyState: string | null;
}

/** Full project detail: project + developer + location chain + its units. */
export async function getProjectBySlug(slug: string) {
  const [row] = await db
    .select({
      project: projects,
      developer: developers,
      location: locations,
    })
    .from(projects)
    .leftJoin(developers, eq(projects.developerId, developers.id))
    .leftJoin(locations, eq(projects.locationId, locations.id))
    .where(eq(projects.slug, slug))
    .limit(1);
  if (!row) return null;

  const units: ProjectUnit[] = await db
    .select({
      id: listings.id,
      publicId: listings.publicId,
      slug: listings.slug,
      title: listings.title,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      areaM2: listings.areaM2,
      priceUsd: listings.priceUsd,
      priceAmount: listings.priceAmount,
      priceCurrency: listings.priceCurrency,
      propertyState: listings.propertyState,
    })
    .from(listings)
    .where(
      and(eq(listings.status, "published"), eq(listings.projectId, row.project.id)),
    )
    .orderBy(asc(listings.priceUsd));

  // Other projects by the same developer (for the "Otros proyectos" row).
  const siblings = row.project.developerId
    ? await db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          projectType: projects.projectType,
          stage: projects.stage,
          deliveryDate: projects.deliveryDate,
          heroImageUrl: projects.heroImageUrl,
          developerName: developers.name,
          cityName: locations.name,
        })
        .from(projects)
        .leftJoin(developers, eq(projects.developerId, developers.id))
        .leftJoin(locations, eq(projects.locationId, locations.id))
        .where(
          and(
            eq(projects.developerId, row.project.developerId),
            ne(projects.id, row.project.id),
          ),
        )
        .limit(6)
    : [];
  const sibStats = await projectUnitStats(siblings.map((s) => s.id));
  const otherProjects: ProjectCard[] = siblings.map((s) => ({
    ...s,
    minPriceUsd: sibStats.get(s.id)?.minPriceUsd ?? null,
    availableUnits: sibStats.get(s.id)?.units ?? 0,
  }));

  return { ...row, units, otherProjects };
}

/** Best active financing program (lowest rate) — listing cuota module. */
export async function getBestFinancingProgram() {
  const [row] = await db
    .select()
    .from(financingPrograms)
    .where(eq(financingPrograms.active, true))
    .orderBy(asc(financingPrograms.annualRate))
    .limit(1);
  return row ?? null;
}
