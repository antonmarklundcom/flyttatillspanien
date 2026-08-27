"use server";

/**
 * Agency photo actions. Identical to the admin ones except for the scope: the
 * agencyId is re-derived from the session on every call and never read from
 * the form, so a forged listingId or imageId matches no row instead of
 * touching another agency's photos.
 */
import { revalidatePath } from "next/cache";
import { revalidateListings } from "@/lib/cache";
import { redirect } from "next/navigation";
import { panelScope, requireAgencyContext } from "@/lib/auth/guards";
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
  // Agency rows for an agency account, own rows for an independent agent.
  return panelScope(await requireAgencyContext());
}

async function finish(listingId: number, flash: PhotoFlash): Promise<never> {
  revalidatePath(`/agencia/propiedad/${listingId}`);
  revalidatePath("/agencia");
  revalidateListings();
  redirect(`/agencia/propiedad/${listingId}?msg=${flash}`);
}

export async function agencyUploadPhotosAction(formData: FormData): Promise<void> {
  const s = await scope();
  await finish(readListingId(formData), await handleUpload(formData, s));
}

export async function agencyDeletePhotoAction(formData: FormData): Promise<void> {
  const s = await scope();
  await finish(readListingId(formData), await handleDelete(formData, s));
}

export async function agencyMovePhotoAction(formData: FormData): Promise<void> {
  const s = await scope();
  await finish(readListingId(formData), await handleMove(formData, s));
}

export async function agencySetCoverAction(formData: FormData): Promise<void> {
  const s = await scope();
  await finish(readListingId(formData), await handleCover(formData, s));
}
