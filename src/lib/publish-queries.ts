/**
 * Publish-wizard data access (ARCHITECTURE.md §3, M5). A draft is a `listings`
 * row with status='draft' owned by the publisher — no separate drafts table
 * (the schema STOP gate is closed; status='draft' is the intended shape). Every
 * write is scoped to ownerUserId in the WHERE clause, so a publisher can only
 * ever touch their own draft, whatever the client submits. Reference data
 * (locations, nearby projects, financing programs) feeds the wizard's selects.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { financingPrograms, listings, locations, projects } from "@/db/schema";
import type { FinancingProgram } from "@/lib/cuota";
import { makePublicId, toPriceUsd } from "@/lib/import/normalize";
import { syncDisplayCoords } from "@/lib/geo";
import { slugify } from "@/lib/slug";
import type { Operation, PropertyType } from "@/lib/import/types";

export const USD_TO_PYG = Number(process.env.USD_TO_PYG ?? 7300);

/* ------------------------------------------------------------------ */
/* Reference data for the wizard selects                               */
/* ------------------------------------------------------------------ */

export interface PublishLocation {
  id: number;
  label: string; // "Recoleta, Asunción" (barrio) or "Asunción" (ciudad)
}

/**
 * Ciudad + barrio options for the location step, each labelled with its parent
 * city so duplicate barrio names stay distinguishable. Ordered city-first.
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
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
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

/** Active financing programs as plain numbers for the client-side cuota preview. */
export async function listActiveFinancingPrograms(): Promise<FinancingProgram[]> {
  const rows = await db
    .select()
    .from(financingPrograms)
    .where(eq(financingPrograms.active, true));
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    annualRate: Number(p.annualRate),
    maxTermMonths: p.maxTermMonths,
    maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
    minDownPct: Number(p.minDownPct),
    active: p.active,
  }));
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
  priceAmount: number;
  priceCurrency: "USD" | "PYG";
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  areaM2?: number | null;
  landM2?: number | null;
  locationId: number;
  projectId?: number | null;
  videoUrl?: string | null;
  foreignExposure: boolean;
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
    priceAmount: Number(row.priceAmount),
    priceCurrency: row.priceCurrency,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parking,
    areaM2: row.areaM2 != null ? Number(row.areaM2) : null,
    landM2: row.landM2 != null ? Number(row.landM2) : null,
    locationId: row.locationId,
    projectId: row.projectId,
    videoUrl: row.videoUrl,
    foreignExposure: row.foreignExposure,
  };
}

/** Fields the wizard controls, shared by insert and update. */
function draftFields(input: DraftInput, agencyId: number | null) {
  return {
    operation: input.operation,
    propertyType: input.propertyType,
    title: input.title.slice(0, 180),
    descriptionEs: input.descriptionEs ?? null,
    priceAmount: input.priceAmount.toFixed(2),
    priceCurrency: input.priceCurrency,
    priceUsd: toPriceUsd(
      input.priceAmount,
      input.priceCurrency,
      USD_TO_PYG,
    ).toFixed(2),
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    parking: input.parking ?? null,
    areaM2: input.areaM2 != null ? input.areaM2.toString() : null,
    landM2: input.landM2 != null ? input.landM2.toString() : null,
    locationId: input.locationId,
    projectId: input.projectId ?? null,
    agencyId,
    videoUrl: input.videoUrl ?? null,
    foreignExposure: input.foreignExposure,
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
    slug: slugify(input.title) || "propiedad",
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
 * back into the queue. `isVerified` reflects the WhatsApp-verified publisher
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
