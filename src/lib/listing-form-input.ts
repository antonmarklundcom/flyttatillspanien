/**
 * Parse + validate the shared listing edit form (src/components/panel/ListingForm).
 *
 * Lives apart from the two server actions that use it so admin and agency edits
 * can never drift into validating the same form differently. This only shapes
 * the payload — *authorisation* is the caller's EditScope, enforced in the
 * query layer's WHERE clause. The energy-rating publish gate (docs/SPAIN-
 * PORTAL-DESIGN.md §3.2) lives in updateListing() itself, not here — a form
 * value of "" simply becomes `undefined`/null and updateListing refuses the
 * "published" transition when that happens.
 */
import type { ListingEditInput, ListingStatusValue } from "@/lib/listing-edit";
import { ADMIN_STATUSES } from "@/lib/listing-edit";
import {
  OPERATIONS,
  PROPERTY_TYPES,
  type Operation,
  type PropertyType,
} from "@/lib/import/types";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Blank input → NULL; otherwise a non-negative integer, else NULL. */
function optInt(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Blank input → NULL; otherwise a positive number, else NULL. */
function optNum(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ListingFormResult =
  | { ok: true; id: number; input: ListingEditInput }
  | { ok: false; id: number };

export function readListingForm(formData: FormData): ListingFormResult {
  const id = Number(formData.get("listingId"));
  const safeId = Number.isInteger(id) && id > 0 ? id : 0;

  const title = str(formData.get("title"));
  const operation = str(formData.get("operation")) as Operation;
  const propertyType = str(formData.get("propertyType")) as PropertyType;
  const priceEur = Number(str(formData.get("priceEur")));
  const locationId = Number(str(formData.get("locationId")));
  const status = str(formData.get("status")) as ListingStatusValue;

  const valid =
    safeId > 0 &&
    title.length >= 8 &&
    OPERATIONS.includes(operation) &&
    PROPERTY_TYPES.includes(propertyType) &&
    Number.isFinite(priceEur) &&
    priceEur > 0 &&
    Number.isInteger(locationId) &&
    locationId > 0 &&
    ADMIN_STATUSES.includes(status);

  if (!valid) return { ok: false, id: safeId };

  return {
    ok: true,
    id: safeId,
    input: {
      title,
      descriptionEs: str(formData.get("descriptionEs")) || null,
      operation,
      propertyType,
      priceEur,
      bedrooms: optInt(formData.get("bedrooms")),
      bathrooms: optInt(formData.get("bathrooms")),
      parking: optInt(formData.get("parking")),
      builtM2: optNum(formData.get("builtM2")),
      plotM2: optNum(formData.get("plotM2")),
      locationId,
      videoUrl: str(formData.get("videoUrl")).slice(0, 500) || null,
      status,
      referenciaCatastral: str(formData.get("referenciaCatastral")) || null,
      energyRating:
        (str(formData.get("energyRating")) as ListingEditInput["energyRating"]) || undefined,
      legalStatus:
        (str(formData.get("legalStatus")) as ListingEditInput["legalStatus"]) || undefined,
      chargesStatus:
        (str(formData.get("chargesStatus")) as ListingEditInput["chargesStatus"]) || undefined,
      ibiAnnualEur: optNum(formData.get("ibiAnnualEur")),
      communityMonthlyEur: optNum(formData.get("communityMonthlyEur")),
    },
  };
}
