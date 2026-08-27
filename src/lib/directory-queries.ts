/**
 * Read queries for the public directory + institutional pages
 * (/inmobiliarias, /proyectos, /financiamiento).
 *
 * Separate from queries.ts on purpose: that module is the hot path for
 * search, category and detail pages. These run on a handful of low-traffic
 * pages and aggregate across whole tables, so keeping them apart keeps the
 * hot module's surface honest.
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  agencies,
  agents,
  developers,
  financingPrograms,
  listings,
  locations,
  projects,
} from "../db/schema";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_TTL } from "./cache";
import { projectCardsFrom } from "./queries";
import type { ProjectCard } from "./queries";

export interface AgencyDirectoryRow {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  isVerified: boolean;
  plan: "free" | "destacado" | "partner";
  listingCount: number;
  agentCount: number;
  /** Cities where this agency has published inventory, most listings first. */
  cities: string[];
}

/**
 * Every agency that has at least one published listing, ordered by plan then
 * inventory size. Agencies with nothing live are excluded — a directory of
 * empty profiles is worse than a short directory.
 */
async function listAgenciesForDirectoryUncached(): Promise<AgencyDirectoryRow[]> {
  const rows = await db
    .select({
      id: agencies.id,
      name: agencies.name,
      slug: agencies.slug,
      logoUrl: agencies.logoUrl,
      isVerified: agencies.isVerified,
      plan: agencies.plan,
      listingCount: sql<number>`COUNT(DISTINCT ${listings.id})`,
    })
    .from(agencies)
    .innerJoin(
      listings,
      and(
        eq(listings.agencyId, agencies.id),
        eq(listings.status, "published"),
      ),
    )
    .groupBy(
      agencies.id,
      agencies.name,
      agencies.slug,
      agencies.logoUrl,
      agencies.isVerified,
      agencies.plan,
    )
    .orderBy(desc(sql`COUNT(DISTINCT ${listings.id})`));

  if (rows.length === 0) return [];

  // City spread + team size, one query each rather than N per agency.
  // Listings hang off either a ciudad or one of its barrios, so the location
  // names are rolled up to ciudad level in memory — a directory card saying
  // "Recoleta · Villa Morra" instead of "Asunción" reads as noise.
  const [locRows, listingLocRows, agentRows] = await Promise.all([
    db
      .select({
        id: locations.id,
        name: locations.name,
        level: locations.level,
        parentId: locations.parentId,
      })
      .from(locations),
    db
      .select({
        agencyId: listings.agencyId,
        locationId: listings.locationId,
        n: sql<number>`COUNT(*)`,
      })
      .from(listings)
      .where(eq(listings.status, "published"))
      .groupBy(listings.agencyId, listings.locationId),
    db
      .select({ agencyId: agents.agencyId, n: sql<number>`COUNT(*)` })
      .from(agents)
      .groupBy(agents.agencyId),
  ]);

  const locById = new Map(locRows.map((l) => [l.id, l]));
  const cityNameOf = (locationId: number): string | null => {
    const loc = locById.get(locationId);
    if (!loc) return null;
    if (loc.level === "municipio") return loc.name;
    const parent = loc.parentId != null ? locById.get(loc.parentId) : undefined;
    return parent?.level === "municipio" ? parent.name : null;
  };

  // Rank cities by how much inventory the agency has there, keep the top 3.
  const cityTotals = new Map<number, Map<string, number>>();
  for (const r of listingLocRows) {
    if (r.agencyId == null) continue;
    const city = cityNameOf(r.locationId);
    if (!city) continue;
    const totals = cityTotals.get(r.agencyId) ?? new Map<string, number>();
    totals.set(city, (totals.get(city) ?? 0) + Number(r.n));
    cityTotals.set(r.agencyId, totals);
  }
  const citiesByAgency = new Map<number, string[]>(
    [...cityTotals].map(([agencyId, totals]) => [
      agencyId,
      [...totals]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name),
    ]),
  );
  const agentsByAgency = new Map(
    agentRows
      .filter((r) => r.agencyId != null)
      .map((r) => [r.agencyId as number, Number(r.n)]),
  );

  const planRank: Record<string, number> = { partner: 0, destacado: 1, free: 2 };
  return rows
    .map((r) => ({
      ...r,
      listingCount: Number(r.listingCount),
      agentCount: agentsByAgency.get(r.id) ?? 0,
      cities: citiesByAgency.get(r.id) ?? [],
    }))
    .sort(
      (a, b) =>
        (planRank[a.plan] ?? 9) - (planRank[b.plan] ?? 9) ||
        b.listingCount - a.listingCount,
    );
}

