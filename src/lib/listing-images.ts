/**
 * Listing photo management, shared by the super-admin panel and the agency
 * dashboard — the image counterpart to listing-edit.ts, and scoped the same
 * way: every read and write proves the *listing* belongs to the caller's
 * EditScope before touching an image row. An agency that forges an image id
 * from another agency's listing matches nothing.
 *
 * Position is the contract with the rest of the app: position 0 is the cover
 * (schema §2.1), and queries.ts reads covers by `order by position`. Positions
 * are renumbered 0..n-1 after every mutation so there are never gaps or ties.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { listingImages, listings } from "@/db/schema";
import type { EditScope } from "@/lib/listing-edit";
import {
  buildImageKey,
  ImageRejectedError,
  MAX_UPLOAD_BYTES,
  processListingImage,
  STORED_CONTENT_TYPE,
  thumbKey,
} from "@/lib/images";
import { deleteObjects, isR2Configured, putObject } from "@/lib/r2";

export interface ListingImageRow {
  id: number;
  r2Key: string;
  position: number;
  width: number | null;
  height: number | null;
}

/**
 * Resolve a listing inside the caller's scope. Returns null when it does not
 * exist *or* is out of reach — the two are deliberately indistinguishable to
 * the caller, so a probe cannot tell "not yours" from "not there".
 */
async function scopedListing(
  listingId: number,
  scope: EditScope,
): Promise<{ id: number; publicId: string } | null> {
  const owned =
    scope.kind === "admin"
      ? undefined
      : scope.kind === "agency"
        ? eq(listings.agencyId, scope.agencyId)
        : eq(listings.ownerUserId, scope.userId);
  const guard = owned
    ? and(eq(listings.id, listingId), owned)
    : eq(listings.id, listingId);

  const [row] = await db
    .select({ id: listings.id, publicId: listings.publicId })
    .from(listings)
    .where(guard)
    .limit(1);
  return row ?? null;
}

export async function listListingImages(
  listingId: number,
  scope: EditScope,
): Promise<ListingImageRow[]> {
  const listing = await scopedListing(listingId, scope);
  if (!listing) return [];
  return db
    .select({
      id: listingImages.id,
      r2Key: listingImages.r2Key,
      position: listingImages.position,
      width: listingImages.width,
      height: listingImages.height,
    })
    .from(listingImages)
    .where(eq(listingImages.listingId, listing.id))
    .orderBy(asc(listingImages.position), asc(listingImages.id));
}

/** Renumber a listing's images to 0..n-1 in their current order. */
async function resequence(listingId: number): Promise<void> {
  const rows = await db
    .select({ id: listingImages.id })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId))
    .orderBy(asc(listingImages.position), asc(listingImages.id));

  await Promise.all(
    rows.map((row, i) =>
      db
        .update(listingImages)
        .set({ position: i })
        .where(eq(listingImages.id, row.id)),
    ),
  );
}

export type UploadOutcome =
  | { ok: true; added: number; rejected: string[] }
  | { ok: false; reason: "not_found" | "not_configured" | "no_files" | "too_many" };

/**
 * How many photos one submit may carry (audit F36). The action body limit
 * (8 MB, next.config.ts) used to be the only bound, which is a bound on bytes
 * and not on *work*: a hundred 80 KB files is a legal request that costs a
 * hundred sequential sharp decodes on a box already at its process cap. Twenty
 * is more than any real listing gallery and cheap to justify to an operator.
 */
export const MAX_FILES_PER_UPLOAD = 20;

/**
 * Process and store uploaded files, then append them to the listing.
 *
 * Order of operations matters: R2 first, DB second. A row pointing at bytes
 * that were never written renders a broken gallery on the public site; bytes
 * with no row are invisible and cost nothing. Files are processed in sequence
 * rather than in parallel because sharp is CPU-bound and this host is already
 * at its process cap — a 20-photo batch must not spike the box.
 */
