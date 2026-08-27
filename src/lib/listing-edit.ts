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
import { toPriceUsd } from "@/lib/import/normalize";
import { USD_TO_PYG } from "@/lib/publish-queries";
import type { Operation, PropertyType } from "@/lib/import/types";
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
  priceAmount: string;
  priceCurrency: "USD" | "PYG";
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
      priceAmount: listings.priceAmount,
      priceCurrency: listings.priceCurrency,
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
  priceAmount: number;
  priceCurrency: "USD" | "PYG";
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  areaM2: number | null;
  landM2: number | null;
  locationId: number;
  videoUrl: string | null;
  foreignExposure: boolean;
  isVerified: boolean;
  reviewNotes: string | null;
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
      priceAmount: listings.priceAmount,
      priceCurrency: listings.priceCurrency,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      parking: listings.parking,
      areaM2: listings.areaM2,
      landM2: listings.landM2,
      locationId: listings.locationId,
      videoUrl: listings.videoUrl,
      foreignExposure: listings.foreignExposure,
      isVerified: listings.isVerified,
      reviewNotes: listings.reviewNotes,
    })
    .from(listings)
    .where(guard ? and(eq(listings.id, id), guard) : eq(listings.id, id))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    priceAmount: Number(row.priceAmount),
    areaM2: row.areaM2 != null ? Number(row.areaM2) : null,
    landM2: row.landM2 != null ? Number(row.landM2) : null,
  };
}

export interface ListingEditInput {
  title: string;
  descriptionEs: string | null;
  operation: Operation;
  propertyType: PropertyType;
  priceAmount: number;
  priceCurrency: "USD" | "PYG";
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  areaM2: number | null;
  landM2: number | null;
  locationId: number;
  videoUrl: string | null;
  foreignExposure: boolean;
  status: ListingStatusValue;
}

/**
 * Save an edit inside the caller's scope. `price_usd` is re-normalised here
 * because ALL filtering reads that column — leaving it stale would silently
 * drop the listing out of price facets. `cuota_gs` is left to the nightly cron.
 *
 * Returns rows affected: 0 means the id was outside the scope (or the status
 * was one this scope may not set), which the caller surfaces as "not found"
 * rather than leaking whether the row exists.
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
    .select({
      operation: listings.operation,
      priceAmount: listings.priceAmount,
      priceCurrency: listings.priceCurrency,
      publishedAt: listings.publishedAt,
      status: listings.status,
    })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  if (!maySetStatus(scope, current?.status, input.status)) return 0;

  const moneyChanged =
    !current ||
    current.operation !== input.operation ||
    Number(current.priceAmount) !== input.priceAmount ||
    current.priceCurrency !== input.priceCurrency;

  const patch: Partial<typeof listings.$inferInsert> = {
    title: input.title.slice(0, 180),
    descriptionEs: input.descriptionEs,
    operation: input.operation,
    propertyType: input.propertyType,
    priceAmount: input.priceAmount.toFixed(2),
    priceCurrency: input.priceCurrency,
    priceUsd: toPriceUsd(
      input.priceAmount,
      input.priceCurrency,
      USD_TO_PYG,
    ).toFixed(2),
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    parking: input.parking,
    areaM2: input.areaM2 != null ? input.areaM2.toString() : null,
    landM2: input.landM2 != null ? input.landM2.toString() : null,
    locationId: input.locationId,
    videoUrl: input.videoUrl,
    foreignExposure: input.foreignExposure,
    status: input.status,
  };

  if (moneyChanged) patch.cuotaGs = null;

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
