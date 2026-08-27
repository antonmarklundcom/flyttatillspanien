"use server";

/**
 * Photo upload from the publish wizard.
 *
 * The wizard's publisher is often FSBO ("particular") with no agency, so the
 * scope here is `owner` — their claim on the row is `owner_user_id`, re-derived
 * from the session on every call. A forged draftId therefore matches no row.
 * That guard is also what keeps this from being an open upload endpoint: bytes
 * can only ever be written against a draft the caller created.
 *
 * Unlike the panel actions these return a result instead of redirecting — the
 * wizard is a client component and stays on the page.
 */
import { requireUser } from "@/lib/auth/guards";
import {
  addListingImages,
  deleteListingImage,
  listListingImages,
  type ListingImageRow,
} from "@/lib/listing-images";

export type DraftPhotoResult =
  | { ok: true; images: ListingImageRow[]; rejected: string[] }
  | { ok: false; error: "not_found" | "not_configured" | "no_files" | "too_many" };

export async function uploadDraftPhotosAction(
  formData: FormData,
): Promise<DraftPhotoResult> {
  const user = await requireUser("/publicar");
  const draftId = Number(formData.get("draftId"));
  if (!Number.isInteger(draftId) || draftId <= 0) {
    return { ok: false, error: "not_found" };
  }

  const scope = { kind: "owner", userId: user.id } as const;
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const result = await addListingImages(draftId, scope, files);
  if (!result.ok) return { ok: false, error: result.reason };

  return {
    ok: true,
    images: await listListingImages(draftId, scope),
    rejected: result.rejected,
  };
}

export async function deleteDraftPhotoAction(
  draftId: number,
  imageId: number,
): Promise<DraftPhotoResult> {
  const user = await requireUser("/publicar");
  const scope = { kind: "owner", userId: user.id } as const;

  const ok = await deleteListingImage(draftId, imageId, scope);
  if (!ok) return { ok: false, error: "not_found" };
  return { ok: true, images: await listListingImages(draftId, scope), rejected: [] };
}
