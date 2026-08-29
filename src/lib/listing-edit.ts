/**
 * Listing editing, shared by the super-admin panel and the agency dashboard.
 *
 * The only difference between the two is *scope*, expressed as an EditScope and
 * enforced in the WHERE clause of every read and write — never by the caller
 * remembering to filter. An agency scope can only ever reach its own rows, so a
 * forged id in the URL or the form body matches nothing instead of editing
 * someone else's listing.
 *
 * Identity columns (`slug`, `public_id`) are never rewritten: slugs are part of
 * the SEO contract and are not recomputed for an existing row.
 */
import "server-only";
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { agencies, listings, locations } from "@/db/schema";
import { syncDisplayCoords } from "@/lib/geo";
import { normalizeCatastral } from "@/lib/import/normalize";
import { canPublish } from "@/lib/publish-gate";
import type {
  ChargesStatus,
  EnergyRating,
  LandClassification,
  LegalStatus,
  Operation,
  PropertyType,
} from "@/lib/import/types";
import { containsPattern } from "@/lib/sql-like";

export type ListingStatusValue = (typeof listings.$inferSelect)["status"];

/**
 * Who is editing, and therefore which rows they may touch.
 *
 * `owner` is the publish wizard's scope: an FSBO publisher has no agency, so
 * their claim on a listing is `owner_user_id`. It is intentionally the
 * narrowest of the three — it can reach a row no matter which agency the row
 * was later assigned to, but only ever a row this user created.
 */
export type EditScope =
  | { kind: "admin" }
  | { kind: "agency"; agencyId: number }
  | { kind: "owner"; userId: number };

/** Statuses each scope may set. Admin owns the full lifecycle. */
export const ADMIN_STATUSES: readonly ListingStatusValue[] = [
  "draft",
  "pending_review",
  "published",
  "paused",
  "sold",
  "rented",
  "removed",
];

/**
 * Statuses a non-admin scope may MOVE a listing to.
 *
 * `published` is deliberately absent (audit F1). A self-registered agency
 * account used to be able to take its own draft straight to `published`, which
 * made the review queue optional — and the review queue is the entire trust
 * story this portal sells to buyers. Publishing is now something a human
 * grants: an agency submits (`pending_review`) and /admin approves.
 *
 * `pending_review` is here for the same reason: without it "submit for review"
 * would not be an action an agency could take at all.
 */
export const AGENCY_STATUSES: readonly ListingStatusValue[] = [
  "draft",
  "pending_review",
  "paused",
  "sold",
  "rented",
];

/**
 * States an agency may not leave on its own: the listing is with the reviewer,
 * or the reviewer rejected it. The dashboard shows a note instead of a select
 * for these (F25 — a select defaulting to "Borrador" cancelled the review).
 */
export const AGENCY_LOCKED_STATUSES: readonly ListingStatusValue[] = [
  "pending_review",
  "removed",
];

export function statusesFor(scope: EditScope): readonly ListingStatusValue[] {
  return scope.kind === "admin" ? ADMIN_STATUSES : AGENCY_STATUSES;
}

/** Is this form value a listing status at all? Says nothing about permission. */
export function isListingStatus(value: string): value is ListingStatusValue {
  return (ADMIN_STATUSES as readonly string[]).includes(value);
}

/**
 * May this scope move a listing from `current` to `next`?
 *
 * Keeping the status a row already has is always allowed. Without that, an
 * agency saving a typo fix on a *published* listing would be forced to change
 * its status — and since `published` is not theirs to set, the save would
 * either fail or quietly unpublish. It grants nothing: the only row this lets
 * them "set to published" is one that is already published.
 */
export function maySetStatus(
  scope: EditScope,
  current: ListingStatusValue | undefined,
  next: ListingStatusValue,
): boolean {
  if (current !== undefined && next === current) return true;
  return statusesFor(scope).includes(next);
}

/**
 * What the agency dashboard and edit form offer for a row: everything the
 * scope may set, plus the row's own status so "leave it as it is" is
 * expressible. Published rows are the case that matters — an agency must
 * still be able to pause or mark one sold.
 */
