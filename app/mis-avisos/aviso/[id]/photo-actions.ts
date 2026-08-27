"use server";

/**
 * Photo actions for the seller's own panel. Same shape as the agency ones: the
 * scope is re-derived from the session on every call and never read from the
 * form, so a forged listingId or imageId matches no row instead of touching
 * another person's photos.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateListings } from "@/lib/cache";
import { requireOwnerContext } from "@/lib/auth/guards";
import {
  handleCover,
  handleDelete,
  handleMove,
  handleUpload,
  readListingId,
  type PhotoFlash,
} from "@/lib/photo-form-input";
import type { EditScope } from "@/lib/listing-edit";

async function scope(): Promise<EditScope> {
  return (await requireOwnerContext()).scope;
}

async function finish(listingId: number, flash: PhotoFlash): Promise<never> {
  revalidatePath(`/mis-avisos/aviso/${listingId}`);
  revalidatePath("/mis-avisos");
  revalidateListings();
  redirect(`/mis-avisos/aviso/${listingId}?msg=${flash}`);
}

export async function ownerUploadPhotosAction(formData: FormData): Promise<void> {
  const s = await scope();
  await finish(readListingId(formData), await handleUpload(formData, s));
}

export async function ownerDeletePhotoAction(formData: FormData): Promise<void> {
  const s = await scope();
  await finish(readListingId(formData), await handleDelete(formData, s));
}

export async function ownerMovePhotoAction(formData: FormData): Promise<void> {
  const s = await scope();
  await finish(readListingId(formData), await handleMove(formData, s));
}

export async function ownerSetCoverAction(formData: FormData): Promise<void> {
  const s = await scope();
  await finish(readListingId(formData), await handleCover(formData, s));
}
