/**
 * FormData → photo mutations, shared by the admin and agency photo actions the
 * same way listing-form-input.ts is shared by their edit actions. Written once
 * so the two panels can never drift apart in what they accept.
 *
 * Nothing here decides *whether* the caller may act: it returns the parsed
 * intent, and the caller passes its own EditScope to the query layer, which is
 * where ownership is enforced.
 */
import "server-only";
import {
  addListingImages,
  deleteListingImage,
  moveListingImage,
  setListingCover,
} from "@/lib/listing-images";
import type { EditScope } from "@/lib/listing-edit";

/** Flash keys the panel pages map to svPanel strings via their FLASH table. */
export type PhotoFlash =
  | "photos_uploaded"
  | "photos_rejected"
  | "photos_deleted"
  | "photos_reordered"
  | "photos_none"
  | "photos_too_many"
  | "photos_unconfigured"
  | "not_found";

function toId(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** The listing id every photo form carries; 0 when absent or forged. */
export function readListingId(formData: FormData): number {
  return toId(formData.get("listingId"));
}

export async function handleUpload(
  formData: FormData,
  scope: EditScope,
): Promise<PhotoFlash> {
  const listingId = readListingId(formData);
  if (!listingId) return "not_found";

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const result = await addListingImages(listingId, scope, files);
  if (!result.ok) {
    if (result.reason === "not_configured") return "photos_unconfigured";
    if (result.reason === "no_files") return "photos_none";
    if (result.reason === "too_many") return "photos_too_many";
    return "not_found";
  }
  // A batch where some files were unreadable still saved the rest — say so
  // rather than reporting a clean success the user can't verify at a glance.
  if (result.rejected.length > 0) return "photos_rejected";
  return result.added > 0 ? "photos_uploaded" : "photos_none";
}

export async function handleDelete(
  formData: FormData,
  scope: EditScope,
): Promise<PhotoFlash> {
  const listingId = readListingId(formData);
  const imageId = toId(formData.get("imageId"));
  if (!listingId || !imageId) return "not_found";
  const ok = await deleteListingImage(listingId, imageId, scope);
  return ok ? "photos_deleted" : "not_found";
}

export async function handleMove(
  formData: FormData,
  scope: EditScope,
): Promise<PhotoFlash> {
  const listingId = readListingId(formData);
  const imageId = toId(formData.get("imageId"));
  const raw = String(formData.get("direction") ?? "");
  if (!listingId || !imageId) return "not_found";
  if (raw !== "up" && raw !== "down") return "not_found";
  const ok = await moveListingImage(listingId, imageId, raw, scope);
  return ok ? "photos_reordered" : "not_found";
}

export async function handleCover(
  formData: FormData,
  scope: EditScope,
): Promise<PhotoFlash> {
  const listingId = readListingId(formData);
  const imageId = toId(formData.get("imageId"));
  if (!listingId || !imageId) return "not_found";
  const ok = await setListingCover(listingId, imageId, scope);
  return ok ? "photos_reordered" : "not_found";
}