export function agencyStatusOptions(
  current: ListingStatusValue,
): ListingStatusValue[] {
  return AGENCY_STATUSES.includes(current)
    ? [...AGENCY_STATUSES]
    : [current, ...AGENCY_STATUSES];
}

/**
 * Ownership predicate for a scope — the guard every query is built on.
 *
 * Exported because the agency dashboard's own queries (panel-queries.ts) must
 * express ownership *identically*: an independent agent has no agencies row, so
 * a dashboard that assumed `agency_id` would show them an empty panel and let
 * them edit nothing.
 */
export function listingScopeWhere(scope: EditScope): SQL | undefined {
  switch (scope.kind) {
    case "admin":
      return undefined;
    case "agency":
      return eq(listings.agencyId, scope.agencyId);
    case "owner":
      return eq(listings.ownerUserId, scope.userId);
  }
}

/* ------------------------------------------------------------------ */
/* Admin: browse every listing, any status                             */
/* ------------------------------------------------------------------ */

export interface AdminListingRow {
  id: number;
  publicId: string;
  slug: string;
  title: string;
  status: ListingStatusValue;
  operation: Operation;
  propertyType: PropertyType;
  priceEur: string;
  updatedAt: Date;
  agencyName: string | null;
  locationName: string | null;
}

/**
 * Every listing, newest-touched first, optionally narrowed by status and a
 * title/public-id search. Capped because the panel is a working surface, not a
 * report — the review queue and filters are how you find a specific row.
 */
export async function listAllListings(params: {
  status?: ListingStatusValue | "all";
  q?: string;
  limit?: number;
}): Promise<AdminListingRow[]> {
  const filters: SQL[] = [];

  if (params.status && params.status !== "all") {
    filters.push(eq(listings.status, params.status));
  }

  const q = params.q?.trim();
  if (q) {
    const term = containsPattern(q);
    const match = or(like(listings.title, term), like(listings.publicId, term));
    if (match) filters.push(match);
  }

  return db
    .select({
      id: listings.id,
      publicId: listings.publicId,
      slug: listings.slug,
      title: listings.title,
      status: listings.status,
      operation: listings.operation,
      propertyType: listings.propertyType,
      priceEur: listings.priceEur,
      updatedAt: listings.updatedAt,
      agencyName: agencies.name,
      locationName: locations.name,
    })
    .from(listings)
    .leftJoin(agencies, eq(listings.agencyId, agencies.id))
    .leftJoin(locations, eq(listings.locationId, locations.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(listings.updatedAt))
    .limit(params.limit ?? 200);
}

/** Status counts for the filter chips — one GROUP BY, not a full table read. */
export async function countListingsByStatus(): Promise<
  Record<string, number>
> {
  const rows = await db
    .select({ status: listings.status, n: sql<number>`count(*)` })
    .from(listings)
    .groupBy(listings.status);
  const out: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.n);
    out[r.status] = n;
    total += n;
  }
  out.all = total;
  return out;
}

/* ------------------------------------------------------------------ */
/* Shared edit form: hydrate + save                                    */
/* ------------------------------------------------------------------ */

export interface EditableListing {
  id: number;
  publicId: string;
  slug: string;
  status: ListingStatusValue;
  operation: Operation;
  propertyType: PropertyType;
  title: string;
  descriptionEs: string | null;
  priceEur: number;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  builtM2: number | null;
  usableM2: number | null;
  plotM2: number | null;
  yearBuilt: number | null;
  locationId: number;
  videoUrl: string | null;
  isVerified: boolean;
  reviewNotes: string | null;
  /* The Spain legal block. */
  referenciaCatastral: string | null;
  energyRating: EnergyRating | null;
  energyEmissions: Exclude<EnergyRating, "en_tramite" | "exento"> | null;
  legalStatus: LegalStatus;
  chargesStatus: ChargesStatus;
  /**
   * The portal's own attestation that a nota simple was sighted. Editable in
   * `/admin` ONLY — never offered to an agency or an owner scope, because its
   * entire value is that the lister cannot set it. `updateListing()` enforces
   * that; this field being present in the shape is not permission to write it.
   */
  notaSimpleSeenAt: Date | null;
  ibiAnnualEur: number | null;
  communityMonthlyEur: number | null;
  isVpo: boolean;
  landClassification: LandClassification | null;
  buildableM2: number | null;
  touristLicence: string | null;
}