export async function addListingImages(
  listingId: number,
  scope: EditScope,
  files: File[],
): Promise<UploadOutcome> {
  if (files.length === 0) return { ok: false, reason: "no_files" };
  if (files.length > MAX_FILES_PER_UPLOAD) return { ok: false, reason: "too_many" };
  if (!isR2Configured()) return { ok: false, reason: "not_configured" };

  const listing = await scopedListing(listingId, scope);
  if (!listing) return { ok: false, reason: "not_found" };

  const existing = await db
    .select({ id: listingImages.id })
    .from(listingImages)
    .where(eq(listingImages.listingId, listing.id));

  let position = existing.length;
  let added = 0;
  const rejected: string[] = [];

  for (const file of files) {
    if (file.size === 0) continue;
    // Checked against the declared size *before* reading, so an oversized file
    // is refused without ever being pulled into the heap (audit F36).
    // processListingImage re-checks the real byte length behind this.
    if (file.size > MAX_UPLOAD_BYTES) {
      rejected.push(`${file.name}: El archivo supera los 12 MB.`);
      continue;
    }
    try {
      const processed = await processListingImage(
        Buffer.from(await file.arrayBuffer()),
      );
      const key = buildImageKey(listing.publicId);

      await putObject(key, processed.full, STORED_CONTENT_TYPE);
      await putObject(thumbKey(key), processed.thumb, STORED_CONTENT_TYPE);

      await db.insert(listingImages).values({
        listingId: listing.id,
        r2Key: key,
        position,
        width: processed.width,
        height: processed.height,
      });
      position += 1;
      added += 1;
    } catch (err) {
      // One unreadable file must not lose the rest of the batch.
      rejected.push(
        `${file.name}: ${
          err instanceof ImageRejectedError ? err.message : "no se pudo subir"
        }`,
      );
    }
  }

  await resequence(listing.id);
  return { ok: true, added, rejected };
}

export async function deleteListingImage(
  listingId: number,
  imageId: number,
  scope: EditScope,
): Promise<boolean> {
  const listing = await scopedListing(listingId, scope);
  if (!listing) return false;

  const [row] = await db
    .select({ id: listingImages.id, r2Key: listingImages.r2Key })
    .from(listingImages)
    .where(
      and(
        eq(listingImages.id, imageId),
        eq(listingImages.listingId, listing.id),
      ),
    )
    .limit(1);
  if (!row) return false;

  await db.delete(listingImages).where(eq(listingImages.id, row.id));
  await resequence(listing.id);

  // Orphaned bytes are cheap; a photo the panel cannot remove is not. The
  // delete of the row above already happened either way.
  try {
    await deleteObjects([row.r2Key, thumbKey(row.r2Key)]);
  } catch {
    /* ignore — see comment above */
  }
  return true;
}

/**
 * Move one image one slot up or down. Reordering is a swap rather than a
 * drag-and-drop payload so it works without JavaScript — the panel is used on
 * phones over mobile data.
 */
export async function moveListingImage(
  listingId: number,
  imageId: number,
  direction: "up" | "down",
  scope: EditScope,
): Promise<boolean> {
  const listing = await scopedListing(listingId, scope);
  if (!listing) return false;

  const rows = await db
    .select({ id: listingImages.id, position: listingImages.position })
    .from(listingImages)
    .where(eq(listingImages.listingId, listing.id))
    .orderBy(asc(listingImages.position), asc(listingImages.id));

  const index = rows.findIndex((r) => r.id === imageId);
  if (index === -1) return false;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= rows.length) return false;

  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  await Promise.all(
    reordered.map((row, i) =>
      db
        .update(listingImages)
        .set({ position: i })
        .where(eq(listingImages.id, row.id)),
    ),
  );
  return true;
}

/** Promote one image to cover (position 0), keeping the rest in order. */
export async function setListingCover(
  listingId: number,
  imageId: number,
  scope: EditScope,
): Promise<boolean> {
  const listing = await scopedListing(listingId, scope);
  if (!listing) return false;

  const rows = await db
    .select({ id: listingImages.id })
    .from(listingImages)
    .where(eq(listingImages.listingId, listing.id))
    .orderBy(asc(listingImages.position), asc(listingImages.id));

  if (!rows.some((r) => r.id === imageId)) return false;
  const ordered = [
    imageId,
    ...rows.map((r) => r.id).filter((id) => id !== imageId),
  ];

  await Promise.all(
    ordered.map((id, i) =>
      db.update(listingImages).set({ position: i }).where(eq(listingImages.id, id)),
    ),
  );
  return true;
}
