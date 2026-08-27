"use server";

/**
 * Listing edit from the seller's own panel. Identical to the agency action
 * except for the scope: it is re-derived from the session via
 * requireOwnerContext() and never read from the form, so a forged listingId
 * matches no row instead of editing somebody else's property.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateListings } from "@/lib/cache";
import { requireOwnerContext } from "@/lib/auth/guards";
import { updateListing } from "@/lib/listing-edit";
import { readListingForm } from "@/lib/listing-form-input";

export async function ownerUpdateListingAction(
  formData: FormData,
): Promise<void> {
  const { scope } = await requireOwnerContext();

  const parsed = readListingForm(formData);
  if (!parsed.ok) redirect(`/mis-avisos/aviso/${parsed.id}?msg=invalid`);

  const affected = await updateListing({
    id: parsed.id,
    scope,
    input: parsed.input,
  });

  revalidatePath("/mis-avisos");
  revalidatePath(`/mis-avisos/aviso/${parsed.id}`);
  revalidateListings();
  redirect(
    `/mis-avisos/aviso/${parsed.id}?msg=${affected ? "saved" : "not_found"}`,
  );
}