/** Every project, newest first — the /proyectos index. */
async function listAllProjectsUncached(limit = 60): Promise<ProjectCard[]> {
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

export type FinancingProgramRow = typeof financingPrograms.$inferSelect;

/** Active financing programs, cheapest rate first — /financiamiento. */
async function listFinancingProgramsUncached(): Promise<FinancingProgramRow[]> {
  return db
    .select()
    .from(financingPrograms)
    .where(eq(financingPrograms.active, true))
    .orderBy(asc(financingPrograms.annualRate));
}

export interface DeveloperDirectoryRow {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  projectCount: number;
  unitCount: number;
  cities: string[];
  stages: string[];
}

/** Developers with at least one project — the /desarrolladoras index. */
async function listDevelopersForDirectoryUncached(): Promise<
  DeveloperDirectoryRow[]
> {
  const rows = await db
    .select({
      id: developers.id,
      name: developers.name,
      slug: developers.slug,
      logoUrl: developers.logoUrl,
      website: developers.website,
      projectId: projects.id,
      stage: projects.stage,
      cityName: locations.name,
    })
    .from(developers)
    .innerJoin(projects, eq(projects.developerId, developers.id))
    .leftJoin(locations, eq(projects.locationId, locations.id))
    .orderBy(asc(developers.name));

  if (rows.length === 0) return [];

  // Published units per project, so a card can say "3 proyectos · 48 unidades".
  const unitRows = await db
    .select({ projectId: listings.projectId, n: sql<number>`COUNT(*)` })
    .from(listings)
    .where(eq(listings.status, "published"))
    .groupBy(listings.projectId);
  const unitsByProject = new Map(
    unitRows
      .filter((r) => r.projectId != null)
      .map((r) => [r.projectId as number, Number(r.n)]),
  );

  const byId = new Map<number, DeveloperDirectoryRow>();
  for (const r of rows) {
    const entry = byId.get(r.id) ?? {
      id: r.id,
      name: r.name,
      slug: r.slug,
      logoUrl: r.logoUrl,
      website: r.website,
      projectCount: 0,
      unitCount: 0,
      cities: [],
      stages: [],
    };
    entry.projectCount += 1;
    entry.unitCount += unitsByProject.get(r.projectId) ?? 0;
    if (r.cityName && !entry.cities.includes(r.cityName))
      entry.cities.push(r.cityName);
    if (r.stage && !entry.stages.includes(r.stage)) entry.stages.push(r.stage);
    byId.set(r.id, entry);
  }

  return [...byId.values()].sort((a, b) => b.projectCount - a.projectCount);
}

export type DeveloperRow = typeof developers.$inferSelect;

/** Public developer profile: the row plus every project it is building. */
export async function getDeveloperBySlug(
  slug: string,
): Promise<{ developer: DeveloperRow; projects: ProjectCard[] } | null> {
  const [developer] = await db
    .select()
    .from(developers)
    .where(eq(developers.slug, slug))
    .limit(1);
  if (!developer) return null;

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
    .innerJoin(developers, eq(projects.developerId, developers.id))
    .leftJoin(locations, eq(projects.locationId, locations.id))
    .where(eq(projects.developerId, developer.id))
    .orderBy(desc(projects.id));

  return { developer, projects: await projectCardsFrom(rows) };
}

export interface AgentDirectoryRow {
  id: number;
  name: string;
  slug: string;
  photoUrl: string | null;
  isVerified: boolean;
  agencyName: string | null;
  agencySlug: string | null;
  listingCount: number;
  cities: string[];
}

/**
 * Agents with published inventory — the /agentes index. Same rule as the
 * agency directory: an agent with nothing live is not listed, because a
 * directory of empty profiles helps nobody and dilutes crawl budget.
 */
async function listAgentsForDirectoryUncached(): Promise<AgentDirectoryRow[]> {
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      slug: agents.slug,
      photoUrl: agents.photoUrl,
      isVerified: agents.isVerified,
      agencyName: agencies.name,
      agencySlug: agencies.slug,
      listingCount: sql<number>`COUNT(DISTINCT ${listings.id})`,
    })
    .from(agents)
    .innerJoin(
      listings,
      and(eq(listings.agentId, agents.id), eq(listings.status, "published")),
    )
    .leftJoin(agencies, eq(agents.agencyId, agencies.id))
    .groupBy(
      agents.id,
      agents.name,
      agents.slug,
      agents.photoUrl,
      agents.isVerified,
      agencies.name,
      agencies.slug,
    )
    .orderBy(desc(sql`COUNT(DISTINCT ${listings.id})`));

  if (rows.length === 0) return [];

  const [locRows, listingLocRows] = await Promise.all([
    db
      .select({
        id: locations.id,
        name: locations.name,
        level: locations.level,
        parentId: locations.parentId,
      })
      .from(locations),
    db
      .select({
        agentId: listings.agentId,
        locationId: listings.locationId,
        n: sql<number>`COUNT(*)`,
      })
      .from(listings)
      .where(eq(listings.status, "published"))
      .groupBy(listings.agentId, listings.locationId),
  ]);

  const locById = new Map(locRows.map((l) => [l.id, l]));
  const cityTotals = new Map<number, Map<string, number>>();
  for (const r of listingLocRows) {
    if (r.agentId == null) continue;
    const loc = locById.get(r.locationId);
    if (!loc) continue;
    const city =
      loc.level === "municipio"
        ? loc.name
        : loc.parentId != null && locById.get(loc.parentId)?.level === "municipio"
          ? locById.get(loc.parentId)!.name
          : null;
    if (!city) continue;
    const totals = cityTotals.get(r.agentId) ?? new Map<string, number>();
    totals.set(city, (totals.get(city) ?? 0) + Number(r.n));
    cityTotals.set(r.agentId, totals);
  }

  return rows.map((r) => ({
    ...r,
    listingCount: Number(r.listingCount),
    cities: [...(cityTotals.get(r.id) ?? new Map())]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name),
  }));
}

