/**
 * Publish-wizard data access. A draft is a `listings` row with status='draft'
 * owned by the publisher — no separate drafts table (status='draft' is the
 * intended shape). Every write is scoped to ownerUserId in the WHERE clause,
 * so a publisher can only ever touch their own draft, whatever the client
 * submits. Reference data (locations, nearby projects) feeds the wizard's
 * selects.
 *
 * The energy-rating publish gate (docs/SPAIN-PORTAL-DESIGN.md §3.2 — a
 * listing cannot reach status "published" with energy_rating NULL) lives in
 * the server action that approves a pending_review row into published
 * (app/admin/propiedades/actions.ts), not here: this module only ever moves
 * draft → pending_review.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { listings, locations, projects } from "@/db/schema";
import { makePublicId } from "@/lib/import/normalize";
import { syncDisplayCoords } from "@/lib/geo";
import { slugify } from "@/lib/slug";
import type { Operation, PropertyType } from "@/lib/import/types";

/* ------------------------------------------------------------------ */
/* Reference data for the wizard selects                               */
/* ------------------------------------------------------------------ */

export interface PublishLocation {
  id: number;
  label: string; // "Nueva Andalucía, Marbella" (zona) or "Marbella" (municipio)
}

/**
 * Municipio + zona options for the location step, each labelled with its
 * parent municipio so duplicate zona names stay distinguishable.
 * Municipio-first.
 */
export async function listPublishLocations(): Promise<PublishLocation[]> {
  const rows = await db
    .select({
      id: locations.id,
      level: locations.level,
      name: locations.name,
      parentId: locations.parentId,
    })
    .from(locations)
    .orderBy(asc(locations.name));

  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  return rows
    .filter((r) => r.level === "municipio" || r.level === "zona")
    .map((r) => ({
      id: r.id,
      label:
        r.level === "zona" && r.parentId
          ? `${r.name}, ${nameById.get(r.parentId) ?? ""}`.replace(/, $/, "")
          : r.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "sv"));
}

export interface NearbyProject {
  id: number;
  name: string;
  locationId: number;
}

/** Projects for the "proyecto cercano" autocomplete (preventa units attach to a building). */
export async function listNearbyProjects(): Promise<NearbyProject[]> {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      locationId: projects.locationId,
    })
    .from(projects)
    .orderBy(asc(projects.name));
}

/* ------------------------------------------------------------------ */
/* Draft CRUD — every operation scoped to the owning user              */
/* ------------------------------------------------------------------ */

/** The wizard's persisted core. Optional fields are null until their step. */
export interface DraftInput {
  operation: Operation;
  propertyType: PropertyType;
  title: string;
  descriptionEs?: string | null;
  priceEur: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  builtM2?: number | null;
  plotM2?: number | null;
  locationId: number;
  projectId?: number | null;
  videoUrl?: string | null;
  // Spain legal block (docs/SPAIN-PORTAL-DESIGN.md §3.2) — optional in the
  // wizard, mandatory (energyRating) at the publish gate.
  referenciaCatastral?: string | null;
  energyRating?: (typeof listings.$inferSelect)["energyRating"];
  legalStatus?: (typeof listings.$inferSelect)["legalStatus"];
  chargesStatus?: (typeof listings.$inferSelect)["chargesStatus"];
  ibiAnnualEur?: number | null;
  communityMonthlyEur?: number | null;
  isVpo?: boolean;
  landClassification?: (typeof listings.$inferSelect)["landClassification"];
  buildableM2?: number | null;
}

export interface DraftRow extends DraftInput {
  id: number;
  publicId: string;
  slug: string;
  status: (typeof listings.$inferSelect)["status"];
}

