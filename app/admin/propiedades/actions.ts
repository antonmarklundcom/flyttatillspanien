"use server";

/**
 * Super-admin listing actions. requireSuperAdmin() runs before every write, and
 * the scope passed to the query layer is `admin` — the only scope that may
 * touch a listing it does not own, or delete one outright.
 */
import { revalidatePath } from "next/cache";
import { revalidateListings } from "@/lib/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  ADMIN_STATUSES,
  deleteListing,
  getEditableListing,
  updateListing,
  type ListingStatusValue,
} from "@/lib/listing-edit";
import { readListingForm } from "@/lib/listing-form-input";
import { setPanelListingStatus } from "@/lib/panel-queries";

export async function adminUpdateListingAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const parsed = readListingForm(formData);
  if (!parsed.ok) {
    revalidatePath("/admin/propiedades");
    redirect(`/admin/propiedades/${parsed.id}?msg=invalid`);
  }

  const affected = await updateListing({
    id: parsed.id,
    scope: { kind: "admin" },
    input: parsed.input,
  });

  revalidatePath("/admin/propiedades");
  revalidatePath(`/admin/propiedades/${parsed.id}`);
  revalidateListings();
  redirect(
    `/admin/propiedades/${parsed.id}?msg=${affected ? "saved" : "not_found"}`,
  );
}

/**
 * Flip `nota_simple_seen_at` — the portal's own attestation that an operator
 * has sighted the charges search, not a field a lister can reach (design doc
 * §3.2). There is deliberately no separate write path for it: this action
 * re-hydrates the row's other fields via `getEditableListing()` and resubmits
 * them through the same `updateListing()` every other panel edit uses, with
 * only this one column changed, rather than adding a second UPDATE statement
 * for a single column.
 */
export async function adminSetNotaSimpleAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const id = Number(formData.get("listingId"));
  const clear = formData.get("op") === "clear";
  if (!Number.isInteger(id) || id <= 0) return;

  const listing = await getEditableListing(id, { kind: "admin" });
  if (!listing) {
    revalidatePath(`/admin/propiedades/${id}`);
    redirect(`/admin/propiedades/${id}?msg=not_found`);
  }

  await updateListing({
    id,
    scope: { kind: "admin" },
    input: {
      title: listing.title,
      descriptionEs: listing.descriptionEs,
      operation: listing.operation,
      propertyType: listing.propertyType,
      priceEur: listing.priceEur,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      parking: listing.parking,
      builtM2: listing.builtM2,
      usableM2: listing.usableM2,
      plotM2: listing.plotM2,
      yearBuilt: listing.yearBuilt,
      locationId: listing.locationId,
      videoUrl: listing.videoUrl,
      status: listing.status,
      referenciaCatastral: listing.referenciaCatastral,
      energyRating: listing.energyRating,
      energyEmissions: listing.energyEmissions,
      legalStatus: listing.legalStatus,
      chargesStatus: listing.chargesStatus,
      ibiAnnualEur: listing.ibiAnnualEur,
      communityMonthlyEur: listing.communityMonthlyEur,
      isVpo: listing.isVpo,
      landClassification: listing.landClassification,
      buildableM2: listing.buildableM2,
      touristLicence: listing.touristLicence,
      notaSimpleSeenAt: clear ? null : new Date(),
    },
  });

  revalidatePath(`/admin/propiedades/${id}`);
  redirect(`/admin/propiedades/${id}?msg=saved`);
}

export async function adminDeleteListingAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const id = Number(formData.get("listingId"));
  if (Number.isInteger(id) && id > 0) await deleteListing(id);

  revalidatePath("/admin/propiedades");
  revalidateListings();
  redirect("/admin/propiedades?msg=deleted");
}


/**
 * Bulk actions for the listing table.
 *
 * One form wraps every row, so `formData.getAll("ids")` is the selection.
 * Two destructive levels, deliberately distinct:
 *   status=removed  — soft delete. The row keeps its leads, photos and import
 *                     history and simply stops being public. This is what
 *                     "delete" should mean nearly always.
 *   op=delete       — the real DELETE, behind a typed confirmation, because
 *                     leads attached to a deleted listing lose the thing they
 *                     were asking about.
 */
/** Cap per submit: a runaway select-all shouldn't fire 10k statements. */
const MAX_BULK = 500;

function selectedIds(formData: FormData): number[] {
  const ids = formData
    .getAll("ids")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(ids)].slice(0, MAX_BULK);
}

function isAdminStatus(v: string): v is ListingStatusValue {
  return (ADMIN_STATUSES as readonly string[]).includes(v);
}

export async function bulkListingAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const ids = selectedIds(formData);
  const op = String(formData.get("op") ?? "");
  if (ids.length === 0 || !op) return;

  if (op === "delete") {
    // Typed confirmation, not a checkbox: the browser's confirm() can be
    // dismissed by a stray Enter, and this one is not undoable.
    if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "BORRAR")
      return;
    for (const id of ids) await deleteListing(id);
  } else if (isAdminStatus(op)) {
    for (const id of ids) {
      // scope: "admin" — no agency guard, this is the super-admin table.
      await setPanelListingStatus({
        listingId: id,
        scope: { kind: "admin" },
        status: op,
      });
    }
  } else {
    return;
  }

  revalidatePath("/admin/propiedades");
  revalidatePath("/admin");
  revalidateListings();
}