/** Load one listing inside the caller's scope, or null when out of reach. */
export async function getEditableListing(
  id: number,
  scope: EditScope,
): Promise<EditableListing | null> {
  const guard = listingScopeWhere(scope);
  const [row] = await db
    .select({
      id: listings.id,
      publicId: listings.publicId,
      slug: listings.slug,
      status: listings.status,
      operation: listings.operation,
      propertyType: listings.propertyType,
      title: listings.title,
      descriptionEs: listings.descriptionEs,
      priceEur: listings.priceEur,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      parking: listings.parking,
      builtM2: listings.builtM2,
      usableM2: listings.usableM2,
      plotM2: listings.plotM2,
      yearBuilt: listings.yearBuilt,
      locationId: listings.locationId,
      videoUrl: listings.videoUrl,
      isVerified: listings.isVerified,
      reviewNotes: listings.reviewNotes,
      referenciaCatastral: listings.referenciaCatastral,
      energyRating: listings.energyRating,
      energyEmissions: listings.energyEmissions,
      legalStatus: listings.legalStatus,
      chargesStatus: listings.chargesStatus,
      notaSimpleSeenAt: listings.notaSimpleSeenAt,
      ibiAnnualEur: listings.ibiAnnualEur,
      communityMonthlyEur: listings.communityMonthlyEur,
      isVpo: listings.isVpo,
      landClassification: listings.landClassification,
      buildableM2: listings.buildableM2,
      touristLicence: listings.touristLicence,
    })
    .from(listings)
    .where(guard ? and(eq(listings.id, id), guard) : eq(listings.id, id))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    priceEur: Number(row.priceEur),
    builtM2: row.builtM2 != null ? Number(row.builtM2) : null,
    usableM2: row.usableM2 != null ? Number(row.usableM2) : null,
    plotM2: row.plotM2 != null ? Number(row.plotM2) : null,
    ibiAnnualEur: row.ibiAnnualEur != null ? Number(row.ibiAnnualEur) : null,
    communityMonthlyEur:
      row.communityMonthlyEur != null ? Number(row.communityMonthlyEur) : null,
    buildableM2: row.buildableM2 != null ? Number(row.buildableM2) : null,
  };
}

export interface ListingEditInput {
  title: string;
  descriptionEs: string | null;
  operation: Operation;
  propertyType: PropertyType;
  priceEur: number;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  builtM2: number | null;
  usableM2: number | null;
  plotM2: number | null;
  yearBuilt: number | null;
  locationId: number;
  videoUrl: string | null;
  status: ListingStatusValue;
  /* The Spain legal block. */
  referenciaCatastral: string | null;
  energyRating: EnergyRating | null;
  energyEmissions: Exclude<EnergyRating, "en_tramite" | "exento"> | null;
  legalStatus: LegalStatus;
  chargesStatus: ChargesStatus;
  ibiAnnualEur: number | null;
  communityMonthlyEur: number | null;
  isVpo: boolean;
  landClassification: LandClassification | null;
  buildableM2: number | null;
  touristLicence: string | null;
  /**
   * Operator-only, and only read when `scope.kind === "admin"`. `undefined`
   * means "leave whatever is on the row"; an explicit `null` clears it.
   */
  notaSimpleSeenAt?: Date | null;
}

/**
 * Save an edit inside the caller's scope.
 *
 * Returns rows affected: 0 means the id was outside the scope, the status was
 * one this scope may not set, or the row failed the publish gate — all of
 * which the caller surfaces as "not found" or as the gate's own message,
 * rather than leaking whether the row exists.
 *
 * The publish gate runs against the values being SAVED, not the ones on the
 * row: an operator who fills in the energy rating and flips the status to
 * published in one submit is doing exactly the right thing, and reading the
 * stale row would refuse it.
 */