export interface OperationHubData {
  total: number;
  cities: { name: string; slug: string; count: number }[];
  types: { type: string; count: number }[];
}

/**
 * Counts behind the national /venta and /alquiler hubs: one pass over the
 * published rows of that operation, bucketed by city and by property type.
 * The hubs are the entry point competitors have at /venta and /alquiler and
 * this portal simply 404'd on, since the category route needs a city segment.
 */
export async function getOperationHubData(
  operation: string,
): Promise<OperationHubData> {
  const [locRows, rows] = await Promise.all([
    db
      .select({
        id: locations.id,
        name: locations.name,
        slug: locations.slug,
        level: locations.level,
        parentId: locations.parentId,
      })
      .from(locations),
    db
      .select({
        locationId: listings.locationId,
        propertyType: listings.propertyType,
        n: sql<number>`COUNT(*)`,
      })
      .from(listings)
      .where(
        and(
          eq(listings.status, "published"),
          eq(listings.operation, operation as "venta" | "alquiler"),
        ),
      )
      .groupBy(listings.locationId, listings.propertyType),
  ]);

  const locById = new Map(locRows.map((l) => [l.id, l]));
  const cityCounts = new Map<number, number>();
  const typeCounts = new Map<string, number>();
  let total = 0;

  for (const r of rows) {
    const n = Number(r.n);
    total += n;
    typeCounts.set(r.propertyType, (typeCounts.get(r.propertyType) ?? 0) + n);
    const loc = locById.get(r.locationId);
    if (!loc) continue;
    const city =
      loc.level === "municipio"
        ? loc
        : loc.parentId != null && locById.get(loc.parentId)?.level === "municipio"
          ? locById.get(loc.parentId)!
          : null;
    if (!city) continue;
    cityCounts.set(city.id, (cityCounts.get(city.id) ?? 0) + n);
  }

  return {
    total,
    cities: [...cityCounts.entries()]
      .map(([id, count]) => {
        const loc = locById.get(id)!;
        return { name: loc.name, slug: loc.slug, count };
      })
      .sort((a, b) => b.count - a.count),
    types: [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface PortalStats {
  listings: number;
  agencies: number;
  cities: number;
  projects: number;
}

/**
 * Headline counts for /nosotros and /para-inmobiliarias. Real numbers only —
 * whatever the DB says is what the page shows, including zero.
 */
async function getPortalStatsUncached(): Promise<PortalStats> {
  const [[l], [a], [c], [p]] = await Promise.all([
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(listings)
      .where(eq(listings.status, "published")),
    db
      .select({ n: sql<number>`COUNT(DISTINCT ${listings.agencyId})` })
      .from(listings)
      .where(eq(listings.status, "published")),
    db
      .select({ n: sql<number>`COUNT(DISTINCT ${listings.locationId})` })
      .from(listings)
      .where(eq(listings.status, "published")),
    db.select({ n: sql<number>`COUNT(*)` }).from(projects),
  ]);
  return {
    listings: Number(l?.n ?? 0),
    agencies: Number(a?.n ?? 0),
    cities: Number(c?.n ?? 0),
    projects: Number(p?.n ?? 0),
  };
}

/* ------------------------------------------------------------------------ *
 * Data cache (PLAN.md F17)
 *
 * These six queries aggregate across whole tables — the agency directory
 * alone runs three grouped joins — and they back pages that change on an
 * operator's cadence, not a visitor's. Caching them means /inmobiliarias,
 * /agentes, /desarrolladoras, /proyectos, /financiamiento, /nosotros and
 * /para-inmobiliarias render without touching MySQL between writes.
 *
 * Every tag here has a writer: the admin and agencia actions that change an
 * agency, agent, developer or project call `revalidateDirectory()`, so an
 * operator sees their edit on the public page immediately rather than when
 * the TTL happens to expire. The TTL is the backstop, not the mechanism.
 * ------------------------------------------------------------------------ */

const DIRECTORY_CACHE = {
  revalidate: CACHE_TTL.directory,
  tags: [CACHE_TAGS.directory],
};

/**
 * Every agency that has at least one published listing, ordered by plan then
 * inventory size. Agencies with nothing live are excluded — a directory of
 * empty profiles is worse than a short directory.
 */
export const listAgenciesForDirectory = unstable_cache(
  listAgenciesForDirectoryUncached,
  ["directory:agencies"],
  DIRECTORY_CACHE,
);

/**
 * Agents with published inventory — the /agentes index. Same rule as the
 * agency directory: an agent with nothing live is not listed, because a
 * directory of empty profiles helps nobody and dilutes crawl budget.
 */
export const listAgentsForDirectory = unstable_cache(
  listAgentsForDirectoryUncached,
  ["directory:agents"],
  DIRECTORY_CACHE,
);

/** Developers with at least one project — the /desarrolladoras index. */
export const listDevelopersForDirectory = unstable_cache(
  listDevelopersForDirectoryUncached,
  ["directory:developers"],
  DIRECTORY_CACHE,
);

/**
 * Every project, newest first — the /proyectos index.
 *
 * `ProjectCard.deliveryDate` is typed `string | Date | null` precisely
 * because of this boundary: it goes in as a Date and comes back as an ISO
 * string, and `deliveryLabel()` accepts both.
 */
export const listAllProjects = unstable_cache(
  listAllProjectsUncached,
  ["directory:projects"],
  DIRECTORY_CACHE,
);

/** Headline counts for /nosotros and /para-inmobiliarias. */
export const getPortalStats = unstable_cache(
  getPortalStatsUncached,
  ["directory:portal-stats"],
  DIRECTORY_CACHE,
);

const cachedFinancingPrograms = unstable_cache(
  listFinancingProgramsUncached,
  ["directory:financing-programs"],
  { revalidate: CACHE_TTL.directory, tags: [CACHE_TAGS.directory] },
);

/**
 * Active financing programs, cheapest rate first — /financiamiento.
 *
 * `updatedAt` is re-wrapped because the cache serializes it to a string while
 * the row type still says `Date | null`. Nothing renders it today; the wrap
 * is so that the first thing that does is not quietly wrong.
 */
export async function listFinancingPrograms(): Promise<FinancingProgramRow[]> {
  const rows = await cachedFinancingPrograms();
  return rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt == null ? null : new Date(r.updatedAt),
  }));
}
