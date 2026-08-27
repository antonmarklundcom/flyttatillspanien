"use server";

/**
 * Super-admin photo actions. Thin by design: requireSuperAdmin() first, then
 * the shared handler with the `admin` scope — the only scope that may touch a
 * listing it does not own. Every branch of the outcome ends in the same
 * ?msg= flash the edit form already uses.
 */
import { revalidatePath } from "next/cache";
import { revalidateListings } from "@/lib/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  handleCover,
  handleDelete,
  handleMove,
  handleUpload,
  readListingId,
  type PhotoFlash,
} from "@/lib/photo-form-input";

const SCOPE = { kind: "admin" } as const;

async function finish(listingId: number, flash: PhotoFlash): Promise<never> {
  revalidatePath(`/admin/propiedades/${listingId}`);
  // The public pages read covers straight from listing_images, so a reorder
  // that isn't revalidated leaves the old cover on the grid.
  revalidatePath("/admin/propiedades");
  revalidateListings();
  redirect(`/admin/propiedades/${listingId}?msg=${flash}`);
}

export async function adminUploadPhotosAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  await finish(readListingId(formData), await handleUpload(formData, SCOPE));
}

export async function adminDeletePhotoAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  await finish(readListingId(formData), await handleDelete(formData, SCOPE));
}

export async function adminMovePhotoAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  await finish(readListingId(formData), await handleMove(formData, SCOPE));
}

export async function adminSetCoverAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  await finish(readListingId(formData), await handleCover(formData, SCOPE));
}
