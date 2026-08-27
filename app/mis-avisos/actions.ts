"use server";

/**
 * Status changes from the seller's own panel.
 *
 * The scope is re-derived from the session on every call and never read from
 * the form, so a forged listingId matches no row rather than pausing somebody
 * else's property. `published` is not a status this scope may set — maySetStatus()
 * enforces that inside setPanelListingStatus(), the same gate /agencia goes
 * through (audit F1).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateListings } from "@/lib/cache";
import { requireOwnerContext } from "@/lib/auth/guards";
import { isListingStatus } from "@/lib/listing-edit";
import { setPanelListingStatus } from "@/lib/panel-queries";

export async function setOwnerListingStatusAction(
  formData: FormData,
): Promise<void> {
  const { scope } = await requireOwnerContext();

  const listingId = Number(formData.get("listingId"));
  const status = String(formData.get("status") ?? "");
  // Is it a status at all? Whether this scope may set it is maySetStatus()'s
  // call, not this form's — one allow-list, one place (audit F1).
  if (!Number.isInteger(listingId) || listingId <= 0 || !isListingStatus(status)) {
    redirect("/mis-avisos");
  }

  await setPanelListingStatus({ listingId, scope, status });

  revalidatePath("/mis-avisos");
  revalidateListings();
  redirect("/mis-avisos");
}