/** Hydrate a draft the user owns (for resuming the wizard); null otherwise. */
export async function getUserDraft(
  userId: number,
  draftId: number,
): Promise<DraftRow | null> {
  const [row] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, draftId), eq(listings.ownerUserId, userId)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    publicId: row.publicId,
    slug: row.slug,
    status: row.status,
    operation: row.operation,
    propertyType: row.propertyType,
    title: row.title,
    descriptionEs: row.descriptionEs,
    priceEur: Number(row.priceEur),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parking,
    builtM2: row.builtM2 != null ? Number(row.builtM2) : null,
    plotM2: row.plotM2 != null ? Number(row.plotM2) : null,
    locationId: row.locationId,
    projectId: row.projectId,
    videoUrl: row.videoUrl,
    referenciaCatastral: row.referenciaCatastral,
    energyRating: row.energyRating,
    legalStatus: row.legalStatus,
    chargesStatus: row.chargesStatus,
    ibiAnnualEur: row.ibiAnnualEur != null ? Number(row.ibiAnnualEur) : null,
    communityMonthlyEur:
      row.communityMonthlyEur != null ? Number(row.communityMonthlyEur) : null,
    isVpo: row.isVpo,
    landClassification: row.landClassification,
    buildableM2: row.buildableM2 != null ? Number(row.buildableM2) : null,
  };
}

/** Fields the wizard controls, shared by insert and update. */
function draftFields(input: DraftInput, agencyId: number | null) {
  return {
    operation: input.operation,
    propertyType: input.propertyType,
    title: input.title.slice(0, 180),
    descriptionEs: input.descriptionEs ?? null,
    priceEur: input.priceEur.toFixed(2),
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    parking: input.parking ?? null,
    builtM2: input.builtM2 != null ? input.builtM2.toString() : null,
    plotM2: input.plotM2 != null ? input.plotM2.toString() : null,
    locationId: input.locationId,
    projectId: input.projectId ?? null,
    agencyId,
    videoUrl: input.videoUrl ?? null,
    referenciaCatastral: input.referenciaCatastral ?? null,
    energyRating: input.energyRating ?? null,
    legalStatus: input.legalStatus ?? "desconocido",
    chargesStatus: input.chargesStatus ?? "desconocido",
    ibiAnnualEur: input.ibiAnnualEur != null ? input.ibiAnnualEur.toString() : null,
    communityMonthlyEur:
      input.communityMonthlyEur != null ? input.communityMonthlyEur.toString() : null,
    isVpo: input.isVpo ?? false,
    landClassification: input.landClassification ?? null,
    buildableM2: input.buildableM2 != null ? input.buildableM2.toString() : null,
  };
}

/**
 * Create or update the caller's draft. On create the row is stamped with a
 * public_id, a title slug and ownerUserId; on update those identity columns are
 * left untouched (never recompute a slug — SEO contract). The update is scoped
 * to (id, ownerUserId, status='draft') so a published/removed row can't be
 * mutated back into a draft, and no other user's draft can be touched.
 * Returns the draft id (0 when an update matched nothing).
 */
export async function saveDraft(params: {
  userId: number;
  agencyId: number | null;
  draftId: number | null;
  input: DraftInput;
}): Promise<number> {
  const { userId, agencyId, draftId, input } = params;
  const fields = draftFields(input, agencyId);

  if (draftId) {
    const [res] = await db
      .update(listings)
      .set(fields)
      .where(
        and(
          eq(listings.id, draftId),
          eq(listings.ownerUserId, userId),
          eq(listings.status, "draft"),
        ),
      );
    if (res.affectedRows === 0) return 0;
    // The wizard has no coordinate field, so a draft is plotted at its
    // location's centroid — and step 2 is where the visitor can change that
    // location. src/lib/geo.ts owns the rule.
    await syncDisplayCoords(db, draftId);
    return draftId;
  }

  const [res] = await db.insert(listings).values({
    publicId: makePublicId(),
    slug: slugify(input.title) || "bostad",
    status: "draft",
    ownerUserId: userId,
    ...fields,
  });
  const newId = Number((res as unknown as { insertId: number }).insertId);
  await syncDisplayCoords(db, newId);
  return newId;
}

/**
 * Submit a draft for review after OTP (draft → pending_review). Scoped to the
 * owner and status='draft' so it's idempotent and can't jump a published row
 * back into the queue. `isVerified` reflects the email-verified publisher
 * (the ✓ badge basis). Returns rows affected.
 */
export async function submitDraftForReview(params: {
  userId: number;
  draftId: number;
  verified: boolean;
}): Promise<number> {
  const [res] = await db
    .update(listings)
    .set({ status: "pending_review", isVerified: params.verified })
    .where(
      and(
        eq(listings.id, params.draftId),
        eq(listings.ownerUserId, params.userId),
        eq(listings.status, "draft"),
      ),
    );
  return res.affectedRows;
}