export async function updateListing(params: {
  id: number;
  scope: EditScope;
  input: ListingEditInput;
}): Promise<number> {
  const { id, scope, input } = params;

  // The cached cuota was computed from the old operation and price. Leaving it
  // when either changes renders wrong money on the card until the nightly cron
  // (a listing flipped venta→alquiler kept a purchase cuota forever). Cleared
  // here, recomputed by cron:cuotas. The row's current status comes back in the
  // same read, because the permission check below needs it.
  const [current] = await db
    .select({ publishedAt: listings.publishedAt, status: listings.status })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  if (!maySetStatus(scope, current?.status, input.status)) return 0;

  // RD 390/2021: no energy rating, no advertisement. See publish-gate.ts for
  // why this is here and not in the form.
  if (input.status === "published" && !canPublish(input)) return 0;

  const patch: Partial<typeof listings.$inferInsert> = {
    title: input.title.slice(0, 180),
    descriptionEs: input.descriptionEs,
    operation: input.operation,
    propertyType: input.propertyType,
    priceEur: input.priceEur.toFixed(2),
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    parking: input.parking,
    builtM2: input.builtM2 != null ? input.builtM2.toString() : null,
    usableM2: input.usableM2 != null ? input.usableM2.toString() : null,
    plotM2: input.plotM2 != null ? input.plotM2.toString() : null,
    yearBuilt: input.yearBuilt,
    locationId: input.locationId,
    videoUrl: input.videoUrl,
    status: input.status,
    referenciaCatastral: normalizeCatastral(input.referenciaCatastral),
    energyRating: input.energyRating,
    energyEmissions: input.energyEmissions,
    legalStatus: input.legalStatus,
    chargesStatus: input.chargesStatus,
    ibiAnnualEur:
      input.ibiAnnualEur != null ? input.ibiAnnualEur.toFixed(2) : null,
    communityMonthlyEur:
      input.communityMonthlyEur != null
        ? input.communityMonthlyEur.toFixed(2)
        : null,
    isVpo: input.isVpo,
    landClassification: input.landClassification,
    buildableM2: input.buildableM2 != null ? input.buildableM2.toString() : null,
    // A holiday-let licence on a venta would render a compliance claim about
    // the wrong thing; the column only means something for that operation.
    touristLicence:
      input.operation === "alquiler_vacacional"
        ? input.touristLicence?.trim() || null
        : null,
  };

  /**
   * `nota_simple_seen_at` is the portal's own attestation, so only the admin
   * scope may write it — an agency or an owner submitting the field is
   * ignored, not rejected, because the field is not on their form at all and a
   * rejection would only tell a prober that the column exists.
   */
  if (scope.kind === "admin" && input.notaSimpleSeenAt !== undefined) {
    patch.notaSimpleSeenAt = input.notaSimpleSeenAt;
  }

  // FIRST publish stamps publishedAt so category ordering (idx_fresh) is sane —
  // and only the first. Re-stamping on every edit made a typo fix look like a
  // new listing: the row jumped back to the top of `published_at desc` and the
  // sitemap's lastmod moved for content that had not changed. A listing that
  // is unpaused keeps its original publish date on purpose.
  if (input.status === "published" && current?.publishedAt == null) {
    patch.publishedAt = new Date();
  }

  const guard = listingScopeWhere(scope);
  const [res] = await db
    .update(listings)
    .set(patch)
    .where(guard ? and(eq(listings.id, id), guard) : eq(listings.id, id));
  // location_id is editable here, and it is what a listing without its own
  // coordinate is plotted by. Recompute rather than leave the map pointing at
  // the previous barrio (src/lib/geo.ts).
  if (res.affectedRows > 0) await syncDisplayCoords(db, id);
  return res.affectedRows;
}

/** Delete a listing. Super-admin only — the agency scope uses status='removed'. */
export async function deleteListing(id: number): Promise<number> {
  const [res] = await db.delete(listings).where(eq(listings.id, id));
  return res.affectedRows;
}
