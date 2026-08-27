"use server";

/**
 * Agency dashboard actions. requireAgencyContext() re-resolves the caller's
 * agencyId from their session on every call, and the status mutation is scoped
 * to that agencyId in its WHERE clause — an agency can only ever touch its own
 * listings, whatever the form claims.
 */
import { revalidatePath } from "next/cache";
import { revalidateListings } from "@/lib/cache";
import { panelScope, requireAgencyContext } from "@/lib/auth/guards";
import { setPanelListingStatus } from "@/lib/panel-queries";
import { isListingStatus } from "@/lib/listing-edit";

/**
 * There is no agency-specific allow-list here any more.
 *
 * There used to be, duplicated from listing-edit.ts, and it drifted: this copy
 * allowed `published`, which is what made the review queue optional (audit
 * F1). Permission now lives in exactly one place — setPanelListingStatus() ->
 * maySetStatus() — so a second caller cannot disagree with the first. All this
 * check does is reject a form value that is not a status at all.
 */

export async function setListingStatusAction(formData: FormData): Promise<void> {
  const scope = panelScope(await requireAgencyContext());

  const listingId = Number(formData.get("listingId"));
  const status = String(formData.get("status") ?? "");
  if (!Number.isInteger(listingId) || listingId <= 0) return;
  if (!isListingStatus(status)) return;

  await setPanelListingStatus({ listingId, scope, status });
  revalidatePath("/agencia");
  // paused / sold / rented all remove the listing from the published set the
  // public pages cache, so the tag has to drop with the row.
  revalidateListings();
}
